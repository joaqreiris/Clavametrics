-- Migration 119: tasks.assigned_roles — asignación de tareas por ROL del staff (varios roles),
-- visible solo dentro del equipo de la tarea. Sigue el patrón canónico de exercises.visible_teams
-- (columna array + chequeo en RLS).
--
-- ¿Por qué text[] y NO uuid[]?
--   La tarea se asigna a uno o varios ROLES del staff (ej. {'physio','analyst'} o todo el staff),
--   NO a personas puntuales. Los valores del array son los del enum profiles.role
--   (owner/admin/coach/physio/analyst/nutritionist/staff). El rol se resuelve a PERSONAS recién en
--   la UI al renderizar (chips) — la fila de la tarea guarda roles, no ids de perfil. El caso
--   "tarea individual" clásico sigue viviendo en assigned_to (uuid); assigned_roles NULL = individual.
--
-- Completar = global: la tarea es UNA sola fila; cualquiera que la marque done la completa para
-- todos. No hace falta nada extra para eso (las policies de update por club ya lo permiten).
--
-- Alcance: SOLO agrega la columna, una función get_user_role() reusable, y UNA rama a la policy
-- SELECT. NO toca las policies de INSERT/UPDATE/DELETE (siguen permitiendo a cualquier miembro
-- del club, que es lo acordado).
--
-- Rollback:
--   drop policy if exists "Team-scoped task visibility" on public.tasks;
--   -- recrear la policy sin la rama de assigned_roles (ver bloque de abajo, quitando esa rama)
--   alter table public.tasks drop column if exists assigned_roles;
--   drop function if exists public.get_user_role();

-- ── 1. Columna assigned_roles (nullable; NULL = tarea individual) ──────────────
alter table public.tasks add column if not exists assigned_roles text[];

-- Límite defensivo de tamaño del array (opcional, evita arrays enormes).
alter table public.tasks drop constraint if exists tasks_assigned_roles_len;
alter table public.tasks
  add constraint tasks_assigned_roles_len
  check (assigned_roles is null or cardinality(assigned_roles) <= 10);

-- Valores válidos: cada elemento debe ser un rol del enum de profiles.role.
alter table public.tasks drop constraint if exists tasks_assigned_roles_valid;
alter table public.tasks
  add constraint tasks_assigned_roles_valid
  check (
    assigned_roles is null
    or assigned_roles <@ ARRAY['owner','admin','coach','physio','analyst','nutritionist','staff']::text[]
  );

-- ── 2. Función reusable get_user_role() (molde de has_full_planning_access) ─────
CREATE OR REPLACE FUNCTION public.get_user_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$function$;

-- ── 3. RLS SELECT: sumar la rama "mi rol ∈ assigned_roles Y es mi equipo" ───────
-- Postgres no soporta CREATE OR REPLACE POLICY → drop + create con el nombre exacto.
drop policy if exists "Team-scoped task visibility" on public.tasks;
create policy "Team-scoped task visibility" on public.tasks as permissive for select to public
  using (
    (club_id IN (SELECT profiles.club_id FROM profiles WHERE profiles.id = auth.uid()))
    AND (
      has_full_planning_access()
      OR (team_id IN (SELECT my_team_ids()))
      OR (created_by = auth.uid())
      OR (assigned_to = auth.uid())
      OR (assigned_roles IS NOT NULL
          AND get_user_role() = ANY(assigned_roles)
          AND team_id IN (SELECT my_team_ids()))
    )
  );
