/* =============================================================
   gp-persist.js — dashboard & card CRUD over Supabase JS.
   Tables: dashboards, dashboard_cards (both created in migration 038).
   No backend required: all calls go through window.sb.
   ============================================================= */

(function () {
  'use strict';

  // ── Default dashboard definitions (backfill) ──────────────────────────

  const DEFAULT_DASHBOARDS = [
    {
      report_type: 'ind',
      name: 'Player Week Report',
      scope: 'player',
      sort_order: 0,
      cards: [
        _card('kpi',  [{ id:'total_distance', agg:'total', kind:'accum', unit:'m' }],     'mc',     'player', 'md', 'md', { size:'sm' }, 'Total distance'),
        _card('kpi',  [{ id:'max_speed',      agg:'max',   kind:'peak',  unit:'km/h' }],  'mc',     'player', 'md', 'md', { size:'sm' }, 'Max speed'),
        _card('kpi',  [{ id:'player_load',    agg:'total', kind:'accum', unit:'AU' }],    'mc',     'player', 'md', 'md', { size:'sm' }, 'Player load'),
        _card('line', [{ id:'total_distance', agg:'total', kind:'accum', unit:'m' }],    'w30',    'player', 'md', 'none', { size:'full' }, 'Distance trend'),
        _card('radar',[
          { id:'total_distance',      agg:'avg', kind:'accum', unit:'m' },
          { id:'high_speed_distance', agg:'avg', kind:'accum', unit:'m' },
          { id:'sprint_distance',     agg:'avg', kind:'accum', unit:'m' },
          { id:'player_load',         agg:'avg', kind:'accum', unit:'AU' },
          { id:'max_speed',           agg:'avg', kind:'peak',  unit:'km/h' },
          { id:'accelerations',       agg:'avg', kind:'accum', unit:'n' },
        ], 'season', 'player', 'lg', 'role', { size:'lg' }, 'Physical profile'),
      ],
    },
    {
      report_type: 'grp',
      name: 'Session Control',
      scope: 'squad',
      sort_order: 1,
      cards: [
        _card('bars',   [{ id:'total_distance', agg:'total', kind:'accum', unit:'m' },
                          { id:'player_load',   agg:'total', kind:'accum', unit:'AU' }], 'w7', 'squad', 'full', 'none', { size:'full' }, 'Session load by player'),
        _card('ranking',[{ id:'player_load',    agg:'total', kind:'accum', unit:'AU' }], 'w7', 'squad', 'md',   'none', { size:'md' }, 'Load ranking'),
        _card('heatmap',[
          { id:'total_distance',      agg:'total', kind:'accum', unit:'m' },
          { id:'high_speed_distance', agg:'total', kind:'accum', unit:'m' },
          { id:'player_load',         agg:'total', kind:'accum', unit:'AU' },
          { id:'sprint_count',        agg:'total', kind:'accum', unit:'n' },
          { id:'accelerations',       agg:'total', kind:'accum', unit:'n' },
          { id:'max_speed',           agg:'max',   kind:'peak',  unit:'km/h' },
        ], 'w7', 'squad', 'full', 'role', { size:'full' }, 'Squad z-matrix'),
      ],
    },
    {
      report_type: 'mind',
      name: 'Match Performance',
      scope: 'player',
      sort_order: 2,
      cards: [
        _card('radar',[
          { id:'total_distance',      agg:'avg', kind:'accum', unit:'m' },
          { id:'high_speed_distance', agg:'avg', kind:'accum', unit:'m' },
          { id:'sprint_count',        agg:'avg', kind:'accum', unit:'n' },
          { id:'player_load',         agg:'avg', kind:'accum', unit:'AU' },
          { id:'accelerations',       agg:'avg', kind:'accum', unit:'n' },
          { id:'max_speed',           agg:'max', kind:'peak',  unit:'km/h' },
        ], 'season', 'player', 'lg', 'role', { size:'lg' }, 'Match physical profile'),
        _card('scatter',[
          { id:'player_load',         agg:'avg', kind:'accum', unit:'AU' },
          { id:'high_speed_distance', agg:'avg', kind:'accum', unit:'m' },
        ], 'season', 'squad', 'md', 'none', { size:'md' }, 'Load vs HSR'),
      ],
    },
    {
      report_type: 'mgrp',
      name: 'Load Monitoring',
      scope: 'player',
      sort_order: 3,
      cards: [
        _card('line',   [{ id:'player_load', agg:'total', kind:'accum', unit:'AU' }],    'w30', 'player', 'full', 'none', { size:'full', color:'#D97706', palette:'heat' }, 'Load trend (30d)'),
        _card('ranking',[{ id:'player_load', agg:'total', kind:'accum', unit:'AU' }],    'mc',  'squad',  'md',   'role', { size:'md' }, 'MC load ranking'),
      ],
    },
    {
      report_type: 'mc',
      name: 'Microcycle Compare',
      scope: 'squad',
      sort_order: 4,
      cards: [
        _card('heatmap',[
          { id:'total_distance',      agg:'total', kind:'accum', unit:'m' },
          { id:'high_speed_distance', agg:'total', kind:'accum', unit:'m' },
          { id:'player_load',         agg:'total', kind:'accum', unit:'AU' },
          { id:'sprint_count',        agg:'total', kind:'accum', unit:'n' },
          { id:'accelerations',       agg:'total', kind:'accum', unit:'n' },
          { id:'max_speed',           agg:'max',   kind:'peak',  unit:'km/h' },
        ], 'mc', 'squad', 'full', 'role', { size:'full' }, 'Squad z-matrix'),
        _card('bars',[
          { id:'total_distance',      agg:'total', kind:'accum', unit:'m' },
          { id:'high_speed_distance', agg:'total', kind:'accum', unit:'m' },
        ], 'mc', 'squad', 'full', 'md', { size:'full' }, 'MC totals vs prev'),
      ],
    },
  ];

  /** Build a minimal gp.card/v1 config object. */
  function _card(viz, metrics, rangeType, scope, size, compare, styleOverrides, title) {
    return {
      schema: 'gp.card/v1',
      title,
      viz,
      scope: { level: scope },
      metrics,
      range:      { type: rangeType },
      comparison: compare === 'none' ? null : { baseline: compare },
      style: Object.assign({ size: size || 'md', color:'#15803D', palette:'pitch', axes:true, legend:true, dataLabels:false }, styleOverrides || {}),
    };
  }

  // ── Public API ────────────────────────────────────────────────────────

  /**
   * Creates default dashboards + cards for a club if they don't exist yet.
   * Idempotent: checks first, only inserts if missing.
   *
   * @param {string} clubId
   * @param {string} userId
   * @param {object} sb  Supabase client
   */
  window.ensureDefaultDashboards = async function (clubId, userId, sb) {
    if (!clubId || !sb) return;
    try {
      const { data: existing } = await sb
        .from('dashboards')
        .select('report_type')
        .eq('club_id', clubId);

      const existingTypes = new Set((existing || []).map(d => d.report_type));

      for (const def of DEFAULT_DASHBOARDS) {
        if (existingTypes.has(def.report_type)) continue;

        const { data: dash, error: dashErr } = await sb
          .from('dashboards')
          .insert({
            club_id:     clubId,
            report_type: def.report_type,
            name:        def.name,
            scope:       def.scope,
            sort_order:  def.sort_order,
            is_shared:   true,
            created_by:  userId || null,
          })
          .select('id')
          .single();

        if (dashErr || !dash) { console.warn('ensureDefaultDashboards insert dash:', dashErr?.message); continue; }

        const cardRows = def.cards.map((config, i) => ({
          dashboard_id: dash.id,
          config,
          size:       config.style.size || 'md',
          position:   i,
          source:     'catalog',
          created_by: userId || null,
        }));

        const { error: cardErr } = await sb.from('dashboard_cards').insert(cardRows);
        if (cardErr) console.warn('ensureDefaultDashboards insert cards:', cardErr.message);
      }
    } catch (e) {
      console.warn('ensureDefaultDashboards failed:', e);
    }
  };

  /**
   * Loads all dashboards for a club, ordered by sort_order.
   * Returns [ { id, report_type, name, scope, sort_order, cards:[] } ]
   *
   * @param {string} clubId
   * @param {object} sb
   * @returns {Promise<object[]>}
   */
  window.loadDashboards = async function (clubId, sb) {
    const { data: dashes, error: dErr } = await sb
      .from('dashboards')
      .select('id, report_type, name, scope, sort_order, is_shared, created_by')
      .eq('club_id', clubId)
      .order('sort_order', { ascending: true });

    if (dErr) throw new Error(`loadDashboards: ${dErr.message}`);
    if (!dashes?.length) return [];

    const dashIds = dashes.map(d => d.id);
    const { data: cards, error: cErr } = await sb
      .from('dashboard_cards')
      .select('id, dashboard_id, config, size, position, source, created_by')
      .in('dashboard_id', dashIds)
      .order('position', { ascending: true });

    if (cErr) throw new Error(`loadDashboards cards: ${cErr.message}`);

    const cardsByDash = {};
    for (const c of cards || []) {
      if (!cardsByDash[c.dashboard_id]) cardsByDash[c.dashboard_id] = [];
      cardsByDash[c.dashboard_id].push(c);
    }

    return dashes.map(d => ({ ...d, cards: cardsByDash[d.id] || [] }));
  };

  /**
   * Returns dashboard_cards for a specific report_type in this club,
   * or null if no dashboard row exists for that type.
   *
   * @param {string} clubId
   * @param {string} reportType
   * @param {object} sb
   * @returns {Promise<object[]|null>}
   */
  window.loadCardsForView = async function (clubId, reportType, sb) {
    const { data: dash } = await sb
      .from('dashboards')
      .select('id')
      .eq('club_id', clubId)
      .eq('report_type', reportType)
      .maybeSingle();

    if (!dash) return null;

    const { data: cards, error } = await sb
      .from('dashboard_cards')
      .select('id, config, size, position, source')
      .eq('dashboard_id', dash.id)
      .order('position', { ascending: true });

    if (error) throw new Error(`loadCardsForView: ${error.message}`);
    return cards || [];
  };

  /**
   * Saves a new card to a dashboard. Creates the dashboard if needed.
   *
   * @param {object} config   gp.card/v1 object
   * @param {string} clubId
   * @param {string} reportType   current view ('ind','grp','mind','mgrp','mc')
   * @param {string} userId
   * @param {object} sb
   * @returns {Promise<string>} new card id
   */
  window.saveDashboardCard = async function (config, clubId, reportType, userId, sb) {
    // get or create dashboard for this reportType
    let { data: dash } = await sb
      .from('dashboards')
      .select('id')
      .eq('club_id', clubId)
      .eq('report_type', reportType)
      .maybeSingle();

    if (!dash) {
      const viewName = { ind:'Player Week Report', grp:'Session Control', mind:'Match Performance', mgrp:'Load Monitoring', mc:'Microcycle Compare' };
      const { data: newDash, error: dErr } = await sb
        .from('dashboards')
        .insert({
          club_id:     clubId,
          report_type: reportType,
          name:        viewName[reportType] || reportType,
          scope:       config.scope?.level || 'player',
          is_shared:   true,
          created_by:  userId || null,
        })
        .select('id')
        .single();
      if (dErr) throw new Error(`saveDashboardCard create dash: ${dErr.message}`);
      dash = newDash;
    }

    // get current max position
    const { data: maxRow } = await sb
      .from('dashboard_cards')
      .select('position')
      .eq('dashboard_id', dash.id)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle();

    const position = (maxRow?.position ?? -1) + 1;

    const { data: card, error: cErr } = await sb
      .from('dashboard_cards')
      .insert({
        dashboard_id: dash.id,
        config,
        size:       config.style?.size || 'md',
        position,
        source:     'builder',
        created_by: userId || null,
      })
      .select('id')
      .single();

    if (cErr) throw new Error(`saveDashboardCard: ${cErr.message}`);
    return card.id;
  };

  /**
   * Updates config (and size) of an existing card.
   *
   * @param {string} cardId
   * @param {object} config  gp.card/v1 object
   * @param {object} sb
   */
  window.updateDashboardCard = async function (cardId, config, sb) {
    const { error } = await sb
      .from('dashboard_cards')
      .update({ config, size: config.style?.size || 'md', updated_at: new Date().toISOString() })
      .eq('id', cardId);
    if (error) throw new Error(`updateDashboardCard: ${error.message}`);
  };

  /**
   * Deletes a card from a dashboard.
   *
   * @param {string} cardId
   * @param {object} sb
   */
  window.deleteDashboardCard = async function (cardId, sb) {
    const { error } = await sb.from('dashboard_cards').delete().eq('id', cardId);
    if (error) throw new Error(`deleteDashboardCard: ${error.message}`);
  };

  // ── Dashboard management (Fase 3) ────────────────────────────────────

  /**
   * Creates a new blank dashboard.
   * @param {string} name
   * @param {string} clubId
   * @param {string} userId
   * @param {object} sb
   * @returns {Promise<{id:string, name:string, sort_order:number}>}
   */
  window.createDashboard = async function (name, clubId, userId, sb) {
    // get max sort_order
    const { data: last } = await sb
      .from('dashboards')
      .select('sort_order')
      .eq('club_id', clubId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    const sort_order = (last?.sort_order ?? -1) + 1;

    const { data, error } = await sb
      .from('dashboards')
      .insert({ club_id: clubId, name, sort_order, is_shared: false, created_by: userId || null })
      .select('id, name, sort_order')
      .single();

    if (error) throw new Error(`createDashboard: ${error.message}`);
    return data;
  };

  /**
   * Renames a dashboard.
   * @param {string} dashId
   * @param {string} name
   * @param {object} sb
   */
  window.renameDashboard = async function (dashId, name, sb) {
    const { error } = await sb
      .from('dashboards')
      .update({ name, updated_at: new Date().toISOString() })
      .eq('id', dashId);
    if (error) throw new Error(`renameDashboard: ${error.message}`);
  };

  /**
   * Duplicates a dashboard and all its cards.
   * @param {string} dashId
   * @param {string} clubId
   * @param {string} userId
   * @param {object} sb
   * @returns {Promise<{id:string, name:string}>}
   */
  window.duplicateDashboard = async function (dashId, clubId, userId, sb) {
    // load source
    const { data: src, error: sErr } = await sb
      .from('dashboards')
      .select('name, scope, report_type, sort_order')
      .eq('id', dashId)
      .single();
    if (sErr) throw new Error(`duplicateDashboard load: ${sErr.message}`);

    const { data: srcCards } = await sb
      .from('dashboard_cards')
      .select('config, size, position, source')
      .eq('dashboard_id', dashId)
      .order('position', { ascending: true });

    // create new dashboard right after the source
    const { data: last } = await sb
      .from('dashboards')
      .select('sort_order')
      .eq('club_id', clubId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: newDash, error: dErr } = await sb
      .from('dashboards')
      .insert({
        club_id:    clubId,
        name:       src.name + ' copy',
        scope:      src.scope,
        sort_order: (last?.sort_order ?? 0) + 1,
        is_shared:  false,
        created_by: userId || null,
      })
      .select('id, name')
      .single();
    if (dErr) throw new Error(`duplicateDashboard create: ${dErr.message}`);

    if (srcCards?.length) {
      const rows = srcCards.map(c => ({
        dashboard_id: newDash.id,
        config:   c.config,
        size:     c.size,
        position: c.position,
        source:   c.source,
        created_by: userId || null,
      }));
      await sb.from('dashboard_cards').insert(rows);
    }
    return newDash;
  };

  /**
   * Deletes a dashboard and all its cards (CASCADE handles cards).
   * @param {string} dashId
   * @param {object} sb
   */
  window.deleteDashboard = async function (dashId, sb) {
    // Explicitly delete cards first (belt-and-suspenders for CASCADE)
    const { error: cardErr } = await sb.from('dashboard_cards').delete().eq('dashboard_id', dashId);
    if (cardErr) throw new Error(`deleteDashboard cards: ${cardErr.message}`);
    const { error } = await sb.from('dashboards').delete().eq('id', dashId);
    if (error) throw new Error(`deleteDashboard: ${error.message}`);
  };

  /**
   * Persists the new card order for a dashboard.
   * @param {{ id:string, position:number }[]} orderedCards
   * @param {object} sb
   */
  window.reorderCards = async function (orderedCards, sb) {
    // batch update — one upsert per card
    const rows = orderedCards.map(c => ({ id: c.id, position: c.position }));
    const { error } = await sb
      .from('dashboard_cards')
      .upsert(rows, { onConflict: 'id' });
    if (error) throw new Error(`reorderCards: ${error.message}`);
  };

  /**
   * Returns the dashboard row for a given club + reportType, or null.
   * @param {string} clubId
   * @param {string} reportType
   * @param {object} sb
   * @returns {Promise<{id:string,name:string}|null>}
   */
  window.getDashboardByReportType = async function (clubId, reportType, sb) {
    const { data } = await sb
      .from('dashboards')
      .select('id, name, sort_order')
      .eq('club_id', clubId)
      .eq('report_type', reportType)
      .maybeSingle();
    return data || null;
  };

})();
