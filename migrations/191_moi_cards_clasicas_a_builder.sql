-- Convierte las cards CLÁSICAS de MOI en cards del builder equivalentes.
-- Las configs son copia literal de las que el propio código siembra (_GEN_EXAMPLE_CONFIGS en
-- gps-analysis.js, _mpTdConfig/_mpHiConfig en gps-match-perf.js, _mcTableConfig en
-- gps-mc-compare.js), para que la card dibuje EXACTAMENTE lo mismo que hoy.
--
-- No se migran: outliers (todavía no tiene equivalente en el builder), xmatch (mide acumulación
-- en microciclo, ningún tipo hace eso) y mp-player (ficha de jugador, no es un gráfico). Esas
-- tres siguen como cards clásicas y se quedan en su sitio.

do $$
declare
  v_club  uuid := '54ea81f9-9371-4588-9518-55cfdd63f43e';   -- MOI Kompong DEWA
  v_autor uuid := 'fd75ee5f-1e54-4b87-b4fb-6d89cc17e197';
  d_ind   uuid; d_grp uuid; d_mind uuid; d_mc uuid;
begin
  select id into d_ind  from dashboards where club_id = v_club and report_type = 'ind'  limit 1;
  select id into d_mind from dashboards where club_id = v_club and report_type = 'mind' limit 1;
  select id into d_mc   from dashboards where club_id = v_club and report_type = 'mc'   limit 1;
  select id into d_grp  from dashboards where club_id = v_club and report_type = 'grp'  limit 1;

  -- La vista de Session control no tenía dashboard propio todavía (nunca se guardó una card del
  -- builder ahí): se crea, porque la tabla de sesiones va a vivir en él.
  if d_grp is null then
    insert into dashboards (club_id, report_type, name, scope, is_shared, created_by)
    values (v_club, 'grp', 'Session Control', 'squad', true, v_autor)
    returning id into d_grp;
  end if;

  -- Mapeo card clásica → card nueva, para reescribir los layouts en el paso siguiente y para
  -- poder auditar qué se convirtió en qué.
  create table if not exists gps_migracion_cards_191 (
    club_id uuid, card_clasica text, card_nueva uuid, dashboard_id uuid, creado_en timestamptz default now()
  );

  insert into dashboard_cards (dashboard_id, config, size, position, source, created_by)
  select d.dash, d.cfg, d.size, d.pos, 'builder', v_autor
  from (values
    -- ── Player Week ────────────────────────────────────────────────────────
    (d_ind, 'gen-week-kpi', 'sm', 900, jsonb_build_object(
      'schema','gp.card/v1','title','Total distance','viz','kpi',
      'scope', jsonb_build_object('level','squad'),
      'metrics', jsonb_build_array(jsonb_build_object('id','total_distance','agg','total','kind','accum','unit','m')),
      'range', jsonb_build_object('type','season'), 'comparison', null,
      'style', jsonb_build_object('size','sm','color','#15803D','palette','pitch','axes',true,'legend',true,'dataLabels',false))),
    (d_ind, 'acwr', 'md', 901, jsonb_build_object(
      'schema','gp.card/v1','title','ACWR','viz','acwr',
      'scope', jsonb_build_object('level','squad'),
      'metrics', jsonb_build_array(jsonb_build_object('id','player_load','agg','total','kind','accum','unit','AU')),
      'range', jsonb_build_object('type','w30'), 'comparison', null, 'dimensions', jsonb_build_array(),
      'style', jsonb_build_object('size','md','color','#15803D','palette','pitch','metricFollow',false))),
    -- ── Session Control ────────────────────────────────────────────────────
    (d_grp, 'gen-session-table', 'full', 902, jsonb_build_object(
      'schema','gp.card/v1','title','Session table','viz','table',
      'scope', jsonb_build_object('level','squad'),
      'metrics', jsonb_build_array(
        jsonb_build_object('id','total_distance','agg','total','kind','accum','unit','m'),
        jsonb_build_object('id','high_speed_distance','agg','total','kind','accum','unit','m'),
        jsonb_build_object('id','player_load','agg','total','kind','accum','unit','AU')),
      'dimensions', jsonb_build_array(jsonb_build_object('id','player_name')),
      'range', jsonb_build_object('type','season'), 'comparison', null,
      'style', jsonb_build_object('size','full','color','#15803D','palette','pitch','axes',true,'legend',true,'dataLabels',false))),
    -- ── Match Performance ──────────────────────────────────────────────────
    (d_mind, 'gen-match-kpi', 'sm', 903, jsonb_build_object(
      'schema','gp.card/v1','title','Match KPIs','viz','kpi',
      'scope', jsonb_build_object('level','squad'),
      'metrics', jsonb_build_array(jsonb_build_object('id','total_distance','agg','total','kind','accum','unit','m')),
      'range', jsonb_build_object('type','season'), 'comparison', null,
      'style', jsonb_build_object('size','sm','color','#15803D','palette','pitch','axes',true,'legend',true,'dataLabels',false))),
    (d_mind, 'mp-td', 'full', 904, jsonb_build_object(
      'schema','gp.card/v1','title','Match metric','viz','bars',
      'scope', jsonb_build_object('level','squad'),
      'metrics', jsonb_build_array(
        jsonb_build_object('id','total_distance','agg','avg'),
        jsonb_build_object('id','time_played','agg','avg','line',true)),
      'dimensions', jsonb_build_array(jsonb_build_object('id','session_date')),
      'range', jsonb_build_object('type','season'), 'comparison', null,
      'style', jsonb_build_object('size','full','color','#15803D','palette','pitch','axes',true,'legend',true,'dataLabels',false,'orientation','vertical','stacked',false))),
    (d_mind, 'mp-hi', 'full', 905, jsonb_build_object(
      'schema','gp.card/v1','title','Velocity zones','viz','bars',
      'scope', jsonb_build_object('level','squad'),
      'metrics', jsonb_build_array(
        jsonb_build_object('id','high_speed_distance','agg','avg'),
        jsonb_build_object('id','very_high_speed_distance','agg','avg'),
        jsonb_build_object('id','sprint_distance','agg','avg')),
      'dimensions', jsonb_build_array(jsonb_build_object('id','session_date')),
      'range', jsonb_build_object('type','season'), 'comparison', null,
      'style', jsonb_build_object('size','full','color','#15803D','palette','pitch','axes',true,'legend',true,'dataLabels',false,'orientation','vertical','stacked',true))),
    -- ── Microcycle Compare ─────────────────────────────────────────────────
    -- La tabla de MC va SIN microciclo de referencia: hoy lo elige sola (el anterior al actual) y
    -- congelar aquí un id la dejaría comparando para siempre contra un microciclo viejo. Se elige
    -- desde la card, que es donde se ve contra qué se está comparando.
    (d_mc, 'mc-table', 'full', 906, jsonb_build_object(
      'schema','gp.card/v1','title','MC diff table','viz','table',
      'scope', jsonb_build_object('level','squad'),
      'metrics', jsonb_build_array(
        jsonb_build_object('id','total_distance','agg','avg','format', jsonb_build_object('mode','heat','dir','high','dec',1,'heatScale','ryg','iconStyle','dot')),
        jsonb_build_object('id','high_speed_distance','agg','avg','format', jsonb_build_object('mode','heat','dir','high','dec',1,'heatScale','ryg','iconStyle','dot')),
        jsonb_build_object('id','sprint_distance','agg','avg','format', jsonb_build_object('mode','heat','dir','high','dec',1,'heatScale','ryg','iconStyle','dot')),
        jsonb_build_object('id','player_load','agg','avg','format', jsonb_build_object('mode','heat','dir','high','dec',1,'heatScale','ryg','iconStyle','dot')),
        jsonb_build_object('id','sprint_count','agg','avg','format', jsonb_build_object('mode','heat','dir','high','dec',1,'heatScale','ryg','iconStyle','dot'))),
      'dimensions', jsonb_build_array(jsonb_build_object('id','player_name')),
      'range', jsonb_build_object('type','mc'), 'comparison', null,
      'style', jsonb_build_object('size','full','color','#15803D'))),
    (d_mc, 'mc-monotony', 'md', 907, jsonb_build_object(
      'schema','gp.card/v1','title','Monotonía','viz','monotonia',
      'scope', jsonb_build_object('level','squad'),
      'metrics', jsonb_build_array(jsonb_build_object('id','player_load','agg','total','kind','accum','unit','AU')),
      'range', jsonb_build_object('type','w30'), 'comparison', null, 'dimensions', jsonb_build_array(),
      'style', jsonb_build_object('size','md','color','#15803D','palette','pitch','metricFollow',false)))
  ) as d(dash, clasica, size, pos, cfg)
  where d.dash is not null
    -- Idempotente: si la migración se reintenta, no duplica cards.
    and not exists (select 1 from gps_migracion_cards_191 m
                    where m.club_id = v_club and m.card_clasica = d.clasica);

  -- Anotar el mapeo leyendo lo recién insertado por su posición sentinela (900-907).
  insert into gps_migracion_cards_191 (club_id, card_clasica, card_nueva, dashboard_id)
  select v_club,
         case c.position
           when 900 then 'gen-week-kpi'      when 901 then 'acwr'
           when 902 then 'gen-session-table' when 903 then 'gen-match-kpi'
           when 904 then 'mp-td'             when 905 then 'mp-hi'
           when 906 then 'mc-table'          when 907 then 'mc-monotony'
         end,
         c.id, c.dashboard_id
  from dashboard_cards c
  join dashboards d on d.id = c.dashboard_id
  where d.club_id = v_club and c.position between 900 and 907
    and not exists (select 1 from gps_migracion_cards_191 m where m.card_nueva = c.id);
end $$;
