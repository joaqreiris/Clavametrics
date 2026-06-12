-- =========================================================
-- 047 — Nutrition Module · Share with player (link tokenizado anon)
-- Reusa share_links (migration 023). Agrega player_id y un RPC
-- SECURITY DEFINER que expone SOLO lo que el jugador necesita ver:
-- targets + meal plan del día (escalado). NO notas, NO body composition,
-- NO datos médicos.
-- =========================================================

alter table public.share_links
  add column if not exists player_id uuid references public.players(id) on delete cascade;

create index if not exists share_links_player_idx on public.share_links (player_id);

-- RPC: get_shared_nutrition(token) — anon, valida token+scope='nutrition'
create or replace function public.get_shared_nutrition(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link    public.share_links;
  v_player  public.players;
  v_club    jsonb;
  v_target  jsonb;
  v_asg     record;
  v_meals   jsonb;
begin
  select * into v_link
    from public.share_links
   where token = p_token
     and revoked = false
     and scope = 'nutrition'
     and (expires_at is null or expires_at > now());

  if not found or v_link.player_id is null then
    return jsonb_build_object('error', 'invalid_token');
  end if;

  select * into v_player
    from public.players
   where id = v_link.player_id and club_id = v_link.club_id;
  if not found then
    return jsonb_build_object('error', 'invalid_token');
  end if;

  select jsonb_build_object('name', name, 'logo_url', logo_url, 'primary_color', primary_color)
    into v_club from public.clubs where id = v_link.club_id;

  select jsonb_build_object(
           'kcal_target', kcal_target, 'protein_g', protein_g, 'carbs_g', carbs_g,
           'fats_g', fats_g, 'hydration_ml', hydration_ml, 'body_fat_target_pct', body_fat_target_pct)
    into v_target
    from public.nutrition_targets where player_id = v_link.player_id;

  -- asignación activa: hoy > recurrente por day_type > más reciente
  select a.scale_factor, t.id as template_id, t.name as template_name
    into v_asg
    from public.player_meal_assignments a
    join public.meal_plan_templates t on t.id = a.template_id
   where a.player_id = v_link.player_id and a.club_id = v_link.club_id
   order by (a.assigned_date = current_date) desc,
            (a.day_type is not null) desc,
            a.assigned_date desc nulls last
   limit 1;

  if v_asg.template_id is not null then
    select jsonb_agg(meal order by ord) into v_meals
      from (
        select m.meal_order as ord,
               jsonb_build_object(
                 'name', m.name,
                 'time_hint', m.time_hint,
                 'items', (
                   select coalesce(jsonb_agg(jsonb_build_object(
                       'food_name',  f.name,
                       'quantity_g', round((mi.quantity_g * coalesce(v_asg.scale_factor, 1))::numeric, 0),
                       'kcal',       f.kcal,
                       'protein_g',  f.protein_g,
                       'carbs_g',    f.carbs_g,
                       'fats_g',     f.fats_g)), '[]'::jsonb)
                   from public.meal_plan_items mi
                   join public.foods f on f.id = mi.food_id
                   where mi.meal_id = m.id)
               ) as meal
        from public.meal_plan_meals m
        where m.template_id = v_asg.template_id
      ) s;
  end if;

  return jsonb_build_object(
    'club', v_club,
    'player', jsonb_build_object(
      'name', trim(coalesce(v_player.first_name, '') || ' ' || coalesce(v_player.last_name, '')),
      'position', v_player.position,
      'number', v_player.number),
    'target', v_target,
    'plan', case when v_asg.template_id is not null
              then jsonb_build_object('name', v_asg.template_name,
                                      'scale_factor', v_asg.scale_factor,
                                      'meals', coalesce(v_meals, '[]'::jsonb))
              else null end);
end;
$$;

grant execute on function public.get_shared_nutrition(text) to anon, authenticated;
