-- migrations/081_activity_log_treatments_trigger.sql
-- Completa activity_log con el evento de adaptación de fisio (treatment.adaptation).
-- Se registra solo cuando hay una adaptación para notificar a los coaches:
--   notify_coaches = true Y hay texto en adaptation/adaptation_notes.
-- Cubre insert (treatment creado ya con adaptación enviada) y update (adaptación
-- enviada después, cuando adaptation_sent_at recién se setea), sin duplicar.

create or replace function public.trg_act_treatment() returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare
  v_has_adapt boolean := coalesce(nullif(trim(coalesce(NEW.adaptation, NEW.adaptation_notes, '')), ''), null) is not null;
  v_fire boolean := false;
begin
  if NEW.notify_coaches is true and v_has_adapt then
    if TG_OP = 'INSERT' then
      v_fire := true;
    elsif TG_OP = 'UPDATE'
          and NEW.adaptation_sent_at is not null
          and OLD.adaptation_sent_at is distinct from NEW.adaptation_sent_at then
      v_fire := true;
    end if;
  end if;

  if v_fire then
    insert into public.activity_log (club_id, team_id, actor_id, action, entity_table, entity_id, player_id, summary)
    values (NEW.club_id, public.activity_team_for_player(NEW.player_id),
            coalesce(NEW.physio_id, NEW.performed_by),
            'treatment.adaptation', 'treatments', NEW.id, NEW.player_id,
            jsonb_build_object('adaptation', left(coalesce(NEW.adaptation, NEW.adaptation_notes, ''), 140)));
  end if;
  return NEW;
end $$;

drop trigger if exists act_treatment on public.treatments;
create trigger act_treatment after insert or update on public.treatments
  for each row execute function public.trg_act_treatment();
