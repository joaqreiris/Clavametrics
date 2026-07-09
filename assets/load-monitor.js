/* ────────────────────────────────────────────────────────────────────────
   load-monitor.js — controller for the redesigned Load Monitor page.

   Renders REAL data into the design's panes (ids from the mockup):
     ACWR hero  : metricSel, settingsPop, kpiN/kpiDen/kpiFoot/kpiAvg, zones, acwrPane
     GPS exp.   : gpsGrid            (via window.gpsExposure.compute)
     Stressors  : stressList         (via window.stressors.build)
     Avail.     : availBody          (per-player 7/28-day GPS sparklines + risk)
     Dec. queue : dqList             (auto-derived + user-added actions)

   i18n: every user-visible string flows through tt() / CM_I18N (loaded by
   sidebar.js). Static markup uses data-i18n and is applied by CM_I18N; dynamic
   text re-renders on cm:langchanged. Reuses window.sb + helpers.
   ──────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const sb = () => window.sb;

  // i18n: shared runtime when present; fall back to English.
  function tt(key, fb, vars){ const v=(window.CM_I18N&&CM_I18N.t)?CM_I18N.t(key,vars):null; return (v&&v!==key)?v:(fb!=null?fb:key); }
  function lang(){ return (window.CM_I18N&&CM_I18N.current)?CM_I18N.current:undefined; }

  // metricSel option value → engine metric key
  const METRIC_MAP = {
    srpe: 'srpe_load', pl: 'player_load', hsr: 'high_speed_distance',
    sprint: 'sprint_distance', sprints: 'sprint_count', accdec: 'accel_decel',
  };
  const POS_CSS = { GK:'gk', CB:'cb', LB:'fb', RB:'fb', FB:'fb', DM:'mf', CM:'mf', MF:'mf', WG:'wg', LW:'wg', RW:'wg', ST:'st', CF:'st' };

  // ── utils ─────────────────────────────────────────────────────────────────
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function iso(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
  function offset(refStr,n){ const d=new Date(refStr+'T00:00:00'); d.setDate(d.getDate()+n); return iso(d); }
  function median(a){ const v=a.filter(x=>x!=null&&isFinite(x)).sort((x,y)=>x-y); if(!v.length) return null; const m=Math.floor(v.length/2); return v.length%2?v[m]:(v[m-1]+v[m])/2; }
  function mean(a){ const v=a.filter(x=>x!=null&&isFinite(x)); return v.length? v.reduce((s,x)=>s+x,0)/v.length : null; }
  function accent(){ return getComputedStyle(document.documentElement).getPropertyValue('--cm-accent').trim() || '#6366f1'; }
  function cssVar(n,f){ return getComputedStyle(document.documentElement).getPropertyValue(n).trim() || f; }
  // header helpers (wire the design's static counters to real data)
  function cardOf(id){ const el=document.getElementById(id); return el? el.closest('.cm-card') : null; }
  function setSub(card, txt){ const el=card&&card.querySelector('.lm-head .sub'); if(el) el.textContent=txt; }
  function setPill(card, html, danger){ const el=card&&card.querySelector('.lm-head .cm-pill'); if(el){ el.innerHTML='<span class="cm-dot"></span>'+html; el.classList.toggle('is-danger', !!danger); } }
  function setPageContext(){
    const hp=$('lmPageCtx');
    if(hp){ const av=state.players.filter(p=>p.status==='available').length;
      const d=new Date(state.refDate+'T00:00:00').toLocaleDateString(lang(),{weekday:'long',day:'numeric',month:'long',year:'numeric'});
      hp.textContent=tt('load_monitor.page_ctx', `${d} · ${av} of ${state.players.length} available`, { date:d, avail:av, total:state.players.length }); }
  }

  // Tiny inline sparkline (matches the design's .spark svg boxes).
  function spark(vals, stroke, h){
    const pts=vals.filter(v=>v!=null&&isFinite(v));
    if(pts.length<2) return `<svg class="spark" viewBox="0 0 100 ${h||30}" preserveAspectRatio="none"></svg>`;
    const min=Math.min(...pts),max=Math.max(...pts),span=(max-min)||1,n=vals.length;
    const co=vals.map((v,i)=> v==null?null:`${(i/(n-1)*100).toFixed(1)},${((h||30)-2-((v-min)/span)*((h||30)-4)).toFixed(1)}`).filter(Boolean);
    const last=co[co.length-1].split(',');
    return `<svg class="spark" viewBox="0 0 100 ${h||30}" preserveAspectRatio="none">
      <polyline points="${co.join(' ')}" fill="none" stroke="${stroke}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
      <circle cx="${last[0]}" cy="${last[1]}" r="2" fill="${stroke}"/></svg>`;
  }

  // ── state ─────────────────────────────────────────────────────────────────
  const state = { clubId:null, teamId:null, players:[], refDate:iso(new Date()),
    metric:'srpe', model:'ewma', coupled:false, availWindow:7, chart:null,
    lastSquad:null, lastStress:null, lastExposure:null,
    catalog:[], cols:[], signalSet:[], sortKey:'risk', sortDir:'desc', availRows:[] };

  function metricKey(){ return METRIC_MAP[state.metric] || 'srpe_load'; }
  function metricLabel(){ const m=window.gpsACWR?.getMetric(metricKey()); return tt('load_monitor.metric_'+state.metric, m? m.label : 's-RPE'); }
  function modelLabel(){ return state.model==='ewma' ? tt('load_monitor.model_ewma','EWMA 7:28') : tt('load_monitor.model_ra','rolling 7:28'); }

  // ── ACWR: KPIs + zones + chart ──────────────────────────────────────────────
  async function renderACWR(){
    const sub=$('acwrSub'); if(sub) sub.textContent=`${metricLabel()} · ${modelLabel()} · ${tt('load_monitor.last6w','last 6 weeks')}`;
    const mn=$('metricName'); if(mn) mn.textContent=metricLabel();

    let squad;
    try { squad = await window.gpsACWR.calculateSquad({ clubId:state.clubId, refDate:state.refDate, metricKey:metricKey(), model:state.model, coupled:state.coupled }); }
    catch { squad=null; }
    state.lastSquad = squad;

    const total = state.players.length || (squad? Object.keys(squad.perPlayer).length : 0);
    const c = squad?.counts || { under:0,sweet:0,over:0,risk:0,noData:0 };
    const riskN = c.over + c.risk;
    if($('kpiN')) $('kpiN').textContent = String(riskN);
    if($('kpiDen')) $('kpiDen').textContent = `/ ${total}`;
    if($('kpiFoot')) $('kpiFoot').innerHTML = tt('load_monitor.kpi_foot',
      `<b>${riskN}</b> players ≥ 1.3 ACWR · <b>${c.risk}</b> above 1.5 (danger).`,
      { risk:`<b>${riskN}</b>`, danger:`<b>${c.risk}</b>` });

    const med = squad ? median(Object.values(squad.perPlayer).map(p=>p.acwr)) : null;
    if($('kpiAvg')) $('kpiAvg').innerHTML = (med!=null? med.toFixed(2) : '—') + `<small>${tt('load_monitor.squad_median','squad median')}</small>`;

    // zone highlight
    const zoneCls = med==null?null: med>1.5?'danger': med>1.3?'over': med>=0.8?'sweet':'under';
    document.querySelectorAll('.lm-zone').forEach(z=> z.classList.toggle('is-active', z.dataset.zone===zoneCls));

    await renderChart();
  }

  async function renderChart(){
    const pane=$('acwrPane'); if(!pane) return;
    let tl;
    try { tl = await window.gpsACWR.calculateSquadTimeline({ clubId:state.clubId, fromDate:offset(state.refDate,-42), toDate:state.refDate, metricKey:metricKey(), model:state.model, coupled:state.coupled }); }
    catch { tl=null; }

    if(!tl || !tl.dates.length || tl.squadAcwr.every(v=>v==null)){
      pane.innerHTML = `<div class="lm-chart-skeleton" style="animation:none"><div class="lm-empty" style="padding:40px;text-align:center;color:var(--cm-fg-faint)">${esc(tt('load_monitor.no_metric_6w', `No ${metricLabel()} data in the last 6 weeks.`, { metric: metricLabel() }))}</div></div>`;
      if(state.chart){ state.chart.destroy(); state.chart=null; }
      return;
    }

    const modelShort = state.model==='ewma'?'EWMA':'RA';
    const acwrLbl = tt('load_monitor.chart_squad_acwr', `Squad ACWR (${modelShort})`, { model: modelShort });
    const loadLbl = tt('load_monitor.chart_session_load', 'Session load');
    pane.innerHTML = `
      <div class="lm-chart-legend">
        <span class="lm-lg"><span class="line acute"></span>${esc(acwrLbl)}</span>
        <span class="lm-lg"><span class="bar"></span>${esc(loadLbl)}</span>
        <span class="lm-lg spacer"></span>
      </div>
      <div style="position:relative;height:280px"><canvas id="acwrCanvas"></canvas></div>`;

    const labels = tl.dates.map(d=> new Date(d+'T12:00:00').toLocaleDateString(lang(),{day:'numeric',month:'short'}));
    const fai=cssVar('--cm-fg-faint','#aaa'), acc=accent();
    const maxLoad=Math.max(1,...tl.squadLoad);
    if(state.chart){ state.chart.destroy(); state.chart=null; }
    state.chart = new Chart($('acwrCanvas'), {
      data:{ labels, datasets:[
        { type:'line', data:Array(labels.length).fill(1.5), borderColor:'rgba(220,38,38,0.35)', borderDash:[4,3], borderWidth:1, pointRadius:0, yAxisID:'y', order:4 },
        { type:'line', data:Array(labels.length).fill(1.3), borderColor:'rgba(217,119,6,0.30)', borderDash:[3,3], borderWidth:1, pointRadius:0, yAxisID:'y', order:4 },
        { type:'line', data:Array(labels.length).fill(0.8), borderColor:'rgba(34,197,94,0.30)', borderDash:[3,3], borderWidth:1, pointRadius:0, yAxisID:'y', order:4 },
        { type:'bar', label:loadLbl, data:tl.squadLoad, backgroundColor:'rgba(120,120,130,0.16)', borderWidth:0, borderRadius:2, yAxisID:'y2', order:5 },
        { type:'line', label:acwrLbl, data:tl.squadAcwr, borderColor:acc, backgroundColor:'rgba(99,102,241,0.08)', borderWidth:2.5, pointRadius:2.5, pointHoverRadius:5, tension:0.3, fill:true, spanGaps:true, yAxisID:'y', order:1 },
      ]},
      options:{ responsive:true, maintainAspectRatio:false, interaction:{mode:'index',intersect:false}, plugins:{legend:{display:false}},
        scales:{
          y:{ min:0, max:2.2, position:'left', grid:{color:'rgba(128,128,128,0.10)'}, ticks:{color:fai,font:{size:11},callback:v=>v.toFixed(1)} },
          y2:{ position:'right', max:maxLoad*3, grid:{display:false}, ticks:{color:fai,font:{size:10},callback:v=> v>=1000?(v/1000).toFixed(0)+'k':v} },
          x:{ grid:{color:'rgba(128,128,128,0.06)'}, ticks:{color:fai,font:{size:10},maxTicksLimit:10} },
        } }
    });
  }

  // ── GPS exposure tiles ──────────────────────────────────────────────────────
  async function renderExposure(){
    const grid=$('gpsGrid'), empty=$('gpsEmpty'); if(!grid) return;
    let res;
    try { res = await window.gpsExposure.compute({ clubId:state.clubId, players:state.players, refDate:state.refDate, level:'squad' }); }
    catch { res=null; }
    state.lastExposure = (res&&res.ok)? res : null;
    if(!res || !res.ok){
      grid.innerHTML='';
      try{ setPill(cardOf('gpsGrid'), esc(tt('load_monitor.exp_pill_empty','no GPS sessions')), false); }catch{}
      if(empty){ empty.style.display='block'; empty.innerHTML=`<div style="padding:26px;text-align:center;color:var(--cm-fg-faint)"><i class="ti ti-satellite" style="font-size:22px"></i><div style="margin-top:6px">${esc(tt('load_monitor.gps_none','No GPS data yet'))}</div></div>`; }
      return;
    }
    if(empty) empty.style.display='none';
    const fmt=res.fmtVal||window.gpsExposure.fmtVal;
    grid.innerHTML = res.tiles.map(t=>{
      const d=t.delta;
      const dCls = d==null?'flat': d>=2?'up': d<=-2?'down':'flat';
      const dIco = d==null?'ti-minus': d>=2?'ti-trending-up': d<=-2?'ti-trending-down':'ti-minus';
      const dTxt = d==null?'—':(d>0?'+':'')+d.toFixed(0)+'%';
      const label = tt('load_monitor.exp_'+t.key, t.label);
      return `<div class="lm-gps-cell">
        <div class="top"><span class="lbl">${esc(label)}</span><span class="lm-delta ${dCls}"><i class="ti ${dIco}"></i>${dTxt}</span></div>
        <div class="val">${fmt(t.current,t.fmt)}${t.unit?`<small>${esc(t.unit)}</small>`:''}</div>
        ${spark(t.spark, accent(), 34)}
        <div class="base"><span>${esc(tt('load_monitor.exp_baseline','baseline'))}</span><span>${fmt(t.baseline,t.fmt)}</span></div>
      </div>`;
    }).join('');
    try{ const card=cardOf('gpsGrid');
      setSub(card, tt('load_monitor.exp_sub', `Weekly totals vs 4-week baseline · ${offset(state.refDate,-6)} → ${state.refDate}`, { from:offset(state.refDate,-6), to:state.refDate }));
      setPill(card, tt('load_monitor.exp_pill', `${res.athletes} athletes · ${res.sessions} sessions`, { athletes:res.athletes, sessions:res.sessions }), false);
    }catch(e){}
  }

  // ── Impending stressors ─────────────────────────────────────────────────────
  async function renderStressors(){
    const list=$('stressList'); if(!list) return;
    let res;
    try { res = await window.stressors.build({ clubId:state.clubId, teamId:state.teamId, refStr:state.refDate, days:21, tt }); }
    catch { res=null; }
    state.lastStress = res;
    const items = res?.stressors || [];
    if(!items.length){ list.innerHTML=`<div style="padding:26px 8px;text-align:center;color:var(--cm-fg-faint)"><i class="ti ti-circle-check" style="font-size:22px;color:var(--cm-success)"></i><div style="margin-top:6px">${esc(tt('load_monitor.stress_none','No flagged stressors in the next 21 days.'))}</div></div>`;
      try{ const card=cardOf('stressList'); setPill(card, tt('load_monitor.stress_pill','0 high',{n:0}), false); }catch(e){}
      return; }
    const ico={ heat:'ti-flame', travel:'ti-plane', cong:'ti-calendar-stats' };
    list.innerHTML = items.map(s=>{
      const dt=new Date(s.date+'T00:00:00');
      const when=`<div class="d">${dt.getDate()} ${dt.toLocaleDateString(lang(),{month:'short'})}</div><div class="t">${dt.toLocaleDateString(lang(),{weekday:'short'})}</div>`;
      const sev=tt('load_monitor.sev_'+s.sev, s.sev);
      return `<div class="lm-stress-item">
        <div class="lm-stress-when">${when}</div>
        <div class="lm-stress-rail"><span class="lm-stress-dot ${s.sev==='high'?'is-high':''}"></span>
          <div class="lm-stress-main">
            <div class="tt"><i class="ti ${ico[s.kind]||'ti-alert-triangle'}"></i>${esc(s.title)}</div>
            <div class="meta">${esc(s.hint||'')}</div>
          </div>
        </div>
        <span class="cm-pill ${s.sev==='high'?'is-danger':''}" style="align-self:start"><span class="cm-dot"></span>${esc(sev)}</span>
      </div>`;
    }).join('');
    try{ const hi=items.filter(x=>x.sev==='high').length; const card=cardOf('stressList'); setPill(card, tt('load_monitor.stress_pill',`${hi} high`,{n:hi}), hi>0); }catch(e){}
  }

  // ── Availability watch (per-player 7/28-day GPS sparklines + risk) ────────────
  async function fetchGpsDaily(fromDate,toDate){
    const { data:sess } = await sb().from('training_sessions').select('id,session_date').eq('club_id',state.clubId).gte('session_date',fromDate).lte('session_date',toDate);
    if(!sess?.length) return {};
    const sd=Object.fromEntries(sess.map(s=>[s.id,s.session_date])), ids=sess.map(s=>s.id);
    const active=state.cols||[];
    const colSet=new Set(['player_id','session_id']);
    active.forEach(k=>{ if(k==='accel_decel'){ colSet.add('accelerations'); colSet.add('decelerations'); } else colSet.add(k); });
    const cols=Array.from(colSet).join(',');
    let rows;
    try{
      rows = window.cmFetchAll
        ? await window.cmFetchAll(()=> sb().from('gps_reports').select(cols).eq('club_id',state.clubId).in('session_id',ids), {label:'lm.avail'})
        : ((await sb().from('gps_reports').select(cols).eq('club_id',state.clubId).in('session_id',ids)).data||[]);
    }catch{ rows=[]; }
    const byP={};
    (rows||[]).forEach(r=>{ const date=sd[r.session_id]; if(!date) return;
      const rec={ date }; active.forEach(k=>{ rec[k]=colVal(r,k); });
      (byP[r.player_id]||(byP[r.player_id]=[])).push(rec); });
    return byP;
  }

  // Daily availability records (status + minutes) from public.availability.
  async function fetchAvailability(){
    const ids=state.players.map(p=>p.id); if(!ids.length) return {};
    const from=offset(state.refDate,-120);   // lookback for "most recent status <= refDate"
    let rows;
    // TODO: reconectar minutos cuando confirmemos el nombre real de la columna en `availability`
    // (por ahora `minutes` no existe en la tabla → pedirla daba 400 y tumbaba el repintado de columnas).
    try{
      rows = window.cmFetchAll
        ? await window.cmFetchAll(()=> sb().from('availability').select('player_id,date,status').eq('club_id',state.clubId).in('player_id',ids).gte('date',from).lte('date',state.refDate), {label:'lm.availability'})
        : ((await sb().from('availability').select('player_id,date,status').eq('club_id',state.clubId).in('player_id',ids).gte('date',from).lte('date',state.refDate)).data||[]);
    }catch{ rows=[]; }
    const byP={};
    (rows||[]).forEach(r=>{ (byP[r.player_id]||(byP[r.player_id]=[])).push(r); });
    Object.values(byP).forEach(a=> a.sort((x,y)=> x.date<y.date?-1:1));
    return byP;   // per player: chronological [{date,status,minutes}]
  }

  // ── Risk signals (multi-metric ACWR over a 28-day window) ────────────────────
  // Core gps_reports metrics that can be a table column (master), + derived A+D.
  const COL_ELIGIBLE = ['total_distance','high_speed_distance','very_high_speed_distance','sprint_distance','sprint_count','accelerations','decelerations','player_load','distance_per_minute','hmld'];
  const COL_DEFAULT  = ['total_distance','high_speed_distance','distance_per_minute','accel_decel','player_load'];   // the 5 legacy columns
  // Metrics that can act as a risk signal (cumulative load; rates like m/min excluded).
  const SIGNAL_KEYS  = new Set(['total_distance','high_speed_distance','very_high_speed_distance','sprint_distance','sprint_count','accelerations','decelerations','player_load','hmld','accel_decel']);
  const SIGNAL_DEFAULT = ['high_speed_distance','very_high_speed_distance','sprint_distance','accel_decel'];   // high-intensity

  function catalogKeys(){ return new Set((state.catalog||[]).map(m=>m.key)); }
  function colDef(key){ return (state.catalog||[]).find(x=>x.key===key)||null; }
  function signalLabel(key){ if(key==='accel_decel') return 'A+D'; const m=colDef(key); return m? m.label : key; }
  function colLabel(key){ return signalLabel(key); }
  function colUnit(key){ if(key==='accel_decel') return ''; const m=colDef(key); return m&&m.unit? m.unit : ''; }
  function colVal(row, key){ return key==='accel_decel'? (+row.accelerations||0)+(+row.decelerations||0) : (+row[key]||0); }

  // ── Columns (master) ─────────────────────────────────────────────────────────
  function eligibleCols(){ const ck=catalogKeys(); const out=COL_ELIGIBLE.filter(k=>ck.has(k)); if(ck.has('accelerations')&&ck.has('decelerations')) out.push('accel_decel'); return out; }
  function defaultCols(){ const el=new Set(eligibleCols()); const d=COL_DEFAULT.filter(k=>el.has(k)); if(d.length) return d; const e=eligibleCols(); return e.length? e.slice(0,5) : COL_DEFAULT.slice(); }
  function loadCols(){ try{ const s=JSON.parse(localStorage.getItem(`cm_lm_avail_cols_${state.clubId}`)||'null'); if(Array.isArray(s)){ const f=eligibleCols().filter(k=>s.includes(k)); if(f.length) return f; } }catch{} return defaultCols(); }
  function saveCols(){ try{ localStorage.setItem(`cm_lm_avail_cols_${state.clubId}`, JSON.stringify(state.cols)); }catch{} }

  // ── Signals = SUB-TOGGLE of active columns (only load metrics among them) ─────
  function eligibleSignals(){ return (state.cols||[]).filter(k=> SIGNAL_KEYS.has(k)); }
  function defaultSignalSet(){ const el=new Set(eligibleSignals()); const d=SIGNAL_DEFAULT.filter(k=>el.has(k)); return d.length? d : eligibleSignals().slice(0,3); }
  function loadSignalSet(){ try{ const s=JSON.parse(localStorage.getItem(`cm_lm_risk_signals_${state.clubId}`)||'null'); if(Array.isArray(s)){ const f=s.filter(k=>eligibleSignals().includes(k)); if(f.length) return f; } }catch{} return defaultSignalSet(); }
  function saveSignalSet(){ try{ localStorage.setItem(`cm_lm_risk_signals_${state.clubId}`, JSON.stringify(state.signalSet)); }catch{} }

  // Per-player risk from the active signal set. A metric is a "signal" if its ACWR > 1.3.
  // → { signals:[{key,label,acwr}], count, worstAcwr, insufficient }
  async function fetchSignalRisk(){
    const set=state.signalSet||[]; if(!set.length) return {};
    const colSet=new Set(['player_id','session_id']);
    set.forEach(k=>{ if(k==='accel_decel'){ colSet.add('accelerations'); colSet.add('decelerations'); } else colSet.add(k); });
    const cols=Array.from(colSet).join(',');
    const from=offset(state.refDate,-27);   // 28-day chronic window (independent of availWindow)
    const { data:sess } = await sb().from('training_sessions').select('id,session_date').eq('club_id',state.clubId).gte('session_date',from).lte('session_date',state.refDate);
    if(!sess?.length) return {};
    const sd=Object.fromEntries(sess.map(s=>[s.id,s.session_date])), ids=sess.map(s=>s.id);
    let rows;
    try{
      rows = window.cmFetchAll
        ? await window.cmFetchAll(()=> sb().from('gps_reports').select(cols).eq('club_id',state.clubId).in('session_id',ids), {label:'lm.signals'})
        : ((await sb().from('gps_reports').select(cols).eq('club_id',state.clubId).in('session_id',ids)).data||[]);
    }catch{ rows=[]; }
    const byP={};
    (rows||[]).forEach(r=>{ const date=sd[r.session_id]; if(!date) return;
      const per=(byP[r.player_id]||(byP[r.player_id]={_dates:new Set()})); per._dates.add(date);
      set.forEach(k=>{ const val=k==='accel_decel'?(+r.accelerations||0)+(+r.decelerations||0):(+r[k]); if(val==null||isNaN(val)) return; (per[k]||(per[k]=[])).push({date,value:val}); });
    });
    const minSess=(window.gpsACWR?.CONFIG?.minSessions)||4;
    const out={};
    Object.entries(byP).forEach(([pid,per])=>{
      if(per._dates.size<minSess){ out[pid]={ signals:[], count:0, worstAcwr:null, insufficient:true }; return; }
      const signals=[]; let worst=null;
      set.forEach(k=>{ const recs=per[k]; if(!recs||!recs.length) return; const a=window.gpsACWR.acwrForRecords(recs, state.refDate); if(a==null) return; if(worst==null||a>worst) worst=a; if(a>1.3) signals.push({ key:k, label:signalLabel(k), acwr:a }); });
      signals.sort((x,y)=> y.acwr-x.acwr);
      out[pid]={ signals, count:signals.length, worstAcwr:worst, insufficient: worst==null };
    });
    return out;
  }

  function renderSignalsPopover(){
    const el=$('signalsList'); if(!el) return;
    const elig=eligibleSignals();
    if(!elig.length){ el.innerHTML=`<div style="font:var(--cm-body-sm);color:var(--cm-fg-faint);padding:4px 2px">—</div>`; return; }
    el.innerHTML=elig.map(k=>`<label style="display:flex;align-items:center;gap:8px;padding:5px 2px;font:500 12.5px/1 var(--cm-font-sans);cursor:pointer;color:var(--cm-fg)"><input type="checkbox" data-sig="${esc(k)}" ${state.signalSet.includes(k)?'checked':''}> ${esc(signalLabel(k))}</label>`).join('');
    el.querySelectorAll('input[data-sig]').forEach(inp=> inp.addEventListener('change', async ()=>{
      const k=inp.dataset.sig;
      if(inp.checked){ if(!state.signalSet.includes(k)) state.signalSet.push(k); } else state.signalSet=state.signalSet.filter(x=>x!==k);
      saveSignalSet();
      await renderAvailability();
    }));
  }

  function renderColsPopover(){
    const el=$('colsList'); if(!el) return;
    const elig=eligibleCols();
    if(!elig.length){ el.innerHTML=`<div style="font:var(--cm-body-sm);color:var(--cm-fg-faint);padding:4px 2px">—</div>`; return; }
    el.innerHTML=elig.map(k=>`<label style="display:flex;align-items:center;gap:8px;padding:5px 2px;font:500 12.5px/1 var(--cm-font-sans);cursor:pointer;color:var(--cm-fg)"><input type="checkbox" data-col="${esc(k)}" ${state.cols.includes(k)?'checked':''}> ${esc(colLabel(k))}</label>`).join('');
    el.querySelectorAll('input[data-col]').forEach(inp=> inp.addEventListener('change', async ()=>{
      const k=inp.dataset.col;
      if(inp.checked){ if(!state.cols.includes(k)) state.cols.push(k); } else state.cols=state.cols.filter(x=>x!==k);
      state.cols = eligibleCols().filter(x=> state.cols.includes(x));   // keep stable catalog order
      saveCols();
      state.signalSet = state.signalSet.filter(x=> eligibleSignals().includes(x));   // signals sub-toggle of columns
      saveSignalSet(); renderSignalsPopover();
      await renderAvailability();
    }));
  }

  function updateSortHeaders(){
    document.querySelectorAll('#availTableWrap thead th[data-sort]').forEach(th=>{
      const on=th.dataset.sort===state.sortKey; th.classList.toggle('is-sorted', on); th.setAttribute('data-dir', on?state.sortDir:'');
    });
  }
  function rowSortVal(row, key){
    if(key==='player') return row.name.toLowerCase();
    if(key==='avail')  return row.availRank;
    if(key==='mins')   return row.mins;
    if(key==='risk')   return row.risk.insufficient? -1 : row.risk.count + (row.risk.worstAcwr||0)/100;
    const m=row.metrics&&row.metrics[key]; if(m) return m.enough? m.latest : null;   // dynamic metric column
    return 0;
  }
  function renderAvailHead(){
    const row=$('availHeadRow'); if(!row) return;
    const metricTh=(state.cols||[]).map(k=> `<th class="num" data-sort="${esc(k)}">${esc(colLabel(k))}</th>`).join('');
    row.innerHTML = `<th data-sort="player">${esc(tt('common.player','Player'))}</th>`
      + `<th data-sort="avail">${esc(tt('load_monitor.col_availability','Availability'))}</th>`
      + metricTh
      + `<th class="num" data-sort="risk">${esc(tt('load_monitor.col_risk','Risk'))}</th>`;
  }
  function renderAvailRows(){
    const body=$('availBody'); if(!body) return;
    const arr=(state.availRows||[]).slice();
    const key=state.sortKey||'risk', dir=state.sortDir==='asc'?1:-1;
    arr.sort((a,b)=>{ let va=rowSortVal(a,key), vb=rowSortVal(b,key);
      const na=va==null||(typeof va==='number'&&isNaN(va)), nb=vb==null||(typeof vb==='number'&&isNaN(vb));
      if(na&&nb) return 0; if(na) return 1; if(nb) return -1;
      const cmp=typeof va==='string'? va.localeCompare(vb) : va-vb; return cmp*dir; });
    body.innerHTML = arr.map(r=> r.html).join('');
  }

  async function renderAvailability(acwrPer){
    const body=$('availBody'), empty=$('availEmpty'), sub=$('availSub'); if(!body) return;
    if(sub) sub.innerHTML = `${esc(tt('load_monitor.avail_sub', `Per-player ${state.availWindow}-day GPS trend · flagged worst-first`, { days: state.availWindow }))} · <span class="mono">${esc(tt('load_monitor.avail_note','avg hides the individual'))}</span>`;
    const winFrom=offset(state.refDate,-state.availWindow);
    const [gps, avail, sig] = await Promise.all([
      fetchGpsDaily(winFrom,state.refDate).catch(()=>({})),
      fetchAvailability().catch(()=>({})),
      fetchSignalRisk().catch(()=>({})),
    ]);

    if(!state.players.length){ state.availRows=[]; body.innerHTML=''; if(empty){ empty.style.display='block'; empty.innerHTML=`<div style="padding:24px;text-align:center;color:var(--cm-fg-faint)">${esc(tt('load_monitor.avail_none','No players in this squad.'))}</div>`; } return; }
    if(empty) empty.style.display='none';

    // status buckets: [avail-color-class, i18n-label-suffix, sort-rank]. Covers players.status AND availability.status.
    const availCls={ available:['ok','available',1], modified:['mod','modified',2], partial:['mod','partial',2], limited:['mod','limited',2], injured:['out','injured',3], unavailable:['out','unavailable',3], sick:['out','sick',3], away:['unk','away',0] };
    const cols=state.cols||[];   // active columns (catalog keys)

    state.availRows = state.players.map(p=>{
      const recs=(gps[p.id]||[]).slice().sort((a,b)=> a.date<b.date?-1:1);
      const enough = recs.length>=3;
      const posc=POS_CSS[(p.position||'').toUpperCase()]||'mf';
      const arecs=avail[p.id]||[];
      const status=arecs.length? arecs[arecs.length-1].status : p.status;   // most recent record ≤ refDate, else global
      const av=availCls[status]||['unk',null,0];
      const avLbl=av[1]?tt('load_monitor.avail_'+av[1], av[1]):'—';
      const mins=arecs.filter(r=> r.date>=winFrom).reduce((s,r)=> s+(+r.minutes||0), 0);
      const minsHtml=mins>0
        ? `<span class="mins" title="${esc(tt('load_monitor.mins_window','total minutes in the selected window'))}">${esc(tt('load_monitor.col_mins','Min'))} ${mins}′</span>`
        : `<span class="mins-none">—</span>`;

      const metrics={};
      const cells = cols.map(k=>{
        if(!enough){ metrics[k]={enough:false,latest:null}; return `<td class="lm-sparkcell insufficient"><span class="insuf">n&lt;4</span></td>`; }
        const series=recs.map(r=>r[k]);
        const latest=series[series.length-1], mn=mean(series);
        metrics[k]={enough:true,latest};
        const hot = mn && latest>mn*1.2, cool = mn && latest<mn*0.8;
        const unit=colUnit(k);
        const disp = (k==='distance_per_minute')? latest.toFixed(1) : latest>=1000?(latest/1000).toFixed(1)+'k':Math.round(latest);
        return `<td><div class="lm-sparkcell">${spark(series, hot?cssVar('--cm-danger','#ef4444'):cool?cssVar('--cm-success','#22c55e'):accent(),26)}<div class="n ${hot?'hot':cool?'cool':''}">${disp}${unit?`<small style="opacity:.6">${esc(unit)}</small>`:''}</div></div></td>`;
      }).join('');

      // Risk = multi-metric signals (ACWR>1.3 per metric of the active set)
      const rs = sig[p.id] || { signals:[], count:0, worstAcwr:null, insufficient:true };
      const riskCls = rs.insufficient? 'low' : ((rs.worstAcwr!=null&&rs.worstAcwr>1.5)||rs.count>=2)?'high': rs.count===1?'med':'low';
      const riskLab = rs.insufficient? 'n<4'
        : (rs.count===0? tt('load_monitor.risk_none','No signals')
          : rs.count===1? tt('load_monitor.risk_count_one','1 signal')
          : tt('load_monitor.risk_count_many','{n} signals',{n:rs.count}));
      const detail = rs.signals.map(s=> `${s.label} ${s.acwr.toFixed(2)}`).join(' · ');
      const riskCell = `<td><div class="lm-risk ${riskCls}"${detail?` title="${esc(detail)}"`:''}><span class="bar"><i></i><i></i><i></i></span><span class="lab">${esc(riskLab)}</span>${detail?`<span class="sig">${esc(detail)}</span>`:''}</div></td>`;

      const name=((p.first_name||'')+' '+(p.last_name||'')).trim();
      const html = `<tr>
        <td><div class="lm-player"><div class="who"><div class="nm">${esc(name||tt('common.player','Player'))}</div>
          <div class="role"><span class="pos-chip ${posc}">${esc((p.position||'—').toUpperCase())}</span>${p.number!=null?`#${esc(p.number)}`:''}</div>
          ${minsHtml}</div></div></td>
        <td><span class="lm-avail ${av[0]}"><span class="cm-dot"></span>${esc(avLbl)}</span></td>
        ${cells}
        ${riskCell}
      </tr>`;

      return { name: name||'', availRank: av[2]!=null?av[2]:0, mins, metrics, risk: rs, html };
    });

    renderAvailHead();
    updateSortHeaders();
    renderAvailRows();
  }

  // ── Decision queue (auto-derived + user-added) ───────────────────────────────
  function actionsKey(){ return `cm_lm_actions_${state.clubId||'x'}`; }
  function loadActions(){ try{ return JSON.parse(localStorage.getItem(actionsKey())||'[]'); }catch{ return []; } }
  function saveActions(a){ try{ localStorage.setItem(actionsKey(), JSON.stringify(a)); }catch{} }

  function renderDecisionQueue(){
    const list=$('dqList'); if(!list) return;
    const squad=state.lastSquad, stress=state.lastStress;
    const items=[];
    const per=squad?.perPlayer||{};
    const danger=Object.entries(per).filter(([,v])=>v.acwr!=null&&v.acwr>1.5).map(([id])=>id);
    const over=Object.entries(per).filter(([,v])=>v.acwr!=null&&v.acwr>1.3&&v.acwr<=1.5);
    const nameOf=id=>{ const p=state.players.find(x=>x.id===id); return p?`${(p.first_name||'')[0]||''}. ${p.last_name||''}`.trim():'player'; };

    if(danger.length) items.push({ ic:'ti-alert-triangle', prio:'high',
      t:tt('load_monitor.dq_review_hsr', `Review high-speed exposure (${danger.length})`, {n:danger.length}),
      who:`${tt('load_monitor.role_sport_science','Sport Science')} · ${danger.map(nameOf).slice(0,3).join(', ')}${danger.length>3?'…':''}` });
    if(over.length)   items.push({ ic:'ti-activity', prio:'med',
      t:tt('load_monitor.dq_adjust_md2', `Adjust MD-2 loading · ${over.length} in overreach`, {n:over.length}),
      who:tt('load_monitor.role_fitness','Fitness coach') });
    const hiStr=(stress?.stressors||[]).filter(s=>s.sev==='high');
    hiStr.slice(0,2).forEach(s=> items.push({ ic: s.kind==='heat'?'ti-flame':s.kind==='travel'?'ti-plane':'ti-calendar-stats', prio:'med',
      t:tt('load_monitor.dq_mitigation', `Mitigation plan · ${s.title}`, {title:s.title}),
      who:`${new Date(s.date+'T00:00:00').toLocaleDateString(lang(),{day:'numeric',month:'short'})}` }));
    const restr=state.players.filter(p=>['injured','modified','unavailable','sick'].includes(p.status));
    if(restr.length) items.push({ ic:'ti-heart-rate-monitor', prio:'med',
      t:tt('load_monitor.dq_rehab', `Rehab progression update · ${restr.length} players`, {n:restr.length}),
      who:tt('load_monitor.role_medical','Medical') });
    items.push({ ic:'ti-clipboard-check', prio:'low', t:tt('load_monitor.dq_confirm_xi','Confirm starting XI for MD'), who:tt('load_monitor.role_coach','Head coach') });

    // user-added actions (persisted)
    const ua=loadActions();
    ua.forEach((a,idx)=> items.push({ ic:'ti-user-plus', prio:a.prio||'low', t:a.t, who:tt('load_monitor.dq_added_by_you','Added by you'), userIdx:idx }));

    const pill={ high:'is-prio-high', med:'is-prio-med', low:'is-prio-low' };
    const plab={ high:tt('load_monitor.prio_high','High'), med:tt('load_monitor.prio_med','Medium'), low:tt('load_monitor.prio_low','Low') };
    list.innerHTML = items.map(i=>`
      <div class="lm-dq-item">
        <div class="lm-dq-ic"><i class="ti ${i.ic}"></i></div>
        <div class="lm-dq-main"><div class="t">${esc(i.t)}</div><div class="who"><i class="ti ti-user"></i>${esc(i.who)}</div></div>
        <div class="lm-dq-right"><span class="cm-pill ${pill[i.prio]}">${esc(plab[i.prio])}</span>${i.userIdx!=null?`<button class="cm-icon-btn is-sm" data-rm="${i.userIdx}" title="${esc(tt('load_monitor.dq_remove','Remove'))}"><i class="ti ti-x"></i></button>`:''}</div>
      </div>`).join('');
    list.querySelectorAll('[data-rm]').forEach(b=> b.addEventListener('click', ()=>{
      const a=loadActions(); a.splice(+b.dataset.rm,1); saveActions(a); renderDecisionQueue();
    }));
  }

  function addAction(){
    const txt=(window.prompt(tt('load_monitor.dq_add_prompt','Describe the action:'))||'').trim();
    if(!txt) return;
    const a=loadActions(); a.push({ t:txt, prio:'med' }); saveActions(a); renderDecisionQueue();
  }

  // ── Export Markdown report ───────────────────────────────────────────────────
  function exportMd(){
    const s=state.lastSquad, ex=state.lastExposure, st=state.lastStress;
    const teamName=(()=>{ const sel=$('teamSel'); return sel&&sel.selectedOptions[0]? sel.selectedOptions[0].textContent : ''; })();
    const date=new Date(state.refDate+'T00:00:00').toLocaleDateString(lang(),{weekday:'long',day:'numeric',month:'long',year:'numeric'});
    const av=state.players.filter(p=>p.status==='available').length;
    const L=[];
    L.push(`# ${tt('load_monitor.crumb_title','Load monitor')} — ${date}`);
    L.push(`${teamName} · ${av}/${state.players.length} ${tt('load_monitor.avail_available','available').toLowerCase()}`,'');
    // ACWR
    const c=s?.counts||{under:0,sweet:0,over:0,risk:0,noData:0};
    const med=s? median(Object.values(s.perPlayer).map(p=>p.acwr)) : null;
    L.push(`## ${tt('load_monitor.acwr_title2','Acute:chronic workload ratio')} (${metricLabel()} · ${modelLabel()})`);
    L.push(`- ${tt('load_monitor.kpi_squad_acwr','Squad ACWR')}: ${med!=null?med.toFixed(2):'—'}`);
    L.push(`- ${tt('load_monitor.kpi_risk_zone','Players in risk zone')}: ${c.over+c.risk}/${state.players.length} (danger ${c.risk})`);
    L.push(`- Zones: under ${c.under} · sweet ${c.sweet} · over ${c.over} · risk ${c.risk}`,'');
    // Players
    L.push(`| ${tt('common.player','Player')} | ${tt('common.position','Position')} | ${tt('load_monitor.col_availability','Availability')} | ACWR |`);
    L.push('|---|---|---|---|');
    state.players.forEach(p=>{ const a=s?.perPlayer?.[p.id]; const acwr=a&&a.acwr!=null?a.acwr:(a&&a.insufficient?'n<4':'—');
      const status=tt('load_monitor.avail_'+p.status, p.status||'—');
      L.push(`| ${(p.first_name||'')+' '+(p.last_name||'')} | ${(p.position||'—').toUpperCase()} | ${status} | ${acwr} |`); });
    L.push('');
    // GPS exposure
    if(ex&&ex.tiles){ L.push(`## ${tt('load_monitor.gps_exposure2','GPS exposure')}`);
      ex.tiles.forEach(t=>{ const d=t.delta; L.push(`- ${tt('load_monitor.exp_'+t.key,t.label)}: ${ex.fmtVal(t.current,t.fmt)} (${d==null?'—':(d>0?'+':'')+d.toFixed(0)+'%'})`); }); L.push(''); }
    // Stressors
    const items=st?.stressors||[];
    L.push(`## ${tt('load_monitor.stressors_title','Impending stressors')} (${items.length})`);
    items.forEach(x=> L.push(`- ${x.date} [${tt('load_monitor.sev_'+x.sev,x.sev)}] ${x.title}${x.hint?` — ${x.hint}`:''}`));
    if(!items.length) L.push(`- ${tt('load_monitor.stress_none','No flagged stressors in the next 21 days.')}`);
    L.push('');

    const blob=new Blob([L.join('\n')],{type:'text/markdown'});
    const url=URL.createObjectURL(blob); const a=document.createElement('a');
    a.href=url; a.download=`load-monitor_${state.refDate}.md`; a.click(); URL.revokeObjectURL(url);
  }

  // ── orchestration ────────────────────────────────────────────────────────────
  async function loadAll(){
    setPageContext();
    await renderACWR();                                   // sets state.lastSquad
    try { state.lastStress = await window.stressors.build({ clubId:state.clubId, teamId:state.teamId, refStr:state.refDate, days:21, tt }); } catch { state.lastStress=null; }
    await Promise.all([ renderExposure(), renderStressors(), renderAvailability(state.lastSquad?.perPlayer) ]);
    renderDecisionQueue();
  }

  async function loadPlayers(){
    try {
      const q = window.cmTeamPlayers
        ? window.cmTeamPlayers(state.teamId, 'id,first_name,last_name,number,position,status').in('status',['available','injured','modified','unavailable','sick','away'])
        : sb().from('players').select('id,first_name,last_name,number,position,status').eq('club_id',state.clubId);
      const { data } = await q.order('number');
      state.players = data || [];
    } catch { state.players = []; }
  }

  async function initTeamSwitch(){
    const sel=$('teamSel'); if(!sel) return;
    let teams=[];
    try { teams = await window.getTeams(state.clubId); } catch {}
    if(!teams.length){ state.teamId=null; return; }
    let full=false; try{ full=await window.isSuperAdmin?.(); }catch{}
    if(!full){ try{ const mine=(await sb().rpc('my_team_ids')).data||[]; const s=new Set(mine); const f=teams.filter(t=>s.has(t.id)); if(f.length) teams=f; }catch{} }
    const saved=sessionStorage.getItem('cal_active_team');
    state.teamId=(saved&&teams.some(t=>t.id===saved))?saved:teams[0].id;
    sel.innerHTML=teams.map(t=>`<option value="${t.id}" ${t.id===state.teamId?'selected':''}>${esc(t.name)}</option>`).join('');
    sel.addEventListener('change', async ()=>{ state.teamId=sel.value; sessionStorage.setItem('cal_active_team',state.teamId); await loadPlayers(); await loadAll(); });
  }

  function wireControls(){
    const ms=$('metricSel'); ms?.addEventListener('change', async ()=>{ state.metric=ms.value; await renderACWR(); await renderAvailability(state.lastSquad?.perPlayer); renderDecisionQueue(); });
    const sbtn=$('settingsBtn'), pop=$('settingsPop');
    sbtn?.addEventListener('click', e=>{ e.stopPropagation(); pop?.classList.toggle('on'); });
    document.addEventListener('click', e=>{ if(pop?.classList.contains('on') && !pop.contains(e.target) && e.target!==sbtn) pop.classList.remove('on'); });
    document.querySelectorAll('.lm-seg2[data-set="model"] button').forEach(b=> b.addEventListener('click', async ()=>{
      state.model = b.dataset.model || 'ewma';
      document.querySelectorAll('.lm-seg2[data-set="model"] button').forEach(x=>x.classList.toggle('on',x===b));
      await renderACWR(); renderDecisionQueue();
    }));
    document.querySelectorAll('.lm-seg2[data-set="couple"] button').forEach(b=> b.addEventListener('click', async ()=>{
      state.coupled = b.dataset.couple==='1';
      document.querySelectorAll('.lm-seg2[data-set="couple"] button').forEach(x=>x.classList.toggle('on',x===b));
      await renderACWR(); renderDecisionQueue();
    }));
    // Availability 7D / 28D window
    document.querySelectorAll('#availSeg button').forEach(b=> b.addEventListener('click', async ()=>{
      state.availWindow = +b.dataset.win || 7;
      document.querySelectorAll('#availSeg button').forEach(x=>x.classList.toggle('on',x===b));
      await renderAvailability(state.lastSquad?.perPlayer);
    }));
    $('btnRefresh')?.addEventListener('click', ()=> loadAll());
    $('btnExportMd')?.addEventListener('click', exportMd);
    $('btnAddAction')?.addEventListener('click', addAction);
    // Risk-signals config popover (checkboxes of eligible catalog metrics)
    const sigBtn=$('signalsBtn'), sigPop=$('signalsPop');
    if(sigBtn&&sigPop){
      renderSignalsPopover();
      sigBtn.addEventListener('click', e=>{ e.stopPropagation(); renderSignalsPopover(); sigPop.classList.toggle('on'); });
      document.addEventListener('click', e=>{ if(sigPop.classList.contains('on') && !sigPop.contains(e.target) && !sigBtn.contains(e.target)) sigPop.classList.remove('on'); });
    }
    // Columns config popover (master selector of which metrics to show)
    const colBtn=$('colsBtn'), colPop=$('colsPop');
    if(colBtn&&colPop){
      renderColsPopover();
      colBtn.addEventListener('click', e=>{ e.stopPropagation(); renderColsPopover(); colPop.classList.toggle('on'); });
      document.addEventListener('click', e=>{ if(colPop.classList.contains('on') && !colPop.contains(e.target) && !colBtn.contains(e.target)) colPop.classList.remove('on'); });
    }
    // Sortable availability headers — delegated (headers are re-rendered dynamically)
    const availHead=document.querySelector('#availTableWrap thead');
    availHead?.addEventListener('click', e=>{ const th=e.target.closest('th[data-sort]'); if(!th) return;
      const k=th.dataset.sort;
      if(state.sortKey===k) state.sortDir = state.sortDir==='desc'?'asc':'desc';
      else { state.sortKey=k; state.sortDir = k==='player'?'asc':'desc'; }
      updateSortHeaders(); renderAvailRows();
    });
    // Re-render dynamic text when the language changes (static tags handled by CM_I18N).
    document.addEventListener('cm:langchanged', ()=> loadAll());
  }

  // ── boot ─────────────────────────────────────────────────────────────────────
  (async function boot(){
    try { if(window.guardModule && !(await window.guardModule())) return; } catch {}
    try { await Promise.all([window.getProfile?.(), window.getClub?.()]); } catch {}
    try { state.clubId = await window.getClubId(); } catch { state.clubId=null; }
    try { window.applyClubTheme?.(); } catch {}
    if(!state.clubId){ console.warn('[LM] no club id'); return; }

    try { state.catalog = await window.getCatalog?.(state.clubId) || []; } catch { state.catalog=[]; }
    state.cols = loadCols();
    state.signalSet = loadSignalSet();

    await initTeamSwitch();
    await loadPlayers();
    wireControls();
    await loadAll();
  })();
})();
