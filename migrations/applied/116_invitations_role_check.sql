-- Migration 116: harden invitations.role — sanear datos, fijar default y agregar CHECK.
--
-- Motivación: public.invitations.role hoy NO tiene CHECK y su default es 'viewer', un valor
-- que NO existe en el enum real de roles (profiles_role_check: owner, admin, coach, physio,
-- analyst, nutritionist, staff). Al invitar NO se permite 'owner' (owner no se invita), así que
-- el set válido para invitaciones es: admin, coach, physio, analyst, nutritionist, staff.
--
-- Orden obligatorio: primero saneamos las filas fuera de rango (incluidas las 'viewer') a 'staff',
-- luego cambiamos el default, y recién ahí agregamos el CHECK (si hubiera filas inválidas, el
-- ADD CONSTRAINT fallaría). Idempotente: el UPDATE no toca filas ya válidas y el CHECK se agrega
-- sólo si no existe.
--
-- Alcance: SOLO la tabla invitations. NO toca el enum de profiles, NI el código JS, NI la UI del
-- invite (ese es el próximo paso, manual).
--
-- Rollback (si hiciera falta):
--   alter table public.invitations drop constraint if exists invitations_role_check;
--   alter table public.invitations alter column role set default 'viewer';

-- 1. Sanear datos existentes fuera del set válido de invite (incluye 'viewer').
update public.invitations
set role = 'staff'
where role not in ('admin','coach','physio','analyst','nutritionist','staff');

-- 2. Fijar el default a un valor válido.
alter table public.invitations alter column role set default 'staff';

-- 3. Agregar el CHECK (drop previo por si ya existiera con ese nombre, para ser idempotente).
alter table public.invitations drop constraint if exists invitations_role_check;
alter table public.invitations
  add constraint invitations_role_check
  check (role in ('admin','coach','physio','analyst','nutritionist','staff'));
