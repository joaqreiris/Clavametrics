// ClavaMetrics — Panel de integración GPS (Catapult/StatSports), COMPARTIDO.
// Extraído de Admin.html para montarse también en GPS Analysis → Data sources.
// Uso:  window.cmMountGpsIntegrations(hostEl, { canConfig, canConnect })
//   · canConfig  = región/verificar/mapear métricas/mapear atletas/sync (admin + S&C)
//   · canConnect = cargar/borrar el TOKEN de la API (connect/disconnect) — admin-only
// Deps (globales): window.sb, tt(), window.getClubId, window.cmToday, window.cmFetchAll,
//   window.CMDateRange (assets/cm-daterange.js), window.CMGpsMatch + cmNormalizePosition
//   (assets/gps-matcher.js). CSS: assets/gps-integrations.css.
window.cmMountGpsIntegrations = function (hostEl, opts) {
  opts = opts || {};
  const canConfig  = opts.canConfig  !== false;   // por defecto true (Admin)
  const canConnect = opts.canConnect !== false;   // por defecto true (Admin)
  const PROVIDERS = [
    { slug:'catapult', name:'Catapult (OpenField)',
      hintKey:'admin.gps_hint_catapult', hintEN:'In OpenField Cloud → Settings → API Tokens, create a token and paste it here. You may need to enable the "API Token Admin" module via Catapult support first.',
      acctKey:'admin.gps_acct_catapult', acctEN:'OpenField account / team ID (optional)' },
    { slug:'statsports', name:'StatSports (Sonra)',
      hintKey:'admin.gps_hint_statsports', hintEN:'Ask your StatSports account manager to enable the Third-Party API for ClavaMetrics and give you the API key, then paste it here.',
      acctKey:'admin.gps_acct_statsports', acctEN:'StatSports Team ID (optional)' },
  ];
  let CLUB_ID = null, INTS = {};

  async function getClubId(){
    if (CLUB_ID) return CLUB_ID;
    const { data: u } = await window.sb.auth.getUser();
    const { data } = await window.sb.from('profiles').select('club_id').eq('id', u.user.id).single();
    CLUB_ID = data?.club_id || null; return CLUB_ID;
  }
  async function load(){
    try {
      const { data } = await window.sb.from('gps_integrations').select('id, provider, status, external_account_id, config');
      INTS = {}; (data||[]).forEach(r => INTS[r.provider] = r);
    } catch(e){ INTS = {}; }
    render();
    _hydrateSyncJobs();   // resume the progress bar if a sync is running / recently finished
  }
  function msg(prov,t,err){ const el=document.querySelector(`[data-msg="${prov}"]`); if(el){ el.textContent=t; el.style.color=err?'var(--cm-danger)':'var(--cm-fg-muted)'; } }
  function render(){
    const host = hostEl; if(!host) return;
    host.innerHTML = PROVIDERS.map(p=>{
      const row=INTS[p.slug], status=row?.status||'not_connected';
      const isSet=(status==='configured'||status==='connected');  // hay credencial guardada
      const bc=status==='connected'?'s-connected':(status==='configured'?'s-pending':(status==='error'?'s-error':(status==='disabled'?'s-disabled':'s-pending')));
      const bt=status==='connected'?tt('admin.gps_connected','Connected'):(status==='configured'?tt('admin.gps_configured','Configured'):(status==='error'?tt('common.error','Error'):(status==='disabled'?tt('admin.gps_disabled','Disabled'):tt('admin.gps_not_connected','Not connected'))));
      return `<div class="gps-int-card">
        <div class="gps-int-head"><h3>${p.name}</h3><span class="gps-int-badge ${bc}">${bt}</span></div>
        <div class="gps-int-hint">${tt(p.hintKey,p.hintEN)}</div>
        ${isSet
          ? `${canConfig && p.slug==='catapult' ? (()=>{ const rg=(row?.config||{}).region||''; return `<div class="gps-int-form" style="margin-bottom:10px">
                 <label style="font-size:11.5px;color:var(--cm-fg-muted)">${tt('admin.gps_region','Region')}</label>
                 <select data-field="region" data-prov="${p.slug}" style="padding:8px 10px;border:1px solid var(--cm-border);border-radius:8px;background:var(--cm-bg);color:var(--cm-fg-strong);font:inherit">
                   <option value="" ${rg?'':'selected'} disabled>${tt('admin.gps_select_region','Select region…')}</option>
                   <option value="au" ${rg==='au'?'selected':''}>Asia-Pacific (AU)</option>
                   <option value="us" ${rg==='us'?'selected':''}>North America (US)</option>
                   <option value="eu" ${rg==='eu'?'selected':''}>Europe / MEA / LATAM (EU)</option>
                 </select>
                 <button class="gps-int-btn" data-act="verify" data-prov="${p.slug}">${tt('admin.gps_verify_connection','Verify connection')}</button>
                 ${status==='connected' ? `<button class="gps-int-btn ghost" data-act="map" data-prov="${p.slug}">${tt('admin.gps_map_athletes','Map athletes')}</button>
                 <button class="gps-int-btn ghost" data-act="mapmetrics" data-prov="${p.slug}">${tt('admin.gps_map_metrics','Map metrics')}</button>
                 <div style="display:flex;gap:8px;align-items:center;margin-top:6px;flex-wrap:wrap">
                   <span style="font-size:11.5px;color:var(--cm-fg-muted)">${tt('admin.gps_range','Range')}</span>
                   <span data-daterange data-prov="${p.slug}"></span>
                   <button class="gps-int-btn" data-act="sync" data-prov="${p.slug}">${tt('admin.gps_sync_now','Sync now')}</button>
                 </div>
                 <div class="gps-sync-bar" data-syncbar="${p.slug}" style="display:none"></div>` : ''}
               </div>` })() : ''}
             ${canConnect ? `<button class="gps-int-btn ghost" data-act="disconnect" data-prov="${p.slug}">${tt('admin.gps_disconnect','Disconnect')}</button>` : ''}
             ${p.slug==='catapult' ? '' : `<div style="font-size:11.5px;color:var(--cm-fg-muted);margin-top:8px">${tt('admin.gps_creds_saved','Credentials saved · verification pending')}</div>`}`
          : (canConnect ? `<div class="gps-int-form">
               <input type="text" placeholder="${tt(p.acctKey,p.acctEN)}" data-field="account" data-prov="${p.slug}" value="${row?.external_account_id||''}">
               <input type="password" placeholder="${tt('admin.gps_api_token_ph','API token / key')}" data-field="token" data-prov="${p.slug}" autocomplete="off">
               <button class="gps-int-btn" data-act="connect" data-prov="${p.slug}">${tt('admin.gps_connect','Connect')}</button>
             </div>` : `<div class="gps-int-hint" style="margin-top:6px">${tt('admin.gps_ask_admin_connect','Ask an admin to connect the provider (API token).')}</div>`)}
        <div class="gps-int-msg" data-msg="${p.slug}"></div></div>`;
    }).join('');
    host.querySelectorAll('[data-act="connect"]').forEach(b=>b.addEventListener('click',()=>connect(b.dataset.prov)));
    host.querySelectorAll('[data-act="disconnect"]').forEach(b=>b.addEventListener('click',()=>disconnect(b.dataset.prov)));
    host.querySelectorAll('[data-act="verify"]').forEach(b=>b.addEventListener('click',()=>verify(b.dataset.prov)));
    host.querySelectorAll('[data-act="map"]').forEach(b=>b.addEventListener('click',()=>mapAthletes(b.dataset.prov)));
    host.querySelectorAll('[data-act="sync"]').forEach(b=>b.addEventListener('click',()=>syncNow(b.dataset.prov)));
    host.querySelectorAll('[data-act="mapmetrics"]').forEach(b=>b.addEventListener('click',()=>mapMetrics(b.dataset.prov)));
    host.querySelectorAll('[data-field="region"]').forEach(s=>s.addEventListener('change',()=>setRegion(s.dataset.prov,s.value)));
    // Mount the reusable date-range picker per provider (default last 30 days).
    // Pass the active club so the picker offers this club's real seasons.
    _dr={};
    window.getClubId().then(cid=>{
      host.querySelectorAll('[data-daterange]').forEach(el=>{
        const _today=new Date(), _ago30=new Date(Date.now()-30*86400*1000);
        const isoD=d=>d.toISOString().slice(0,10);
        _dr[el.dataset.prov]=window.CMDateRange.mount(el,{ from:isoD(_ago30), to:isoD(_today), presets:true, clubId:cid });
      });
    });
    _paintAllSync();   // repaint any known sync-job progress into the freshly rendered cards
  }
  let _dr={};
  async function setRegion(prov,region){
    const intId=INTS[prov]?.id; if(!intId||!region) return;
    msg(prov,tt('admin.gps_saving_region','Saving region…'));
    try{
      const cfg=Object.assign({},INTS[prov]?.config||{},{ region });
      const { error }=await window.sb.from('gps_integrations').update({ config:cfg }).eq('id',intId);
      if(error) throw error;
      INTS[prov].config=cfg; msg(prov,tt('admin.gps_region_saved','Region saved.'));
    }catch(e){ msg(prov,tt('admin.gps_failed_x','Failed: {msg}',{ msg:(e.message||e) }),true); }
  }
  async function verify(prov){
    const intId=INTS[prov]?.id; if(!intId) return;
    if(!(INTS[prov]?.config||{}).region){ msg(prov,tt('admin.gps_select_region_first','Select a region first.'),true); return; }
    msg(prov,tt('admin.gps_verifying','Verifying connection…'));
    try{
      const { data, error }=await window.sb.functions.invoke('gps-verify',{ body:{ integration_id:intId } });
      if(error) throw error;
      if(data?.ok){ msg(prov,tt('admin.gps_connected_found','Connected ✓ — {n} activities found.',{ n:data.activity_count })); }
      else if(data?.status==='error'){ msg(prov,tt('admin.gps_verify_failed','Verification failed{http}.',{ http:(data.http_status?' (HTTP '+data.http_status+')':'') }),true); }
      else { msg(prov,data?.message||tt('admin.gps_could_not_verify','Could not verify.'),true); }
      await load();
    }catch(e){ msg(prov,tt('admin.gps_failed_x','Failed: {msg}',{ msg:(e.message||e) }),true); }
  }
  async function connect(prov){
    const token=document.querySelector(`[data-field="token"][data-prov="${prov}"]`)?.value.trim();
    const account=document.querySelector(`[data-field="account"][data-prov="${prov}"]`)?.value.trim();
    if(!token){ msg(prov,tt('admin.gps_paste_token','Paste your API token first.'),true); return; }
    msg(prov,tt('admin.gps_connecting','Connecting…'));
    try{
      let intId=INTS[prov]?.id;
      if(!intId){
        const clubId=await getClubId(); if(!clubId) throw new Error(tt('admin.no_club_found','No club found'));
        const { data, error }=await window.sb.from('gps_integrations')
          .insert({ club_id:clubId, provider:prov, status:'pending', external_account_id:account||null })
          .select('id').single();
        if(error) throw error; intId=data.id;
      } else if(account){ await window.sb.from('gps_integrations').update({ external_account_id:account }).eq('id',intId); }
      const { error:e2 }=await window.sb.rpc('set_gps_credential',{ p_integration_id:intId, p_credential:token });
      if(e2) throw e2;
      msg(prov,tt('admin.gps_connected_ok','Connected ✓')); await load();
    }catch(e){ msg(prov,tt('admin.gps_failed_x','Failed: {msg}',{ msg:(e.message||e) }),true); }
  }
  // ── Map metrics (Catapult parameters → gps_column_mappings, source 'catapult') ──
  // Mirrors the CSV "Match columns" model: each parameter maps to a core
  // gps_reports column OR a gps_metric_definitions key (custom), with an
  // editable unit_conversion. Storage = gps_column_mappings (same table).
  const GPS_REPORT_COLS=['total_distance','high_speed_distance','very_high_speed_distance','sprint_distance','accelerations','decelerations','max_speed','player_load','avg_speed','hmld','time_played','sprint_count','distance_per_minute'];
  const METRIC_CATS=['distance','speed','acceleration','load','time','count','custom'];
  // Same auto-seed defaults as gps-sync SLUG_MAP — to pre-fill before first sync.
  // ⚠️ ESPEJO EXACTO de SLUG_MAP en supabase/functions/gps-sync/index.ts. Si divergen,
  // este modal PISA la DB al guardar (upsert de todas las filas) y rompe la ingesta.
  // Pasó con total_distance: el Edge Function se corrigió a conv 1 (metros, la unidad
  // canónica de gps-units.js) y esta semilla quedó en 1/1000 → sembraba km y todo club
  // que abriera "Mapear métricas" nacía con la distancia total dividida por 1000.
  const CM_SLUG_SEED={ total_distance:['total_distance',1], total_high_speed_distance:['high_speed_distance',1],
    total_very_high_speed_distance:['very_high_speed_distance',1], total_sprint_distance:['sprint_distance',1],
    total_high_metabolic_load_distance:['hmld',1], meterage_per_minute:['distance_per_minute',1],
    total_player_load:['player_load',1], max_velocity:['max_speed',3.6], mean_velocity:['avg_speed',3.6],
    acceleration_count:['accelerations',1], deceleration_count:['decelerations',1], sprint_count:['sprint_count',1],
    duration:['time_played',1/60] };

  async function mapMetrics(prov){
    const intId=INTS[prov]?.id; if(!intId) return;
    msg(prov,tt('admin.gps_loading_params','Loading parameters…'));
    let params, mappings, defs;
    try{
      // Guard against a silently-expired session BEFORE loading: with auth.uid() null,
      // RLS returns 0 rows (no error), so mappings would look "empty" and the next Save
      // would overwrite the real ones with __ignore__. Refuse to open the modal instead.
      const { data:{ user:_u } }=await window.sb.auth.getUser();
      if(!_u){ msg(prov,tt('admin.gps_session_expired','Session expired — please refresh the page.'),true); return; }
      const { data, error }=await window.sb.functions.invoke('gps-parameters',{ body:{ integration_id:intId } });
      if(error) throw error;
      if(!data?.ok){ msg(prov, data?.message || (data?.http_status?tt('admin.gps_provider_error_http','Provider error (HTTP {n})',{ n:data.http_status }):tt('admin.gps_could_not_load_params','Could not load parameters')), true); return; }
      params=data.parameters||[];
      // CRITICAL: page through ALL rows with cmFetchAll — a plain .select() is truncated to
      // ~1000 rows by PostgREST, so with 1647 params the tail loaded as "unmapped" and Save
      // then overwrote those saved mappings with __ignore__/seed ("mappings disconnected on
      // their own"). orderBy makes the ranges stable across pages (source_column_name is
      // unique per club+source_label; key is unique for metric defs).
      [mappings, defs]=await Promise.all([
        window.cmFetchAll(()=>window.sb.from('gps_column_mappings')
          .select('source_column_name,target_metric,unit_conversion').eq('source_label','catapult'),
          { orderBy:'source_column_name', label:'catapult_mappings' }),
        window.cmFetchAll(()=>window.sb.from('gps_metric_definitions')
          .select('key,label,is_core'), { orderBy:'key', label:'gps_metric_defs' }),
      ]);
    }catch(e){ msg(prov,tt('admin.gps_failed_x','Failed: {msg}',{ msg:(e.message||e) }),true); return; }
    msg(prov,'');
    if(!params.length){ msg(prov,tt('admin.gps_no_params','No parameters returned by the Catapult account.')); return; }
    _openMetricsModal(prov, params, mappings, defs);
  }

  function _openMetricsModal(prov, params, mappings, defs){
    const bySlug={}; mappings.forEach(m=>{ bySlug[m.source_column_name]=m; });
    let custom=defs.filter(d=>!d.is_core).map(d=>({ key:d.key, label:d.label }));
    // Build per-param state: target ('' = ignore), conv. Pre-fill from existing
    // mapping, else from the auto-seed defaults, else Ignore.
    const rows=params.map(p=>{
      const ex=bySlug[p.slug], seed=CM_SLUG_SEED[p.slug];
      let target = ex ? (ex.target_metric==='__ignore__'?'':ex.target_metric) : (seed?seed[0]:'');
      let conv   = ex ? (ex.unit_conversion==null?1:+ex.unit_conversion) : (seed?seed[1]:1);
      return { p, target, conv, mapped:!!ex };
    });
    // Unmapped first (highlighted), then the rest.
    rows.sort((a,b)=>(a.mapped===b.mapped)?0:(a.mapped?1:-1));

    const ov=document.createElement('div');
    ov.style.cssText='position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:24px';
    ov.innerHTML=`<div style="background:var(--cm-bg);border:1px solid var(--cm-border);border-radius:14px;width:min(820px,100%);max-height:88vh;display:flex;flex-direction:column;overflow:hidden">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid var(--cm-border)">
        <h3 style="margin:0;font-size:16px">${tt('admin.gps_map_metrics_title','Map metrics — Catapult')}</h3>
        <button data-x="1" style="background:none;border:0;font-size:20px;line-height:1;color:var(--cm-fg-muted);cursor:pointer">&times;</button>
      </div>
      <div style="padding:10px 18px;border-bottom:1px solid var(--cm-border);font-size:12px;color:var(--cm-fg-muted);display:flex;align-items:center;justify-content:space-between;gap:10px">
        <span>${tt('admin.gps_map_metrics_hint','Map each Catapult parameter to a core metric or a custom one. Unmapped parameters are shown first.')}</span>
        <span data-counts style="white-space:nowrap;font-variant-numeric:tabular-nums"></span>
      </div>
      <div style="padding:10px 18px 0;display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <input data-search type="text" placeholder="${tt('admin.gps_search_metrics','Search metrics…')}" style="flex:1;min-width:180px;padding:8px 10px;border:1px solid var(--cm-border);border-radius:8px;background:var(--cm-bg);color:var(--cm-fg-strong);font:inherit">
        <div data-statefilter style="display:inline-flex;border:1px solid var(--cm-border);border-radius:8px;overflow:hidden;flex-shrink:0">
          <button type="button" data-sf="all" style="padding:7px 12px;border:0;border-right:1px solid var(--cm-border);background:transparent;color:var(--cm-fg-muted);font:inherit;font-size:12px;cursor:pointer">${tt('admin.gps_filter_all','All')}</button>
          <button type="button" data-sf="mapped" style="padding:7px 12px;border:0;border-right:1px solid var(--cm-border);background:transparent;color:var(--cm-fg-muted);font:inherit;font-size:12px;cursor:pointer">${tt('admin.gps_filter_mapped','Mapped')}</button>
          <button type="button" data-sf="unmapped" style="padding:7px 12px;border:0;background:transparent;color:var(--cm-fg-muted);font:inherit;font-size:12px;cursor:pointer">${tt('admin.gps_filter_unmapped','Unmapped')}</button>
        </div>
      </div>
      <div data-list style="overflow:auto;padding:6px 18px"></div>
      <div data-newpanel style="display:none;padding:12px 18px;border-top:1px solid var(--cm-border);background:var(--cm-bg-soft)"></div>
      <div style="padding:12px 18px;border-top:1px solid var(--cm-border);display:flex;justify-content:space-between;align-items:center">
        <span data-msg style="font-size:12px;color:var(--cm-fg-muted)"></span>
        <div style="display:flex;gap:8px">
          <button class="gps-int-btn ghost" data-x="1">${tt('common.cancel','Cancel')}</button>
          <button class="gps-int-btn" data-save="1">${tt('admin.gps_save_mappings','Save mappings')}</button>
        </div>
      </div></div>`;
    document.body.appendChild(ov);
    const listEl=ov.querySelector('[data-list]');
    const modalMsg=ov.querySelector('[data-msg]');

    function targetOptions(sel){
      const core=GPS_REPORT_COLS.map(c=>`<option value="${c}" ${sel===c?'selected':''}>${c}</option>`).join('');
      const cust=custom.map(c=>`<option value="${c.key}" ${sel===c.key?'selected':''}>${_esc(c.label)} (${c.key})</option>`).join('');
      return `<option value="" ${!sel?'selected':''}>${tt('admin.gps_ignore','— Ignore —')}</option>
        <optgroup label="${tt('admin.gps_core_columns','Core columns')}">${core}</optgroup>
        ${cust?`<optgroup label="${tt('admin.gps_custom_metrics','Custom metrics')}">${cust}</optgroup>`:''}
        <option value="__new__">${tt('admin.gps_create_new_metric_opt','+ Create new metric…')}</option>`;
    }
    // Mapping-status filter: 'all' | 'mapped' | 'unmapped'. Combines with text.
    // A row is "mapped" when its target select has a non-empty value (live).
    let stateFilter='all';
    function _updateCounts(){
      let m=0,u=0;
      listEl.querySelectorAll('[data-t]').forEach(sel=>{ sel.value!==''?m++:u++; });
      const c=ov.querySelector('[data-counts]'); if(c) c.textContent=tt('admin.gps_map_counts','{m} mapped · {u} unmapped',{ m, u });
    }
    function _applyFilter(){
      const q=(ov.querySelector('[data-search]').value||'').trim().toLowerCase();
      listEl.querySelectorAll('[data-search-row]').forEach(el=>{
        const sel=el.querySelector('[data-t]');
        const isMapped=!!(sel && sel.value!=='');
        const passText=(!q||el.dataset.searchRow.includes(q));
        const passState=(stateFilter==='all')||(stateFilter==='mapped'?isMapped:!isMapped);
        el.style.display=(passText&&passState)?'':'none';
      });
      _updateCounts();
    }
    const _sfWrap=ov.querySelector('[data-statefilter]');
    function _paintSF(){
      _sfWrap.querySelectorAll('[data-sf]').forEach(b=>{
        const on=b.dataset.sf===stateFilter;
        b.style.background=on?'var(--cm-accent,#2563eb)':'transparent';
        b.style.color=on?'#fff':'var(--cm-fg-muted)';
      });
    }
    _sfWrap.querySelectorAll('[data-sf]').forEach(b=>b.addEventListener('click',()=>{ stateFilter=b.dataset.sf; _paintSF(); _applyFilter(); }));
    _paintSF();
    function paint(){
      listEl.innerHTML=rows.map((r,i)=>`
        <div data-search-row="${_esc(((r.p.name||'')+' '+(r.p.slug||'')).toLowerCase())}" style="display:grid;grid-template-columns:1.5fr 1.6fr 90px;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid var(--cm-border)${r.mapped?'':';background:var(--cm-warning-bg,rgba(245,158,11,.06))'}">
          <div><div style="font:600 12px var(--cm-font-sans);color:var(--cm-fg)">${_esc(r.p.name||r.p.slug)}</div>
            <div style="font:400 10.5px var(--cm-font-mono);color:var(--cm-fg-muted)">${_esc(r.p.slug)}<span data-unmapped-tag style="display:${r.mapped?'none':''}"> · ${tt('admin.gps_unmapped','unmapped')}</span></div></div>
          <select data-t="${i}" style="padding:7px 9px;border:1px solid var(--cm-border);border-radius:8px;background:var(--cm-bg);color:var(--cm-fg-strong);font:inherit">${targetOptions(r.target)}</select>
          <input data-c="${i}" type="number" step="any" value="${r.conv}" title="unit conversion" style="padding:7px 8px;border:1px solid var(--cm-border);border-radius:8px;background:var(--cm-bg);color:var(--cm-fg-strong);font:inherit">
        </div>`).join('');
      listEl.querySelectorAll('[data-t]').forEach(s=>s.addEventListener('change',()=>{
        const i=+s.dataset.t;
        if(s.value==='__new__'){ s.value=rows[i].target; _showNewMetric(i); return; }
        rows[i].target=s.value;
        // Keep the per-row status live: r.mapped was set once at build time, so the
        // "· unmapped" tag + amber background went stale when a target was picked.
        rows[i].mapped=(s.value!=='');
        const rowEl=s.closest('[data-search-row]');
        if(rowEl){
          rowEl.style.background=rows[i].mapped?'':'var(--cm-warning-bg,rgba(245,158,11,.06))';
          const tag=rowEl.querySelector('[data-unmapped-tag]'); if(tag) tag.style.display=rows[i].mapped?'none':'';
        }
        _applyFilter();   // status may have changed → re-filter + refresh counts
      }));
      listEl.querySelectorAll('[data-c]').forEach(inp=>inp.addEventListener('input',()=>{ rows[+inp.dataset.c].conv=inp.value; }));
      _applyFilter();   // keep the current search applied across re-paints
    }
    ov.querySelector('[data-search]').addEventListener('input',_applyFilter);
    function _showNewMetric(rowIdx){
      const np=ov.querySelector('[data-newpanel]');
      np.style.display='';
      np.innerHTML=`<div style="font:600 12px var(--cm-font-sans);margin-bottom:8px">${tt('admin.gps_create_new_metric','Create new metric')}</div>
        <div style="display:grid;grid-template-columns:1.4fr .8fr 1fr;gap:8px;margin-bottom:8px">
          <input data-nm-label placeholder="${tt('admin.gps_metric_label_ph','Label (e.g. Explosive efforts)')}" style="padding:7px 9px;border:1px solid var(--cm-border);border-radius:8px;background:var(--cm-bg);color:var(--cm-fg-strong);font:inherit">
          <input data-nm-unit placeholder="${tt('admin.gps_metric_unit_ph','Unit (opt)')}" style="padding:7px 9px;border:1px solid var(--cm-border);border-radius:8px;background:var(--cm-bg);color:var(--cm-fg-strong);font:inherit">
          <select data-nm-cat style="padding:7px 9px;border:1px solid var(--cm-border);border-radius:8px;background:var(--cm-bg);color:var(--cm-fg-strong);font:inherit">${METRIC_CATS.map(c=>`<option value="${c}" ${c==='custom'?'selected':''}>${tt('admin.gps_cat_'+c, c)}</option>`).join('')}</select>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <button class="gps-int-btn" data-nm-create>${tt('common.create','Create')}</button>
          <button class="gps-int-btn ghost" data-nm-cancel>${tt('common.cancel','Cancel')}</button>
          <span data-nm-err style="font-size:11.5px;color:var(--cm-danger)"></span>
        </div>`;
      np.querySelector('[data-nm-cancel]').addEventListener('click',()=>{ np.style.display='none'; np.innerHTML=''; });
      np.querySelector('[data-nm-create]').addEventListener('click',async()=>{
        const label=np.querySelector('[data-nm-label]').value.trim();
        const unit=np.querySelector('[data-nm-unit]').value.trim()||null;
        const category=np.querySelector('[data-nm-cat]').value;
        const err=np.querySelector('[data-nm-err]');
        const key=label.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');
        if(!label){ err.textContent=tt('admin.gps_label_required','Label is required.'); return; }
        if(!/^[a-z][a-z0-9_]*$/.test(key)){ err.textContent=tt('admin.gps_key_invalid','Generated key "{key}" is invalid.',{ key }); return; }
        if(custom.some(c=>c.key===key)||GPS_REPORT_COLS.includes(key)){ err.textContent=tt('admin.gps_key_exists','Key "{key}" already exists.',{ key }); return; }
        const clubId=await getClubId(); if(!clubId){ err.textContent=tt('admin.no_club_found_dot','No club found.'); return; }
        const newDef={ club_id:clubId, key, label, unit, category, decimals:2, is_core:false,
          display_order:200+custom.length };
        const { error:e }=await window.sb.from('gps_metric_definitions').insert(newDef);
        if(e){ err.textContent=e.message; return; }
        custom.push({ key, label });
        rows[rowIdx].target=key;
        np.style.display='none'; np.innerHTML='';
        paint();
      });
    }
    async function save(){
      const clubId=await getClubId(); if(!clubId){ modalMsg.textContent=tt('admin.no_club_found_dot','No club found.'); modalMsg.style.color='var(--cm-danger)'; return; }
      // Dedup by slug (Catapult can return duplicate slugs) — keep the user's
      // last selection. A repeated conflict key in one upsert breaks Postgres.
      const _byCol=new Map();
      rows.forEach(r=>_byCol.set(r.p.slug,{ club_id:clubId, source_label:'catapult', source_column_name:r.p.slug,
        target_metric:(r.target===''?'__ignore__':r.target), unit_conversion:(+r.conv||1) }));
      const ups=[..._byCol.values()];
      ov.querySelector('[data-save]').disabled=true; modalMsg.style.color='var(--cm-fg-muted)'; modalMsg.textContent=tt('common.saving','Saving…');
      const { error }=await window.sb.from('gps_column_mappings').upsert(ups,{ onConflict:'club_id,source_label,source_column_name' });
      if(error){ modalMsg.textContent=tt('admin.error_x','Error: {msg}',{ msg:error.message }); modalMsg.style.color='var(--cm-danger)'; ov.querySelector('[data-save]').disabled=false; return; }
      const mappedN=ups.filter(u=>u.target_metric!=='__ignore__').length;
      ov.remove();
      msg(prov, tt('admin.gps_saved_mappings','Saved {n} metric mapping|Saved {n} metric mappings',{ n:mappedN, count:mappedN }));
    }
    ov.querySelectorAll('[data-x]').forEach(b=>b.addEventListener('click',()=>ov.remove()));
    ov.querySelector('[data-save]').addEventListener('click',save);
    paint();
  }

  // ── Sync now (server-side chained worker) ─────────────────────────────────
  // The CLIENT no longer loops chunks. It fires gps-sync in "start" mode ONCE; the
  // server creates a gps_sync_jobs row, chains the worker chunk-by-chunk, and we watch
  // progress LIVE via Realtime on gps_sync_jobs. Navigating away no longer stops the sync.
  const _SYNC_STALE_MS = 5*60*1000;
  const _syncJobs = {};      // integration_id → latest gps_sync_jobs row (client cache)
  const _hideTimers = {};    // job_id → timeout that auto-hides a completed bar
  let _syncRT = null;        // shared Realtime channel (one per club)

  function _provForInt(intId){ return Object.keys(INTS).find(s=>INTS[s]?.id===intId); }
  function _paintByInt(intId){ const prov=_provForInt(intId); if(prov) _paintSyncBar(prov); }
  function _paintAllSync(){ Object.keys(INTS).forEach(_paintSyncBar); }
  function _syncBtn(prov){ return document.querySelector(`[data-act="sync"][data-prov="${prov}"]`); }
  function _setSyncBtn(prov, busy){
    const b=_syncBtn(prov); if(!b) return;
    b.disabled=!!busy; b.textContent = busy?tt('admin.gps_syncing_btn','Syncing…'):tt('admin.gps_sync_now','Sync now');
  }

  // Fire "start"; supabase-js flags a 409 (already-running lock) as an error whose JSON
  // body lives in error.context — parse it so we can still latch onto the existing job.
  async function _invokeStart(intId, from, to){
    const { data, error }=await window.sb.functions.invoke('gps-sync',{ body:{ mode:'start', integration_id:intId, from, to, tz_offset: -new Date().getTimezoneOffset() } });
    if(!error) return data;
    try{ const p=await error.context?.json?.(); if(p) return p; }catch(_){}
    throw error;
  }

  async function syncNow(prov){
    const intId=INTS[prov]?.id; if(!intId) return;
    const r=_dr[prov]?.getRange?.()||{};
    // "All" (unbounded) → cover all-time; the server filters activities by date + chunks.
    const from=r.from || '2010-01-01';
    const to  =r.to   || cmToday();
    if(from>to){ msg(prov,tt('admin.gps_from_before_to','"From" must be before "To".'),true); return; }
    msg(prov,''); _setSyncBtn(prov, true);
    try{
      const p=await _invokeStart(intId, from, to);
      if(p?.already_running) msg(prov, tt('admin.gps_sync_already_running','A sync is already in progress.'));
      if(p?.job_id){ await _trackJob(intId, p.job_id); }
      else if(p && p.ok===false){ msg(prov, p.message || tt('admin.gps_sync_failed','Sync failed'), true); _setSyncBtn(prov, false); }
      else { _setSyncBtn(prov, false); }
    }catch(e){
      msg(prov, tt('admin.gps_failed_x','Failed: {msg}',{ msg:(e.message||e) }), true);
      _setSyncBtn(prov, false);
    }
  }

  // Fetch a job row, cache it, paint it, and make sure Realtime is listening.
  async function _trackJob(intId, jobId){
    try{
      const { data }=await window.sb.from('gps_sync_jobs').select('*').eq('id', jobId).maybeSingle();
      if(data){ _syncJobs[intId]=data; _paintByInt(intId); }
    }catch(_){}
    _ensureRealtime();
  }

  // On mount / reload: resume the bar from the most-recent job per integration.
  async function _hydrateSyncJobs(){
    const cid=await getClubId(); if(!cid) return;
    const intIds=Object.values(INTS).map(r=>r.id).filter(Boolean);
    if(!intIds.length) return;
    try{
      const { data }=await window.sb.from('gps_sync_jobs').select('*')
        .eq('club_id',cid).in('integration_id',intIds).order('created_at',{ ascending:false });
      const seen=new Set();
      (data||[]).forEach(j=>{ if(seen.has(j.integration_id)) return; seen.add(j.integration_id); _syncJobs[j.integration_id]=j; });
      _paintAllSync();
      if((data||[]).some(j=>j.status==='running'||j.status==='queued')) _ensureRealtime();
    }catch(_){}
  }

  // One shared channel per club (same pattern as Availability/Hub). Progress UPDATEs
  // stream in and repaint the matching provider's bar.
  async function _ensureRealtime(){
    if(_syncRT) return;
    const cid=await getClubId(); if(!cid) return;
    _syncRT = window.sb.channel('admin-gps-sync-'+cid)
      .on('postgres_changes',{ event:'*', schema:'public', table:'gps_sync_jobs', filter:`club_id=eq.${cid}` }, ({ new:nw })=>{
        if(!nw || !nw.integration_id) return;
        const cur=_syncJobs[nw.integration_id];
        // keep the latest job per integration (same row, or a newer one)
        if(!cur || nw.id===cur.id || new Date(nw.created_at)>=new Date(cur.created_at)){
          _syncJobs[nw.integration_id]=nw; _paintByInt(nw.integration_id);
        }
      })
      .subscribe();
  }

  function _scheduleHide(prov, jobId){
    if(_hideTimers[jobId]) return;
    _hideTimers[jobId]=setTimeout(()=>{
      const intId=INTS[prov]?.id;
      const st=_syncJobs[intId]?.status;
      if(intId && _syncJobs[intId]?.id===jobId && (st==='done'||st==='cancelled')){ delete _syncJobs[intId]; _paintSyncBar(prov); }
      delete _hideTimers[jobId];
    }, 10000);
  }

  // Render the progress bar for a provider from its cached job + toggle its Sync button.
  function _paintSyncBar(prov){
    const bar=document.querySelector(`[data-syncbar="${prov}"]`); if(!bar) return;
    const intId=INTS[prov]?.id;
    const job=intId?_syncJobs[intId]:null;
    const btn=_syncBtn(prov);
    if(!job){ bar.style.display='none'; bar.innerHTML=''; if(btn){ btn.disabled=false; btn.textContent=tt('admin.gps_sync_now','Sync now'); } return; }

    const total=job.chunks_total||0, done=job.chunks_done||0;
    const pct = total>0 ? Math.min(100, Math.round(done/total*100)) : (job.status==='done'?100:0);
    const t=job.totals||{};
    const running=(job.status==='running'||job.status==='queued');
    const stale = running && job.heartbeat_at && (Date.now()-new Date(job.heartbeat_at).getTime()>_SYNC_STALE_MS);

    let label, cls='', animated=false, retry=false, isDone=false;
    if(running && stale){ label=tt('admin.gps_sync_stalled','Sync stalled — the worker stopped responding.'); cls='s-error'; retry=true; }
    else if(running){ label=tt('admin.gps_syncing_progress','Syncing… {done}/{total} ({pct}%)',{ done, total, pct }); animated=true; }
    else if(job.status==='done'){ label=tt('admin.gps_sync_complete','Sync complete'); cls='s-done'; isDone=true; }
    else if(job.status==='cancelled'){ label=tt('admin.gps_sync_cancelled','Cancelled'); }
    else if(job.status==='error'){ label=tt('admin.gps_sync_failed_x','Sync failed: {msg}',{ msg: job.error||'unknown' }); cls='s-error'; retry=true; }

    // Construcción del totalizador. Si NADA bajó pero hay pendientes, mostramos SOLO el mensaje de
    // pendientes (los "0·0·0" al lado del pendiente confunden — parece que no pasó nada).
    let sum = '';
    if (t.activities != null) {
      const a = t.activities || 0, pend = t.pending_activities || 0;
      if (a > 0) {
        sum = tt('admin.gps_sync_totals','{a} sessions · {r} reports · {p} periods',{ a, r:t.rows||0, p:t.periods||0 });
        if (pend > 0) sum += ' · ' + tt('admin.gps_sync_pending','{n} awaiting a session (see “GPS days without a session”)',{ n:pend });
      } else if (pend > 0) {
        sum = tt('admin.gps_sync_all_pending','{n} activity has no session yet — create it in “GPS days without a session” to download the data|{n} activities have no session yet — create them in “GPS days without a session” to download the data',{ n:pend, count:pend });
      } else {
        sum = tt('admin.gps_sync_totals','{a} sessions · {r} reports · {p} periods',{ a:0, r:t.rows||0, p:t.periods||0 });
      }
    }
    const fillPct = running ? Math.max(pct, 6) : pct;   // show a sliver while starting

    bar.style.display='';
    bar.innerHTML=`
      <div class="gps-sync-row">
        <div class="gps-sync-track"><div class="gps-sync-fill ${cls} ${animated?'is-anim':''}" style="width:${fillPct}%"></div></div>
        <span class="gps-sync-pct">${running?pct+'%':''}</span>
      </div>
      <div class="gps-sync-meta ${cls==='s-error'?'is-err':''} ${isDone?'is-ok':''}">
        ${isDone?'<i class="ti ti-circle-check-filled"></i>':''}
        <span>${_esc(label)}</span>
        ${sum?`<span>· ${_esc(sum)}</span>`:''}
        ${running?`<button class="gps-int-btn ghost gps-sync-cancel" data-synccancel="${prov}">${tt('admin.gps_cancel','Cancel')}</button>`:''}
        ${retry?`<button class="gps-int-btn ghost gps-sync-retry" data-syncretry="${prov}">${tt('admin.gps_retry','Retry')}</button>`:''}
        ${isDone?`<button class="gps-int-btn ghost gps-sync-dismiss" data-syncdismiss="${prov}">${tt('common.dismiss','Dismiss')}</button>`:''}
      </div>`;
    const rb=bar.querySelector('[data-syncretry]'); if(rb) rb.addEventListener('click',()=>syncNow(prov));
    const cb=bar.querySelector('[data-synccancel]'); if(cb) cb.addEventListener('click',()=>_cancelSync(prov));
    const db=bar.querySelector('[data-syncdismiss]'); if(db) db.addEventListener('click',()=>{ const iid=INTS[prov]?.id; if(iid) delete _syncJobs[iid]; _paintSyncBar(prov); });

    if(btn){ const busy=running && !stale; btn.disabled=busy; btn.textContent = busy?tt('admin.gps_syncing_btn','Syncing…'):tt('admin.gps_sync_now','Sync now'); }
    // Cancelled auto-hides; a completed sync STAYS (with its totals) until dismissed or re-synced,
    // so the user can actually read the result instead of it vanishing.
    if(job.status==='cancelled') _scheduleHide(prov, job.id);
  }

  // Cancel the active sync job for a provider (cooperative: the server flips status→'cancelled',
  // the running worker stops chaining on its next chunk, the lock frees). Realtime repaints; we
  // also flip the cached job optimistically in case the UPDATE event lags.
  async function _cancelSync(prov){
    const intId=INTS[prov]?.id; const job=intId?_syncJobs[intId]:null;
    if(!job?.id) return;
    if(!confirm(tt('admin.gps_cancel_confirm','Cancel this sync? Partial data will remain until the next sync.'))) return;
    const cb=document.querySelector(`[data-synccancel="${prov}"]`);
    if(cb){ cb.disabled=true; cb.textContent=tt('admin.gps_cancelling','Cancelling…'); }
    try{
      const { error }=await window.sb.functions.invoke('gps-sync',{ body:{ mode:'cancel', job_id: job.id } });
      if(error){ let p=null; try{ p=await error.context?.json?.(); }catch(_){}; if(!p) throw error; }
      if(intId && _syncJobs[intId]?.id===job.id){ _syncJobs[intId]=Object.assign({},_syncJobs[intId],{ status:'cancelled' }); _paintSyncBar(prov); }
    }catch(e){
      if(cb){ cb.disabled=false; cb.textContent=tt('admin.gps_cancel','Cancel'); }
      msg(prov, tt('admin.gps_failed_x','Failed: {msg}',{ msg:(e.message||e) }), true);
    }
  }

  // ── Map athletes (Catapult → players.external_gps_id) ─────────────────────
  // Reuses the shared matcher (window.CMGpsMatch) and the matched/verify/
  // unmatched + Add/Confirm pattern from GPS Analysis step 3. Self-contained
  // modal — the CSV wizard is untouched.
  const _MAP_POS = ['GK','CB','FB','MF','WG','ST'];
  function _athleteName(a){ return [a.first_name, a.last_name].filter(Boolean).join(' ').trim(); }
  // Provider position → canonical code via the shared vocabulary (assets/positions.js).
  // The old version matched only the first TWO characters against 6 codes and fell back to
  // 'MF', so "Goalkeeper"/"Portero"/"Defender"/"Winger" all silently became midfielders.
  // Unknown/empty now yields null — never invent a position; Squad shows it as unassigned.
  function _mapPos(raw){
    if (window.cmNormalizePosition) return window.cmNormalizePosition(raw);
    if(!raw) return null;
    return _MAP_POS.find(p=>p.toLowerCase()===String(raw).toLowerCase().slice(0,2)) || null;
  }
  function _esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

  async function mapAthletes(prov){
    const intId=INTS[prov]?.id; if(!intId) return;
    msg(prov,tt('admin.gps_loading_athletes','Loading athletes…'));
    let athletes, squad, teams;
    try{
      const { data, error }=await window.sb.functions.invoke('gps-athletes',{ body:{ integration_id:intId } });
      if(error) throw error;
      if(!data?.ok){ msg(prov, data?.message || (data?.http_status?tt('admin.gps_provider_error_http','Provider error (HTTP {n})',{ n:data.http_status }):tt('admin.gps_could_not_load_athletes','Could not load athletes')), true); return; }
      athletes=data.athletes||[];
      const clubId=await getClubId();
      const { data:sq, error:e2 }=await window.sb.from('players')
        .select('id,first_name,last_name,number,position,external_gps_id');
      if(e2) throw e2;
      squad=sq||[];
      // Active teams of the club — new players MUST get a team_id or they go
      // orphaned (Squad filters by team). Mirror the manual "Add player" path.
      const { data:tm, error:e3 }=await window.sb.from('teams')
        .select('id,name').eq('club_id',clubId).is('archived_at',null).order('name');
      if(e3) throw e3;
      teams=tm||[];
    }catch(e){ msg(prov,tt('admin.gps_failed_x','Failed: {msg}',{ msg:(e.message||e) }),true); return; }
    msg(prov,'');
    if(!athletes.length){ msg(prov,tt('admin.gps_no_athletes','No athletes found in the Catapult account.')); return; }
    _openMapModal(prov, athletes, squad, teams);
  }

  function _openMapModal(prov, athletes, squad, teams){
    teams=teams||[];
    let teamId=teams[0]?.id||null;   // default destination team (first/only)
    // Build match rows up-front. external_gps_id is fed as rawExtGpsId so an
    // already-mapped athlete scores an exact (idempotent) match.
    const rows=athletes.map((a,i)=>{
      const name=_athleteName(a);
      const m=window.CMGpsMatch.findBestMatch(name, a.jersey||'', a.athlete_id, squad);
      return { i, a, name, match:m, cat:window.CMGpsMatch.categorize(m), done:false,
               already:!!(m.player && m.player.external_gps_id===a.athlete_id) };
    });
    let mapped=0, added=0, filter='all';

    const ov=document.createElement('div');
    ov.style.cssText='position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:24px';
    ov.innerHTML=`<div style="background:var(--cm-bg);border:1px solid var(--cm-border);border-radius:14px;width:min(760px,100%);max-height:88vh;display:flex;flex-direction:column;overflow:hidden">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid var(--cm-border)">
        <h3 style="margin:0;font-size:16px">${tt('admin.gps_map_athletes_title','Map athletes — Catapult')}</h3>
        <button data-x="1" style="background:none;border:0;font-size:20px;line-height:1;color:var(--cm-fg-muted);cursor:pointer">&times;</button>
      </div>
      ${teams.length>1?`<div style="display:flex;align-items:center;gap:8px;padding:10px 18px;border-bottom:1px solid var(--cm-border)">
        <label style="font-size:12px;color:var(--cm-fg-muted)">${tt('admin.gps_add_players_to_team','Add new players to team')}</label>
        <select data-team style="padding:6px 9px;border:1px solid var(--cm-border);border-radius:8px;background:var(--cm-bg);color:var(--cm-fg-strong);font:inherit">
          ${teams.map(t=>`<option value="${_esc(t.id)}">${_esc(t.name)}</option>`).join('')}
        </select></div>`:''}
      <div style="display:flex;gap:6px;padding:12px 18px;border-bottom:1px solid var(--cm-border);flex-wrap:wrap">
        <button class="map-tab" data-f="all">${tt('common.all','All')} <span data-c="all">0</span></button>
        <button class="map-tab" data-f="unmatched">${tt('admin.gps_unmatched','Unmatched')} <span data-c="unmatched">0</span></button>
        <button class="map-tab" data-f="verify">${tt('admin.gps_verify','Verify')} <span data-c="verify">0</span></button>
        <button class="map-tab" data-f="matched">${tt('admin.gps_matched','Matched')} <span data-c="matched">0</span></button>
        <div style="flex:1"></div>
        <button class="gps-int-btn" data-bulk="confirm" style="display:none">${tt('admin.gps_confirm_all_matches','Confirm all matches')}</button>
        <button class="gps-int-btn ghost" data-bulk="add" style="display:none">${tt('admin.gps_add_all_unmatched','Add all unmatched')}</button>
      </div>
      <div data-warn style="display:none;margin:10px 18px 0;padding:8px 11px;border:1px solid color-mix(in srgb, var(--cm-warning,#D97706) 35%, transparent);background:color-mix(in srgb, var(--cm-warning,#D97706) 8%, transparent);border-radius:8px;font:500 11.5px/1.4 var(--cm-font-sans);color:var(--cm-warning,#D97706)"></div>
      <div data-list style="overflow:auto;padding:8px 18px"></div>
      <div style="padding:12px 18px;border-top:1px solid var(--cm-border);display:flex;justify-content:space-between;align-items:center">
        <span data-summary style="font-size:12px;color:var(--cm-fg-muted)"></span>
        <button class="gps-int-btn" data-x="1">${tt('admin.gps_done','Done')}</button>
      </div></div>`;
    document.body.appendChild(ov);

    // minimal tab styling
    ov.querySelectorAll('.map-tab').forEach(t=>{ t.style.cssText='padding:4px 11px;border:1px solid var(--cm-border);border-radius:999px;background:var(--cm-bg-soft);color:var(--cm-fg-muted);font:600 11px var(--cm-font-sans);cursor:pointer'; });
    const _teamSel=ov.querySelector('[data-team]'); if(_teamSel) _teamSel.addEventListener('change',()=>{ teamId=_teamSel.value; });

    const listEl=ov.querySelector('[data-list]');
    const sumEl=ov.querySelector('[data-summary]');

    function counts(){ const c={all:rows.length,unmatched:0,verify:0,matched:0}; rows.forEach(r=>{ c[r.cat]++; }); return c; }
    function rowHtml(r){
      const p=r.match.player, pct=Math.round((r.match.score||0)*100)+'%';
      const pLabel=p?`${_esc(p.first_name)} ${_esc(p.last_name)} · #${_esc(p.number||'?')} · ${_esc(p.position||'—')}`:tt('admin.gps_no_match','No match in squad');
      let action;
      if(r.done){ action=`<span style="font:600 11px var(--cm-font-sans);color:var(--cm-accent)">${r.wasAdded?tt('admin.gps_added','Added'):tt('admin.gps_mapped','Mapped')} ✓</span>`; }
      else if(r.already){ action=`<span style="font:600 11px var(--cm-font-sans);color:var(--cm-fg-muted)">${tt('admin.gps_already_mapped','Already mapped')}</span>`; }
      else if(r.cat==='unmatched'){ action=`<button class="gps-int-btn" data-add="${r.i}">${tt('admin.gps_add_to_squad','Add to squad')}</button>`; }
      else { action=`<button class="gps-int-btn" data-confirm="${r.i}">${tt('common.confirm','Confirm')}</button>`+(r.cat==='verify'?`<button class="gps-int-btn ghost" data-add="${r.i}">${tt('admin.gps_add_new','Add new')}</button>`:''); }
      return `<div data-row="${r.i}" data-cat="${r.cat}" style="display:grid;grid-template-columns:1.4fr 56px 1.6fr auto;gap:10px;align-items:center;padding:9px 0;border-bottom:1px solid var(--cm-border)">
        <div><div style="font:600 12px var(--cm-font-sans);color:var(--cm-fg)">${_esc(r.name||r.a.athlete_id)}</div>
          <div style="font:400 11px var(--cm-font-sans);color:var(--cm-fg-muted)">${[r.a.jersey?'#'+_esc(r.a.jersey):'',_esc(r.a.position||'')].filter(Boolean).join(' · ')}</div></div>
        <div style="font:600 10px var(--cm-font-mono);color:var(--cm-fg-muted);text-align:center">${pct}</div>
        <div style="font:500 11.5px var(--cm-font-sans);color:var(--cm-fg-muted)">${pLabel}</div>
        <div style="display:flex;gap:6px;justify-content:flex-end">${action}</div></div>`;
    }
    function paint(){
      listEl.innerHTML=rows.filter(r=>filter==='all'||r.cat===filter).map(rowHtml).join('') ||
        `<div style="padding:18px;color:var(--cm-fg-muted);font-size:12px">${tt('admin.gps_nothing_here','Nothing here.')}</div>`;
      const c=counts();
      ov.querySelectorAll('[data-c]').forEach(s=>{ s.textContent=c[s.dataset.c]; });
      ov.querySelectorAll('.map-tab').forEach(t=>{ const on=t.dataset.f===filter; t.style.background=on?'var(--cm-accent-soft)':'var(--cm-bg-soft)'; t.style.color=on?'var(--cm-accent)':'var(--cm-fg-muted)'; t.style.borderColor=on?'var(--cm-accent)':'var(--cm-border)'; });
      // Pending = high-confidence (matched) suggestions still unconfirmed (bulk only touches these).
      const pending=rows.filter(r=>!r.done&&!r.already&&r.cat==='matched').length;
      const cBtn=ov.querySelector('[data-bulk="confirm"]');
      cBtn.style.display=pending>0?'':'none';
      cBtn.textContent=tt('admin.gps_confirm_all_matches','Confirm all matches')+` (${pending})`;
      ov.querySelector('[data-bulk="add"]').style.display=c.unmatched>0?'':'none';
      // Warn about athletes whose GPS won't import until linked (not yet mapped/added).
      const unlinked=rows.filter(r=>!r.done&&!r.already).length;
      const warnEl=ov.querySelector('[data-warn]');
      if(unlinked>0){ warnEl.style.display=''; warnEl.textContent=tt('admin.gps_unlinked_warn',"{n} Catapult athlete(s) aren't linked yet — their GPS won't import until you Confirm or Add them.",{n:unlinked}); }
      else warnEl.style.display='none';
      sumEl.textContent=tt('admin.gps_map_summary','{mapped} mapped · {added} added',{ mapped, added });
      bind();
    }
    async function doConfirm(r){
      const p=r.match.player; if(!p) return;
      // external_gps_id must be unique: strip this athlete id off any OTHER player first, so a
      // mis-mapped duplicate (e.g. two #17s) is repaired instead of leaving a stale link behind.
      // RLS scopes the update to this club.
      await window.sb.from('players').update({ external_gps_id:null }).eq('external_gps_id',r.a.athlete_id).neq('id',p.id);
      const { error }=await window.sb.from('players').update({ external_gps_id:r.a.athlete_id }).eq('id',p.id);
      if(error){ alert(tt('admin.gps_failed_to_map','Failed to map: {msg}',{ msg:error.message })); return; }
      if(p) p.external_gps_id=r.a.athlete_id;   // keep in-memory squad in sync for later matches
      r.done=true; r.wasAdded=false; r.cat='matched'; mapped++;
    }
    async function doAdd(r){
      const clubId=await getClubId(); if(!clubId){ alert(tt('admin.no_club_found','No club found')); return; }
      if(!teamId){ alert(tt('admin.gps_no_team_first','This club has no team yet — create one in Teams before adding players.')); return; }
      const parts=(r.name||'').trim().split(/\s+/);
      const fn=parts.slice(0,-1).join(' ')||parts[0]||r.a.first_name||'';
      const ln=parts.length>1?parts.slice(-1)[0]:(r.a.last_name||parts[0]||'');
      const _jn=parseInt(String(r.a.jersey??'').trim(),10);
      const number=Number.isFinite(_jn)?_jn:null;   // non-numeric jersey (e.g. "IKD") → null, don't break
      // team_id required — without it the player is orphaned/invisible in Squad.
      const rec={ club_id:clubId, team_id:teamId, first_name:fn, last_name:ln, position:_mapPos(r.a.position),
                  number, status:'available', external_gps_id:r.a.athlete_id };
      const { data, error }=await window.sb.from('players').insert(rec).select('id').single();
      if(error){ alert(tt('admin.gps_failed_to_add','Failed to add: {msg}',{ msg:error.message })); return; }
      // Membresía de equipo: sin fila en player_teams el jugador queda huérfano/invisible en el roster
      // de GPS Analysis y Squad (ambos filtran por la junction player_teams, NO por players.team_id).
      // Es su único equipo → is_primary:true. (El alta normal de Squad ya hace esto; el modal GPS no lo hacía.)
      const { error:ptErr }=await window.sb.from('player_teams')
        .upsert({ club_id:clubId, player_id:data.id, team_id:teamId, is_primary:true }, { onConflict:'player_id,team_id', ignoreDuplicates:true });
      if(ptErr){ alert(tt('admin.gps_failed_to_add','Failed to add: {msg}',{ msg:ptErr.message })); return; }
      squad.push({ id:data.id, first_name:fn, last_name:ln, number:rec.number, position:rec.position, external_gps_id:r.a.athlete_id });
      r.done=true; r.wasAdded=true; r.cat='matched'; added++;
    }
    function bind(){
      listEl.querySelectorAll('[data-confirm]').forEach(b=>b.addEventListener('click',async()=>{ b.disabled=true; await doConfirm(rows[+b.dataset.confirm]); paint(); }));
      listEl.querySelectorAll('[data-add]').forEach(b=>b.addEventListener('click',async()=>{ b.disabled=true; await doAdd(rows[+b.dataset.add]); paint(); }));
    }
    ov.querySelectorAll('.map-tab').forEach(t=>t.addEventListener('click',()=>{ filter=t.dataset.f; paint(); }));
    ov.querySelector('[data-bulk="confirm"]').addEventListener('click',async()=>{
      // Auto-confirm only HIGH-confidence (matched) suggestions; ambiguous "verify" rows stay
      // manual. Guard: never let two athletes claim the same player in one pass (dup jerseys).
      const claimed=new Set(rows.filter(r=>r.already&&r.match.player).map(r=>r.match.player.id));
      for(const r of rows){
        if(r.done||r.already||r.cat!=='matched'||!r.match.player) continue;
        if(claimed.has(r.match.player.id)) continue;   // player already taken → leave for manual review
        await doConfirm(r); claimed.add(r.match.player.id);
      }
      paint();
    });
    ov.querySelector('[data-bulk="add"]').addEventListener('click',async()=>{
      for(const r of rows){ if(!r.done && r.cat==='unmatched') await doAdd(r); } paint();
    });
    ov.querySelectorAll('[data-x]').forEach(b=>b.addEventListener('click',()=>{
      ov.remove();
      msg(prov, tt('admin.gps_mapping_done','Mapping done — {mapped} mapped, {added} added.',{ mapped, added }));
    }));
    paint();
  }

  async function disconnect(prov){
    const intId=INTS[prov]?.id; if(!intId) return;
    if(!confirm(tt('admin.gps_disconnect_confirm','Disconnect this GPS provider? Synced data stays; only the credential is removed.'))) return;
    try{ const { error }=await window.sb.rpc('clear_gps_credential',{ p_integration_id:intId }); if(error) throw error; await load(); }
    catch(e){ msg(prov,tt('admin.gps_failed_x','Failed: {msg}',{ msg:(e.message||e) }),true); }
  }
  // Montaje: cargar de una (el caller decide CUÁNDO montar — tab de Admin / apertura del drawer).
  load();
  const _onLang = () => { render(); _paintAllSync(); };
  document.addEventListener('cm:langchanged', _onLang);
  window.addEventListener('beforeunload', () => { if (_syncRT) { try { window.sb.removeChannel(_syncRT); } catch (_) {} } });
  return { reload: load, destroy() { document.removeEventListener('cm:langchanged', _onLang); if (_syncRT) { try { window.sb.removeChannel(_syncRT); } catch (_) {} _syncRT = null; } } };
};
