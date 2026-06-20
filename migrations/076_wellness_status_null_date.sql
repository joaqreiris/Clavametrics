-- 076_wellness_status_null_date.sql
-- El front llama con p_date := null. En PostgREST, null NO usa el DEFAULT CURRENT_DATE
-- (el default solo aplica si el arg se OMITE). El join quedaba = NULL → nunca matchea
-- → todos responded=false → 0/7. Fix: coalesce(p_date, current_date) adentro.

create or replace function public.wellness_status(p_club_id uuid, p_team_id uuid default null, p_date date default current_date)
 returns table(player_id uuid, player_name text, responded boolean, readiness numeric, hooper_index numeric)
 language plpgsql stable security definer set search_path to 'public'
as $function$
declare v_date date := coalesce(p_date, current_date);
begin
  return query
    select q.player_id, q.player_name, q.responded, q.readiness, q.hooper_index
    from (
      select distinct on (p.id)
        p.id as player_id,
        coalesce(nullif(trim(coalesce(p.first_name,'')||' '||coalesce(p.last_name,'')),''),'Player') as player_name,
        (w.id is not null) as responded,
        w.readiness as readiness,
        w.hooper_index as hooper_index,
        p.last_name as ln, p.first_name as fn
      from public.players p
      left join public.wellness w
        on w.player_id = p.id and w.submitted_at::date = v_date
      where p.club_id = p_club_id
        and p.id in (select public.my_player_ids())
        and (p_team_id is null or p.team_id = p_team_id)
      order by p.id, w.submitted_at desc nulls last
    ) q
    order by q.responded, q.ln nulls last, q.fn nulls last;
end; $function$;
