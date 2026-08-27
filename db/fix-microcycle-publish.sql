-- ═══════════════════════════════════════════════════════════════════════════
--  Fix: publicar un microciclo fallaba SIEMPRE, en todos los clubes
--
--  microcycles es la única tabla de la base cuyo id es TEXT (la app lo genera
--  en el cliente). El trigger de actividad insertaba ese id en
--  activity_log.entity_id, que es uuid, y Postgres no castea text→uuid en una
--  asignación. Resultado:
--
--      ERROR: column "entity_id" is of type uuid but expression is of type text
--
--  El trigger es AFTER INSERT OR UPDATE, así que el error abortaba la
--  transacción entera: el microciclo no se publicaba y el usuario veía el
--  fallo. Comprobado en la base: 0 microciclos publicados y 0 eventos
--  'microcycle.published' en todo el histórico. La función nunca anduvo.
--
--  Aplicar en el SQL Editor de Supabase.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.trg_act_microcycle_pub()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if NEW.published_at is not null
     and (TG_OP = 'INSERT' or OLD.published_at is distinct from NEW.published_at) then
    insert into public.activity_log (club_id, team_id, actor_id, action, entity_table, entity_id, summary)
    values (NEW.club_id, NEW.team_id, coalesce(NEW.published_by, auth.uid()), 'microcycle.published', 'microcycles',
            -- microcycles.id es TEXT y entity_id es uuid: hace falta el cast.
            -- Los ids viejos de carga masiva ('MC01-2025-07-07') no tienen
            -- formato uuid, así que para esos se guarda NULL en vez de romper
            -- la publicación.
            case when NEW.id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                 then NEW.id::uuid end,
            jsonb_build_object('name', NEW.name, 'start_date', NEW.start_date));
  end if;
  return NEW;
end $function$;

-- Comprobación: debería devolver 'ok' sin insertar nada.
select case
         when 'MC01-2025-07-07' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
           then 'mal: el id viejo pasa como uuid'
         when not (gen_random_uuid()::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
           then 'mal: un uuid nuevo no matchea'
         else 'ok'
       end as comprobacion;
