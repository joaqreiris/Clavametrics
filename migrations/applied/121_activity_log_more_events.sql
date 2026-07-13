-- 121_activity_log_more_events.sql
-- 8 triggers nuevos que alimentan el feed "Recent activity" (activity_log), aplicados a mano
-- en el SQL Editor de Supabase. El cuerpo aquí es el texto exacto de los objetos ya aplicados
-- (capturado por introspección con db/build_schema.py).
--
-- Rationale por evento:
--   availability.changed  -> SOLO en UPDATE con OLD.status IS DISTINCT FROM NEW.status. El
--                            autofill diario de disponibilidad haría INSERT/UPDATE masivos;
--                            disparar solo ante un cambio real de status evita inundar el feed.
--   session.modified      -> solo si la sesión ya estaba publicada y cambió algo relevante
--                            (title/fecha/duración/hora), para no duplicar con session.published.
--   match_report.created  -> INSERT en match_reports.
--   evaluation.recorded   -> INSERT en evaluations Y en force_tests (misma función, TG_TABLE_NAME).
--   medical.episode       -> INSERT en medical_episodes.
--   microcycle.published  -> al setear published_at (INSERT/UPDATE).
--   lineup.published      -> al setear published_at (INSERT/UPDATE).
--   player.added/archived -> INSERT (added) y UPDATE archived_at null->not null (archived).
--
-- Registro histórico: estos objetos YA existen en la DB. NO re-aplicar.

CREATE OR REPLACE FUNCTION public.trg_act_availability()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if TG_OP = 'UPDATE' and OLD.status is distinct from NEW.status then
    insert into public.activity_log (club_id, team_id, action, entity_table, entity_id, player_id, summary)
    values (NEW.club_id,
            public.activity_team_for_player(NEW.player_id::uuid),
            'availability.changed', 'availability', null, NEW.player_id::uuid,
            jsonb_build_object('date', NEW.date, 'from', OLD.status, 'to', NEW.status));
  end if;
  return NEW;
end $function$
;

CREATE OR REPLACE FUNCTION public.trg_act_session_mod()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if TG_OP = 'UPDATE' and OLD.published is true and NEW.published is true
     and (OLD.title is distinct from NEW.title
          or OLD.session_date is distinct from NEW.session_date
          or OLD.duration is distinct from NEW.duration
          or OLD.session_time is distinct from NEW.session_time) then
    insert into public.activity_log (club_id, team_id, actor_id, action, entity_table, entity_id, summary)
    values (NEW.club_id, NEW.team_id, NEW.coach_id, 'session.modified', 'training_sessions', NEW.id,
            jsonb_build_object('title', NEW.title, 'session_type', NEW.session_type));
  end if;
  return NEW;
end $function$
;

CREATE OR REPLACE FUNCTION public.trg_act_match_report()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.activity_log (club_id, action, entity_table, entity_id, summary)
  values (NEW.club_id, 'match_report.created', 'match_reports', NEW.id,
          jsonb_build_object('match_date', NEW.match_date));
  return NEW;
end $function$
;

CREATE OR REPLACE FUNCTION public.trg_act_evaluation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.activity_log (club_id, team_id, action, entity_table, entity_id, player_id, summary)
  values (NEW.club_id,
          public.activity_team_for_player(NEW.player_id),
          'evaluation.recorded', TG_TABLE_NAME, NEW.id, NEW.player_id,
          jsonb_build_object('test_date', NEW.test_date, 'kind', TG_TABLE_NAME));
  return NEW;
end $function$
;

CREATE OR REPLACE FUNCTION public.trg_act_medical_episode()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.activity_log (club_id, team_id, action, entity_table, entity_id, player_id, summary)
  values (NEW.club_id,
          public.activity_team_for_player(NEW.player_id),
          'medical.episode', 'medical_episodes', NEW.id, NEW.player_id,
          jsonb_build_object('start_date', NEW.start_date, 'status', NEW.status));
  return NEW;
end $function$
;

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
    values (NEW.club_id, NEW.team_id, NEW.published_by, 'microcycle.published', 'microcycles', NEW.id,
            jsonb_build_object('name', NEW.name, 'start_date', NEW.start_date));
  end if;
  return NEW;
end $function$
;

CREATE OR REPLACE FUNCTION public.trg_act_lineup_pub()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if NEW.published_at is not null
     and (TG_OP = 'INSERT' or OLD.published_at is distinct from NEW.published_at) then
    insert into public.activity_log (club_id, actor_id, action, entity_table, entity_id, summary)
    values (NEW.club_id, NEW.published_by, 'lineup.published', 'lineups', NEW.id,
            jsonb_build_object('match_id', NEW.match_id));
  end if;
  return NEW;
end $function$
;

CREATE OR REPLACE FUNCTION public.trg_act_player()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if TG_OP = 'INSERT' then
    insert into public.activity_log (club_id, team_id, action, entity_table, entity_id, player_id, summary)
    values (NEW.club_id, NEW.team_id, 'player.added', 'players', NEW.id, NEW.id,
            jsonb_build_object('name', coalesce(NEW.first_name,'') || ' ' || coalesce(NEW.last_name,'')));
  elsif TG_OP = 'UPDATE' and OLD.archived_at is null and NEW.archived_at is not null then
    insert into public.activity_log (club_id, team_id, action, entity_table, entity_id, player_id, summary)
    values (NEW.club_id, NEW.team_id, 'player.archived', 'players', NEW.id, NEW.id,
            jsonb_build_object('name', coalesce(NEW.first_name,'') || ' ' || coalesce(NEW.last_name,'')));
  end if;
  return NEW;
end $function$
;

-- Triggers
CREATE TRIGGER act_availability AFTER UPDATE ON public.availability FOR EACH ROW EXECUTE FUNCTION trg_act_availability();
CREATE TRIGGER act_session_mod AFTER UPDATE ON public.training_sessions FOR EACH ROW EXECUTE FUNCTION trg_act_session_mod();
CREATE TRIGGER act_match_report AFTER INSERT ON public.match_reports FOR EACH ROW EXECUTE FUNCTION trg_act_match_report();
CREATE TRIGGER act_evaluation AFTER INSERT ON public.evaluations FOR EACH ROW EXECUTE FUNCTION trg_act_evaluation();
CREATE TRIGGER act_force_test AFTER INSERT ON public.force_tests FOR EACH ROW EXECUTE FUNCTION trg_act_evaluation();
CREATE TRIGGER act_medical_episode AFTER INSERT ON public.medical_episodes FOR EACH ROW EXECUTE FUNCTION trg_act_medical_episode();
CREATE TRIGGER act_microcycle_pub AFTER INSERT OR UPDATE ON public.microcycles FOR EACH ROW EXECUTE FUNCTION trg_act_microcycle_pub();
CREATE TRIGGER act_lineup_pub AFTER INSERT OR UPDATE ON public.lineups FOR EACH ROW EXECUTE FUNCTION trg_act_lineup_pub();
CREATE TRIGGER act_player AFTER INSERT OR UPDATE ON public.players FOR EACH ROW EXECUTE FUNCTION trg_act_player();
