-- 157 — Aviso por la campana cuando se registra un club.
--
-- Durante la campaña no se puede depender de entrar a mirar una lista: un alta que
-- no se ve el mismo día ya perdió las 48 horas que decidían si ese club iba a
-- cargar su plantel o no.
--
-- Va por la tabla `notifications`, que ya tiene campana, contador y realtime en el
-- sidebar. La policy de lectura es `user_id = auth.uid()`, así que dirigiendo la
-- fila al platform admin no la ve nadie más.

create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault cascade;

create or replace function public.notificar_club_nuevo()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_detalle text;
begin
  -- Lo que se sabe del club en el momento del alta: el perfil de quien lo creó
  -- todavía no existe (se inserta un instante después), así que el email no está.
  v_detalle := concat_ws(' · ',
    nullif(new.country, ''),
    nullif(new.sport, ''),
    case when new.utm_source is not null then 'vino de ' || new.utm_source else 'entrada directa' end
  );

  insert into public.notifications (user_id, club_id, type, title, body, link)
  select pa.user_id,
         null,                      -- no es del club del admin: es sobre otro club
         'platform_new_club',
         'Club nuevo: ' || coalesce(new.name, 'sin nombre'),
         v_detalle,
         'Platform.html'
    from public.platform_admins pa;

  return new;
exception when others then
  -- Un aviso que falla no puede tumbar un registro: el club se crea igual.
  return new;
end;
$$;

drop trigger if exists trg_notificar_club_nuevo on public.clubs;
create trigger trg_notificar_club_nuevo
  after insert on public.clubs
  for each row execute function public.notificar_club_nuevo();

comment on function public.notificar_club_nuevo() is
  'Avisa a los platform admins por la campana cuando se registra un club. club_id va NULL a propósito: la notificación no pertenece al club del admin sino al club nuevo.';
