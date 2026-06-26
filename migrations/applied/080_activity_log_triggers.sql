-- migrations/080_activity_log_triggers.sql
-- Engancha los triggers que pueblan activity_log. Todos los trigger functions son
-- SECURITY DEFINER (saltean RLS para insertar). Capturan: sesión publicada, lesión
-- registrada, alta médica, adaptación de fisio, import GPS, wellness y RPE.
-- IMPORTANTE: ninguno bloquea ni altera la operación original (son AFTER + return).

-- ───────────── Sesión publicada ─────────────
create or replace function public.trg_act_session() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  -- Solo cuando pasa a publicada (insert ya publicada, o update false→true)
  if NEW.published is true
     and (TG_OP = 'INSERT' or OLD.published is distinct from NEW.published) then
    insert into public.activity_log (club_id, team_id, actor_id, action, entity_table, entity_id, summary)
    values (NEW.club_id, NEW.team_id, NEW.coach_id, 'session.published', 'training_sessions', NEW.id,
            jsonb_build_object('title', NEW.title, 'session_type', NEW.session_type));
  end if;
  return NEW;
end $$;
drop trigger if exists act_session on public.training_sessions;
create trigger act_session after insert or update on public.training_sessions
  for each row execute function public.trg_act_session();

-- ───────────── Lesión: registrada / alta ─────────────
create or replace function public.trg_act_injury() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  if TG_OP = 'INSERT' then
    insert into public.activity_log (club_id, team_id, actor_id, action, entity_table, entity_id, player_id, summary)
    values (NEW.club_id, public.activity_team_for_player(NEW.player_id), NEW.created_by,
            'injury.logged', 'injuries', NEW.id, NEW.player_id,
            jsonb_build_object('body_area', NEW.body_area, 'injury_type', NEW.injury_type, 'severity', NEW.severity));
  elsif TG_OP = 'UPDATE'
        and NEW.status = 'cleared' and OLD.status is distinct from 'cleared' then
    insert into public.activity_log (club_id, team_id, actor_id, action, entity_table, entity_id, player_id, summary)
    values (NEW.club_id, public.activity_team_for_player(NEW.player_id), NEW.created_by,
            'injury.cleared', 'injuries', NEW.id, NEW.player_id,
            jsonb_build_object('body_area', NEW.body_area, 'returned_date', NEW.returned_date));
  end if;
  return NEW;
end $$;
drop trigger if exists act_injury on public.injuries;
create trigger act_injury after insert or update on public.injuries
  for each row execute function public.trg_act_injury();

-- ───────────── Import GPS (una fila por sesión/día vía índice único) ─────────────
create or replace function public.trg_act_gps() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  insert into public.activity_log (club_id, team_id, actor_label, action, entity_table, entity_id, player_id, summary)
  values (NEW.club_id, public.activity_team_for_player(NEW.player_id), 'GPS sync',
          'gps.imported', 'gps_reports', NEW.session_id, NEW.player_id,
          jsonb_build_object('session_id', NEW.session_id))
  on conflict (entity_id, ((created_at at time zone 'UTC')::date))
    where action = 'gps.imported'
    do nothing;
  return NEW;
end $$;
drop trigger if exists act_gps on public.gps_reports;
create trigger act_gps after insert on public.gps_reports
  for each row execute function public.trg_act_gps();

-- ───────────── Wellness enviado ─────────────
create or replace function public.trg_act_wellness() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  insert into public.activity_log (club_id, team_id, action, entity_table, entity_id, player_id, summary)
  values (NEW.club_id, public.activity_team_for_player(NEW.player_id),
          'wellness.submitted', 'wellness', NEW.id, NEW.player_id,
          jsonb_build_object('hooper_index', NEW.hooper_index, 'readiness', NEW.readiness));
  return NEW;
end $$;
drop trigger if exists act_wellness on public.wellness;
create trigger act_wellness after insert on public.wellness
  for each row execute function public.trg_act_wellness();

-- ───────────── RPE enviado ─────────────
create or replace function public.trg_act_rpe() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  insert into public.activity_log (club_id, team_id, action, entity_table, entity_id, player_id, summary)
  values (NEW.club_id, public.activity_team_for_player(NEW.player_id),
          'rpe.submitted', 'rpe', NEW.id, NEW.player_id,
          jsonb_build_object('rpe', NEW.rpe, 'session_id', NEW.session_id, 'load', NEW.load));
  return NEW;
end $$;
drop trigger if exists act_rpe on public.rpe;
create trigger act_rpe after insert on public.rpe
  for each row execute function public.trg_act_rpe();
