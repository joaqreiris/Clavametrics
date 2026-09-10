-- 130 · GPS · Patrones de contexto POR DEFECTO + regla de anulación 'team'
-- ---------------------------------------------------------------------------
-- Problema: `gps_context_rules` arranca vacía en cada club, así que hasta que alguien
-- carga una regla a mano TODO período entra como 'team'. Un "Complementary" o un
-- "Top up" del día de partido contaba entonces como partido: ensuciaba la media del
-- plantel y — peor — las referencias de partido del jugador que no jugó.
--
-- Solución: el trigger cae a una lista built-in cuando NINGUNA regla del club matchea.
-- Las reglas del club siguen mandando, y ahora pueden anular un default: una regla con
-- work_context='team' significa "este nombre es trabajo de equipo, no lo toques".
--
-- Idempotente. No reetiqueta lo ya importado (ver back-fill opcional al final).

-- 1) La regla de anulación: 'team' pasa a ser un work_context válido para una REGLA.
--    (En gps_period_reports 'team' ya era el default; acá solo se admite como intención.)
alter table public.gps_context_rules
  drop constraint if exists gps_context_rules_context_check;
alter table public.gps_context_rules
  add constraint gps_context_rules_context_check
  CHECK ((work_context = ANY (ARRAY['team'::text, 'rehab'::text, 'individual'::text, 'topup'::text])));

-- 2) Trigger: reglas del club → si ninguna matchea, patrones built-in.
create or replace function public.apply_gps_context_rule()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_ctx text;
begin
  -- Solo autocompleta el default: respeta cualquier contexto ya seteado (manual/explícito).
  if (NEW.work_context is null or NEW.work_context = 'team') and NEW.period_name is not null then
    -- a) Reglas del club. El patrón más específico (más largo) gana. Una regla 'team' es
    --    una anulación explícita: matchea, no cambia nada y corta la búsqueda.
    select r.work_context into v_ctx
      from public.gps_context_rules r
      where r.club_id = NEW.club_id and NEW.period_name ilike r.pattern
      order by length(r.pattern) desc
      limit 1;

    -- b) Sin regla del club que matchee → patrones por defecto. Nombres que en la práctica
    --    NUNCA son trabajo de equipo. Ojo: "extra time" (prórroga) SÍ es partido → fuera.
    if v_ctx is null then
      select d.ctx into v_ctx
        from (values
          -- top-up / complementario: los metros de compensación del suplente
          ('%top up%',        'topup'),
          ('%top-up%',        'topup'),
          ('%topup%',         'topup'),
          ('%complementar%',  'topup'),   -- complementary · complementario · complementar
          ('%complemento%',   'topup'),
          ('%compensator%',   'topup'),   -- compensatory · compensatorio
          ('%compensac%',     'topup'),   -- compensación · compensacao
          -- readaptación
          ('%rehab%',         'rehab'),
          ('%readapt%',       'rehab'),
          ('%reatlet%',       'rehab'),
          -- trabajo individual
          ('%individual%',    'individual')
        ) as d(pattern, ctx)
        where NEW.period_name ilike d.pattern
        order by length(d.pattern) desc
        limit 1;
    end if;

    if v_ctx is not null and v_ctx <> 'team' then NEW.work_context := v_ctx; end if;
  end if;
  return NEW;
end;
$function$;

drop trigger if exists trg_apply_gps_context_rule on public.gps_period_reports;
create trigger trg_apply_gps_context_rule
  before insert on public.gps_period_reports
  for each row execute function public.apply_gps_context_rule();

-- 3) Back-fill — YA APLICADO en producción el 2026-09-05: 76 períodos reetiquetados
--    (COMPENSATORY ×49, COMPENSATORY 2 ×14, COMPENSATORY RUNNING ×7, Compensatory Training ×6,
--    MAX VELOCITY ANALYTIC TOP UP ×6, COMPENSATORY 1 ×3, Compensatory ×1). 23 de ellos caían en
--    día de partido, o sea contaban como partido. Queda acá para reproducir el estado en otra base.
--    Solo toca períodos que siguen en el default 'team'; nunca pisa etiquetas manuales.
-- update public.gps_period_reports p set work_context = d.ctx
--   from (values
--     ('%top up%','topup'),('%top-up%','topup'),('%topup%','topup'),
--     ('%complementar%','topup'),('%complemento%','topup'),
--     ('%compensator%','topup'),('%compensac%','topup'),
--     ('%rehab%','rehab'),('%readapt%','rehab'),('%reatlet%','rehab'),
--     ('%individual%','individual')
--   ) as d(pattern, ctx)
--   where p.work_context = 'team' and p.period_name ilike d.pattern
--     and not exists (
--       select 1 from public.gps_context_rules r
--        where r.club_id = p.club_id and p.period_name ilike r.pattern and r.work_context = 'team');
