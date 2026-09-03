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
  // ACWR zone → CSS class + translated label (same cutoffs as gpsACWR.ZONES).
  function zoneInfo(v){
    if(v==null||!isFinite(v)) return null;
    if(v>1.5)  return { cls:'danger', label:tt('load_monitor.zone_danger','Danger') };
    if(v>1.3)  return { cls:'over',   label:tt('load_monitor.zone_overreach','Overreach') };
    if(v>=0.8) return { cls:'sweet',  label:tt('load_monitor.zone_sweet_spot','Sweet spot') };
    return { cls:'under', label:tt('load_monitor.zone_underloaded','Underloaded') };
  }
  // Canvas-safe alpha tint of a CSS color (#hex or rgb/rgba) — CSS vars can't be alpha'd on canvas.
  function tint(c,a){
    c=(c||'').trim();
    if(c[0]==='#'){ let h=c.slice(1); if(h.length===3) h=h.replace(/./g,x=>x+x); const n=parseInt(h,16); return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`; }
    const m=c.match(/rgba?\(([^)]+)\)/); return m? `rgba(${m[1].split(',').slice(0,3).map(s=>s.trim()).join(',')},${a})` : c;
  }
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
  const state = { clubId:null, teamId:null, players:[], refDate:iso(new Date()), seasonStart:null,
    metric:'srpe', model:'ewma', coupled:false, availWindow:7, chart:null,
    lastSquad:null, lastStress:null, lastExposure:null,
    catalog:[], cols:[], signalSet:[], sortKey:'risk', sortDir:'desc', availRows:[] };

  // Active season start anchors the GPS-exposure baseline (so a fresh season isn't
  // compared against stray pre-season days). Prefer a season scoped to the active
  // team that contains refDate; fall back to a club-wide one, else the latest.
  async function loadSeason(){
    state.seasonStart=null;
    if(!state.clubId) return;
    try{
      const { data } = await sb().from('seasons')
        .select('start_date,end_date,status,team_id').eq('club_id',state.clubId).eq('status','active')
        .order('start_date',{ascending:false});
      const rows=(data||[]).filter(s=>s.start_date);
      if(!rows.length) return;
      const ref=state.refDate, covers=s=>s.start_date<=ref && (!s.end_date||s.end_date>=ref);
      const pick = rows.find(s=>s.team_id===state.teamId && covers(s))
        || rows.find(s=>!s.team_id && covers(s))
        || rows.find(s=>s.team_id===state.teamId)
        || rows.find(covers) || rows[0];
      state.seasonStart = pick ? pick.start_date : null;
    }catch{ state.seasonStart=null; }
  }

  // The <select> value is either one of the legacy short aliases above (kept so a saved
  // preference keeps working) or, for anything the club added, the metric key itself.
  function metricKey(){ return METRIC_MAP[state.metric] || state.metric || 'srpe_load'; }

  /** Fill the ACWR metric picker from what the CLUB measures.
   *  It used to be six <option>s written into the markup, so MOI could not chart VHSR —
   *  the data was there, the option was not. */
  function fillMetricSel(){
    const sel=$('metricSel'); if(!sel||!window.gpsACWR) return;
    const keep=sel.value;
    try { window.gpsACWR.registerFromCatalog(); } catch(_e){}
    const legacy=Object.entries(METRIC_MAP).reduce((m,[alias,key])=>{ m[key]=alias; return m; },{});
    sel.innerHTML=(window.gpsACWR.METRICS||[]).map(m=>{
      // Legacy aliases keep their value AND their translated label; new ones use the key
      // and the club's own label.
      const alias=legacy[m.key];
      const value=alias||m.key;
      const label=alias ? tt('load_monitor.metric_'+alias, m.label) : m.label;
      return `<option value="${esc(value)}">${esc(label)}</option>`;
    }).join('');
    if(keep && [...sel.options].some(o=>o.value===keep)) sel.value=keep;
    else if(state.metric) sel.value=state.metric;
  }
  function metricLabel(){ const m=window.gpsACWR?.getMetric(metricKey()); return tt('load_monitor.metric_'+state.metric, m? m.label : 's-RPE'); }
  function modelLabel(){ return state.model==='ewma' ? tt('load_monitor.model_ewma','EWMA 7:28') : tt('load_monitor.model_ra','rolling 7:28'); }

  // ── ACWR: KPIs + zones + chart ──────────────────────────────────────────────
  // ── Lesionados / trabajo limitado ────────────────────────────────────────────
  // Su carga no representa el entrenamiento del grupo: queda fuera de los promedios
  // del plantel (mediana ACWR, conteo de riesgo y línea del gráfico). El jugador sigue
  // visible con su ACWR individual en la tabla y en los puntitos.
  const AV_OUT_OF_AVG = new Set(['injured','limited','partial']);
  async function loadOutOfAvg(){
    const out=new Set();
    (state.players||[]).forEach(p=>{ if(p.status==='injured') out.add(String(p.id)); });   // respaldo: sin fila del día
    const ids=(state.players||[]).map(p=>p.id);
    if(ids.length){
      try{
        const { data } = await sb().from('availability').select('player_id,status,team_id')
          .eq('club_id',state.clubId).in('player_id',ids).eq('date',state.refDate);
        // La fila del día manda sobre players.status; y la del equipo activo sobre la global.
        const rows=(data||[]).filter(r=> !r.team_id || !state.teamId || r.team_id===state.teamId);
        const ordered=rows.slice().sort((a,b)=> (a.team_id?1:0)-(b.team_id?1:0));
        ordered.forEach(r=>{ const id=String(r.player_id);
          if(AV_OUT_OF_AVG.has(r.status)) out.add(id); else out.delete(id); });
      }catch{}
    }
    state.outOfAvg=out;
  }
  function isOutOfAvg(pid){ return !!(state.outOfAvg && state.outOfAvg.has(String(pid))); }

  async function renderACWR(){
    const sub=$('acwrSub'); if(sub) sub.textContent=`${metricLabel()} · ${modelLabel()} · ${tt('load_monitor.last6w','last 6 weeks')}`;
    const mn=$('metricName'); if(mn) mn.textContent=metricLabel();

    let squad;
    try { squad = await window.gpsACWR.calculateSquad({ clubId:state.clubId, refDate:state.refDate, metricKey:metricKey(), model:state.model, coupled:state.coupled }); }
    catch { squad=null; }
    // Team isolation: the engine fetches CLUB-wide; keep only the active roster
    // (otherwise other teams' players inflate the KPI/median and show as "?" dots).
    if(squad && state.players.length){
      const roster=new Set(state.players.map(p=>String(p.id)));
      const per={}, counts={ under:0, sweet:0, over:0, risk:0, noData:0 };
      for(const [pid,v] of Object.entries(squad.perPlayer)){
        if(!roster.has(String(pid))) continue;
        // El lesionado/limitado queda marcado (se sigue viendo) pero no entra en los conteos.
        per[pid]= isOutOfAvg(pid) ? { ...v, outOfAvg:true } : v;
        if(isOutOfAvg(pid)) continue;
        if(v.acwr==null){ counts.noData++; continue; }
        const z=zoneInfo(v.acwr);
        if(z.cls==='danger') counts.risk++; else if(z.cls==='over') counts.over++;
        else if(z.cls==='sweet') counts.sweet++; else counts.under++;
      }
      squad.perPlayer=per; squad.counts=counts;
    }
    state.lastSquad = squad;

    const fitPlayers = state.players.filter(p=> !isOutOfAvg(p.id)).length;
    const total = fitPlayers || (squad? Object.keys(squad.perPlayer).filter(id=>!isOutOfAvg(id)).length : 0);
    const c = squad?.counts || { under:0,sweet:0,over:0,risk:0,noData:0 };
    const riskN = c.over + c.risk;
    if($('kpiN')) $('kpiN').textContent = String(riskN);
    if($('kpiDen')) $('kpiDen').textContent = `/ ${total}`;
    // Cuántos quedaron fuera del promedio: sin decirlo, el denominador parece mal.
    const nOut = state.players.filter(p=> isOutOfAvg(p.id)).length;
    const outNote = nOut
      ? ` <span style="color:var(--cm-fg-faint)">· ${esc(tt('load_monitor.kpi_foot_excl', `${nOut} injured / limited excluded`, { count:nOut }))}</span>`
      : '';
    if($('kpiFoot')) $('kpiFoot').innerHTML = tt('load_monitor.kpi_foot',
      `<b>${riskN}</b> players ≥ 1.3 ACWR · <b>${c.risk}</b> above 1.5 (danger).`,
      { risk:`<b>${riskN}</b>`, danger:`<b>${c.risk}</b>` }) + outNote;

    const med = squad ? median(Object.values(squad.perPlayer).filter(p=>!p.outOfAvg).map(p=>p.acwr)) : null;
    const medZone = zoneInfo(med);
    if($('kpiAvg')) $('kpiAvg').innerHTML =
      `<span class="num">${med!=null? med.toFixed(2) : '—'}<small>${tt('load_monitor.squad_median','squad median')}</small></span>`
      + (medZone? `<span class="lm-zone-tag ${medZone.cls}">${esc(medZone.label)}</span>` : '');

    // zone highlight
    const zoneCls = med==null?null: med>1.5?'danger': med>1.3?'over': med>=0.8?'sweet':'under';
    document.querySelectorAll('.lm-zone').forEach(z=> z.classList.toggle('is-active', z.dataset.zone===zoneCls));

    await renderChart();
  }

  async function renderChart(){
    const pane=$('acwrPane'); if(!pane) return;
    let tl;
    try {
      // Fetch club-wide (the engine's only granularity), then scope to the active
      // roster BEFORE averaging — the squad line must not mix in other teams.
      const from=offset(state.refDate,-42);
      const fetchFrom=offset(from,-((window.gpsACWR.CONFIG.chronicDays||28)-1));   // pre-warm the chronic window
      const byPlayer=await window.gpsACWR.fetchByPlayer({ clubId:state.clubId, metricKey:metricKey(), from:fetchFrom, to:state.refDate });
      let scoped=byPlayer;
      if(state.players.length){
        // Roster del equipo y sin lesionados/limitados: la línea del plantel refleja
        // lo que hizo el grupo sano, no la carga recortada de quien está de baja.
        const roster=new Set(state.players.map(p=>String(p.id)));
        scoped={}; for(const [pid,recs] of Object.entries(byPlayer)) if(roster.has(String(pid)) && !isOutOfAvg(pid)) scoped[pid]=recs;
      }
      tl = window.gpsACWR.squadTimeline(scoped, from, state.refDate, { model:state.model, coupled:state.coupled }, fetchFrom);
    }
    catch { tl=null; }

    if(!tl || !tl.dates.length || tl.squadAcwr.every(v=>v==null)){
      // Distinguish "no data at all" from "data exists but no player has enough
      // sessions yet for a stable ACWR baseline" (the chart blanks the latter to
      // stay consistent with the insufficient KPI — see squadTimeline).
      const hasLoad = tl && tl.squadLoad && tl.squadLoad.some(v=>v>0);
      const msg = hasLoad
        ? tt('load_monitor.insufficient_6w', `Not enough ${metricLabel()} sessions yet — a stable ACWR needs ≥4 sessions per player.`, { metric: metricLabel() })
        : tt('load_monitor.no_metric_6w', `No ${metricLabel()} data in the last 6 weeks.`, { metric: metricLabel() });
      pane.innerHTML = `<div class="lm-chart-skeleton" style="animation:none"><div class="lm-empty" style="padding:40px;text-align:center;color:var(--cm-fg-faint)">${esc(msg)}</div></div>`;
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
      <div style="position:relative;height:280px"><canvas id="acwrCanvas"></canvas></div>
      ${distStripHTML()}`;

    const labels = tl.dates.map(d=> new Date(d+'T12:00:00').toLocaleDateString(lang(),{day:'numeric',month:'short'}));
    const fai=cssVar('--cm-fg-faint','#aaa'), acc=accent();
    const maxLoad=Math.max(1,...tl.squadLoad);
    // Fit the ACWR axis to the data (floor at 2.2 so the 0.8/1.3/1.5 zone lines stay
    // visible; cap so a lone residual outlier can't flatten the meaningful range).
    const acwrVals=tl.squadAcwr.filter(v=>v!=null);
    const maxAcwr=acwrVals.length?Math.max(...acwrVals):0;
    const yMax=Math.min(6, Math.max(2.2, Math.ceil((maxAcwr+0.15)*10)/10));
    if(state.chart){ state.chart.destroy(); state.chart=null; }
    // Zone bands painted behind the series: the line's position IN a colored zone
    // carries the meaning — no need to memorize the 0.8/1.3/1.5 cutoffs.
    const zoneBands={ id:'zoneBands', beforeDraw(chart){
      const area=chart.chartArea, y=chart.scales&&chart.scales.y; if(!area||!y) return;
      const bands=[
        [y.min,0.8, cssVar('--cm-info','#3B82F6'),    0.05],
        [0.8,  1.3, cssVar('--cm-success','#22C55E'), 0.07],
        [1.3,  1.5, cssVar('--cm-warning','#F59E0B'), 0.08],
        [1.5, y.max,cssVar('--cm-danger','#EF4444'),  0.07],
      ];
      const ctx=chart.ctx; ctx.save();
      for(const [a,b,c,al] of bands){
        if(b<=y.min||a>=y.max) continue;
        const top=y.getPixelForValue(Math.min(b,y.max)), bot=y.getPixelForValue(Math.max(a,y.min));
        ctx.fillStyle=tint(c,al); ctx.fillRect(area.left, top, area.right-area.left, bot-top);
      }
      ctx.restore();
    }};
    state.chart = new Chart($('acwrCanvas'), {
      data:{ labels, datasets:[
        { type:'bar', label:loadLbl, data:tl.squadLoad, backgroundColor:'rgba(120,120,130,0.16)', borderWidth:0, borderRadius:2, yAxisID:'y2', order:5 },
        { type:'line', label:acwrLbl, data:tl.squadAcwr, borderColor:acc, backgroundColor:'rgba(99,102,241,0.08)', borderWidth:2.5, pointRadius:2.5, pointHoverRadius:5, tension:0.3, fill:true, spanGaps:true, yAxisID:'y', order:1 },
      ]},
      plugins:[zoneBands],
      options:{ responsive:true, maintainAspectRatio:false, interaction:{mode:'index',intersect:false},
        plugins:{ legend:{display:false},
          tooltip:{ callbacks:{ label:(c)=>{
            const v=c.parsed.y;
            if(c.dataset.label===acwrLbl && v!=null){ const z=zoneInfo(v); return ` ${acwrLbl}: ${v.toFixed(2)}${z?` · ${z.label}`:''}`; }
            return ` ${c.dataset.label}: ${v>=1000?(v/1000).toFixed(1)+'k':v}`;
          } } } },
        scales:{
          y:{ min:0, max:yMax, position:'left', grid:{color:'rgba(128,128,128,0.10)'}, ticks:{color:fai,font:{size:11},callback:v=>v.toFixed(1)} },
          y2:{ position:'right', max:maxLoad*3, grid:{display:false}, ticks:{color:fai,font:{size:10},callback:v=> v>=1000?(v/1000).toFixed(0)+'k':v} },
          x:{ grid:{color:'rgba(128,128,128,0.06)'}, ticks:{color:fai,font:{size:10},maxTicksLimit:10} },
        } }
    });
    bindDistTip(pane);
  }

  // ── Squad distribution strip (one dot per player over the zone bands) ────────
  // The squad line/median hides individuals; this makes every player visible at
  // a glance — who's in which zone and who's the outlier.
  function distStripHTML(){
    const squad=state.lastSquad; if(!squad) return '';
    const nameOf={}; state.players.forEach(p=>{ nameOf[p.id]=((p.first_name||'')+' '+(p.last_name||'')).trim(); });
    const pts=Object.entries(squad.perPlayer||{})
      .filter(([,v])=> v.acwr!=null)
      .map(([id,v])=>({ name:nameOf[id]||'?', acwr:v.acwr, out:!!v.outOfAvg }))
      .sort((a,b)=> a.acwr-b.acwr);
    if(!pts.length) return '';
    const min=0.4, max=Math.max(1.8, Math.min(3, pts[pts.length-1].acwr+0.15));
    const X=v=> Math.max(0, Math.min(100, (v-min)/(max-min)*100));
    const seg=(a,b,cls)=> `<span class="seg ${cls}" style="left:${X(a)}%;width:${(X(b)-X(a)).toFixed(2)}%"></span>`;
    const bands=seg(min,0.8,'under')+seg(0.8,1.3,'sweet')+seg(1.3,1.5,'over')+seg(1.5,max,'danger');
    let lastX=-99, row=0;
    const dots=pts.map(p=>{
      const x=X(p.acwr);
      row = (x-lastX<3.2)? (row+1)%3 : 0; lastX=x;   // nudge overlapping dots onto 3 lanes
      const z=zoneInfo(p.acwr);
      // El lesionado se sigue viendo (su ACWR importa para el retorno) pero va hueco:
      // no pesa en la mediana ni en el conteo de riesgo.
      return `<span class="dot ${z.cls} r${row}${p.out?' is-out':''}" style="left:${x.toFixed(2)}%" data-name="${esc(p.name)}" data-acwr="${p.acwr}"${p.out?' data-out="1"':''}></span>`;
    }).join('');
    const ticks=[0.8,1.3,1.5].map(v=> `<span class="tick" style="left:${X(v).toFixed(2)}%">${v.toFixed(1)}</span>`).join('');
    return `<div class="lm-dist">
      <div class="lm-dist-head"><span class="t">${esc(tt('load_monitor.dist_title','Squad distribution'))}</span><span class="h">${esc(tt('load_monitor.dist_hint','one dot per player · today'))}</span></div>
      <div class="lm-dist-track">${bands}${dots}</div>
      <div class="lm-dist-axis">${ticks}</div>
      <div class="lm-dist-tip"></div>
    </div>`;
  }

  // Custom hover card for the distribution dots (replaces the browser's native
  // title tooltip): player name + ratio + zone tag, clamped inside the strip.
  function bindDistTip(pane){
    const wrap=pane.querySelector('.lm-dist'); if(!wrap) return;
    const track=wrap.querySelector('.lm-dist-track'), tip=wrap.querySelector('.lm-dist-tip');
    if(!track||!tip) return;
    track.addEventListener('mouseover', e=>{
      const d=e.target.closest('.dot'); if(!d) return;
      const a=+d.dataset.acwr, z=zoneInfo(a);
      tip.innerHTML=`<div class="nm">${esc(d.dataset.name||'')}</div>`
        + `<div class="row"><span class="val">${isFinite(a)?a.toFixed(2):'—'}</span>${z?`<span class="lm-zone-tag ${z.cls}">${esc(z.label)}</span>`:''}</div>`
        + (d.dataset.out? `<div class="row" style="font:500 10.5px/1.3 var(--cm-font-sans);color:var(--cm-fg-faint)">${esc(tt('load_monitor.dot_out_of_avg','Injured / limited · not in the squad average'))}</div>` : '');
      tip.classList.add('on');
      const wr=wrap.getBoundingClientRect(), dr=d.getBoundingClientRect();
      const cx=dr.left+dr.width/2-wr.left;                       // dot center in .lm-dist coords
      const half=tip.offsetWidth/2;
      const left=Math.max(half+2, Math.min(wrap.clientWidth-half-2, cx));
      tip.style.left=left+'px';
      tip.style.top=(track.offsetTop - tip.offsetHeight - 9)+'px';
      tip.style.setProperty('--ax', (cx-left)+'px');             // keep the arrow on the dot when clamped
    });
    track.addEventListener('mouseout', e=>{ if(e.target.closest('.dot')) tip.classList.remove('on'); });
  }

  // ── GPS exposure tiles ──────────────────────────────────────────────────────
  async function renderExposure(){
    const grid=$('gpsGrid'), empty=$('gpsEmpty'); if(!grid) return;
    let res;
    try { res = await window.gpsExposure.compute({ clubId:state.clubId, players:state.players, refDate:state.refDate, level:'squad', seasonStart:state.seasonStart }); }
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
    // Baseline readiness. With a season anchor (baselineReady), the % only shows once
    // enough complete in-season weeks exist — until then it's "building". Without a
    // season, fall back to the thin-baseline heuristic so a low base can't fake a spike.
    const building = !res.baselineReady;
    const weak = !building && !res.seasonStart && exposureLowConfidence(res);
    const buildTxt = `${res.baseWeeksInSeason||0}/${res.minBaselineWeeks||2}`;
    grid.innerHTML = res.tiles.map(t=>{
      const d=t.delta;
      const suspect = weak && t.agg!=='mean' && d!=null && d>=100;   // volume metric on a thin baseline
      let chip;
      if(building){
        chip=`<span class="lm-delta flat" title="${esc(tt('load_monitor.exp_building_tip','Baseline still building — weeks since season start'))}"><i class="ti ti-progress"></i>${esc(buildTxt)}</span>`;
      }else{
        const dCls = suspect?'flat': d==null?'flat': d>=2?'up': d<=-2?'down':'flat';
        const dIco = suspect?'ti-alert-triangle': d==null?'ti-minus': d>=2?'ti-trending-up': d<=-2?'ti-trending-down':'ti-minus';
        const dTxt = d==null?'—':(d>0?'+':'')+d.toFixed(0)+'%';
        const dTitle = suspect ? esc(tt('load_monitor.exp_lowconf_delta','Baseline built on few sessions — this % is unreliable')) : '';
        chip=`<span class="lm-delta ${dCls}"${dTitle?` title="${dTitle}"`:''}><i class="ti ${dIco}"></i>${dTxt}</span>`;
      }
      const label = tt('load_monitor.exp_'+t.key, t.label);
      const baseTxt = building ? esc(tt('load_monitor.exp_building','building…')) : fmt(t.baseline,t.fmt);
      return `<div class="lm-gps-cell" data-metric="${esc(t.key)}" role="button" tabindex="0" title="${esc(tt('load_monitor.exp_open','Open breakdown'))}">
        <div class="top"><span class="lbl">${esc(label)}</span>${chip}</div>
        <div class="val">${fmt(t.current,t.fmt)}${t.unit?`<small>${esc(t.unit)}</small>`:''}</div>
        ${spark(t.spark, accent(), 34)}
        <div class="base"><span>${esc(tt('load_monitor.exp_baseline','baseline'))}</span><span>${baseTxt}</span></div>
      </div>`;
    }).join('');
    // wire drill-in
    grid.querySelectorAll('.lm-gps-cell[data-metric]').forEach(cell=>{
      const open=()=>openExposureModal(cell.dataset.metric);
      cell.addEventListener('click', open);
      cell.addEventListener('keydown', e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); open(); } });
    });
    try{ const card=cardOf('gpsGrid');
      const subBase=tt('load_monitor.exp_sub', `Weekly totals vs 4-week baseline · ${offset(state.refDate,-6)} → ${state.refDate}`, { from:offset(state.refDate,-6), to:state.refDate });
      let sub=subBase;
      if(building){
        sub += ' · ' + (res.seasonStart
          ? tt('load_monitor.exp_building_sub', `⏳ baseline building · ${res.baseWeeksInSeason||0}/${res.minBaselineWeeks} wks since season start ${res.seasonStart}`, { have:res.baseWeeksInSeason||0, need:res.minBaselineWeeks, date:res.seasonStart })
          : tt('load_monitor.exp_building_sub_nos', '⏳ baseline building · not enough history yet'));
      } else if(weak){ sub += ' · ' + tt('load_monitor.exp_thin_baseline','⚠ thin baseline'); }
      setSub(card, sub);
      setPill(card, tt('load_monitor.exp_pill', `${res.athletes} athletes · ${res.sessions} sessions`, { athletes:res.athletes, sessions:res.sessions }), false);
    }catch(e){}
  }

  // Thin-baseline heuristic: baseline weeks averaged < 2 logged sessions, or the
  // current week has ≥2× the baseline's session count (so summed volume jumps for
  // a logging reason, not a training one).
  function exposureLowConfidence(res){
    const b=res.baseSessionsAvg||0, c=res.curSessions||0;
    return b < 2 || (b > 0 && c >= 2*b);
  }

  // ── GPS exposure drill-in modal ─────────────────────────────────────────────
  function exposureModalStyles(){
    if($('lmExpModalStyles')) return;
    const css=`
    .lmx-ov{position:fixed;inset:0;z-index:var(--cm-z-modal,1000);display:flex;align-items:center;justify-content:center;
      padding:24px;background:color-mix(in srgb,var(--cm-bg) 40%,rgba(0,0,0,.55));backdrop-filter:saturate(140%) blur(3px);}
    .lmx{background:var(--cm-surface);border:1px solid var(--cm-border);border-radius:var(--cm-r-5,16px);box-shadow:var(--cm-shadow-3,0 20px 60px rgba(0,0,0,.35));
      width:min(760px,100%);max-height:calc(100vh - 48px);display:flex;flex-direction:column;overflow:hidden;}
    .lmx-head{display:flex;align-items:flex-start;gap:12px;padding:18px 20px 14px;border-bottom:1px solid var(--cm-border-soft);}
    .lmx-head .tl{flex:1;min-width:0;}
    .lmx-head h3{font:600 17px/1.2 var(--cm-font-sans);color:var(--cm-fg-strong);letter-spacing:-0.01em;}
    .lmx-head .sc{margin-top:4px;font:500 12px/1.3 var(--cm-font-mono);color:var(--cm-fg-faint);}
    .lmx-x{border:0;background:var(--cm-bg-soft);color:var(--cm-fg-muted);width:30px;height:30px;border-radius:var(--cm-r-3);cursor:pointer;flex-shrink:0;font-size:16px;}
    .lmx-x:hover{background:var(--cm-bg-sunk);color:var(--cm-fg);}
    .lmx-body{padding:16px 20px 20px;overflow:auto;}
    .lmx-eq{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 10px;font:500 13px/1.4 var(--cm-font-mono);color:var(--cm-fg-muted);margin:2px 0 14px;}
    .lmx-eq b{font-weight:700;color:var(--cm-fg-strong);}
    .lmx-eq .d{font-weight:700;}
    .lmx-eq .d.up{color:var(--cm-danger);} .lmx-eq .d.down{color:var(--cm-success);} .lmx-eq .d.flat{color:var(--cm-neutral);}
    .lmx-warn{display:flex;gap:8px;align-items:flex-start;padding:10px 12px;border-radius:var(--cm-r-3);margin-bottom:14px;
      background:var(--cm-warning-bg,color-mix(in srgb,var(--cm-warning) 12%,transparent));color:var(--cm-warning);font:500 12px/1.45 var(--cm-font-sans);}
    .lmx-warn .ti{font-size:15px;flex-shrink:0;margin-top:1px;}
    .lmx-chart{margin:6px 0 18px;}
    .lmx-chart svg{width:100%;height:auto;display:block;overflow:visible;}
    .lmx-cap{font:500 10.5px/1 var(--cm-font-mono);fill:var(--cm-fg-faint);}
    .lmx-val{font:700 10.5px/1 var(--cm-font-mono);fill:var(--cm-fg-muted);}
    .lmx-tbl{width:100%;border-collapse:collapse;font:500 12.5px/1.3 var(--cm-font-sans);}
    .lmx-tbl th{text-align:right;font:600 10.5px/1 var(--cm-font-mono);text-transform:uppercase;letter-spacing:.04em;color:var(--cm-fg-faint);padding:0 8px 8px;border-bottom:1px solid var(--cm-border-soft);}
    .lmx-tbl th:first-child{text-align:left;}
    .lmx-tbl td{padding:8px;border-bottom:1px solid var(--cm-border-soft);text-align:right;color:var(--cm-fg);white-space:nowrap;}
    .lmx-tbl td:first-child{text-align:left;color:var(--cm-fg-strong);font-weight:600;}
    .lmx-tbl tr:last-child td{border-bottom:0;}
    .lmx-tbl .sp{width:90px;} .lmx-tbl .sp svg{width:80px;height:20px;display:block;}
    .lmx-d{font:700 11px/1 var(--cm-font-mono);}
    .lmx-d.up{color:var(--cm-danger);} .lmx-d.down{color:var(--cm-success);} .lmx-d.flat{color:var(--cm-fg-faint);}
    .lmx-sech{font:600 11px/1 var(--cm-font-mono);text-transform:uppercase;letter-spacing:.05em;color:var(--cm-fg-faint);margin:4px 0 8px;}`;
    const el=document.createElement('style'); el.id='lmExpModalStyles'; el.textContent=css; document.head.appendChild(el);
  }

  function exposureBarChart(d, fmt){
    // Uniform-scale viewBox (meet) so value labels never distort.
    const vals=d.series, n=vals.length, base=d.baseline;
    const nums=vals.filter(v=>v!=null&&isFinite(v));
    const W=720, chartH=118, botH=22, H=chartH+botH, padX=8, topPad=16;
    const hi=Math.max(base||0, ...nums, 1), gap=(W-padX*2)/n, bw=Math.min(gap*0.5,56);
    const y=v=>chartH-(v/hi)*(chartH-topPad);
    const acc=accent(), muted=cssVar('--cm-fg-faint','#9aa'), warn=cssVar('--cm-warning','#f59e0b');
    const bars=vals.map((v,i)=>{
      if(v==null) return '';
      const cx=padX+gap*i+gap/2, x=cx-bw/2, yy=y(v), h=chartH-yy;
      const cur=i===n-1;
      return `<rect x="${x.toFixed(1)}" y="${yy.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(h,1).toFixed(1)}" rx="3"
        fill="${cur?acc:muted}" opacity="${cur?1:.45}"/>
        <text class="lmx-val" x="${cx.toFixed(1)}" y="${(yy-5).toFixed(1)}" text-anchor="middle">${esc(fmt(v,d.metric.fmt))}</text>`;
    }).join('');
    const baseLine=(base!=null)?`<line x1="${padX}" y1="${y(base).toFixed(1)}" x2="${W-padX}" y2="${y(base).toFixed(1)}"
      stroke="${warn}" stroke-width="1.2" stroke-dasharray="4 3"/>
      <text class="lmx-cap" x="${padX}" y="${(y(base)-4).toFixed(1)}" text-anchor="start" fill="${warn}">${esc(tt('load_monitor.exp_baseline','baseline'))}</text>`:'';
    const labs=vals.map((v,i)=>{ const cx=padX+gap*i+gap/2; const back=n-1-i;
      const lb=back===0?tt('load_monitor.exp_wk_now','now'):('−'+back+'w');
      return `<text class="lmx-cap" x="${cx.toFixed(1)}" y="${H-6}" text-anchor="middle">${esc(lb)}</text>`;}).join('');
    // Season-start marker: dashed vertical line at the left edge of the first in-season week.
    let seasonMark='';
    const si=d.seasonWeekIdxFromNewest;
    if(si!=null && si>0 && si<n){ const mx=padX+gap*si;
      seasonMark=`<line x1="${mx.toFixed(1)}" y1="0" x2="${mx.toFixed(1)}" y2="${chartH}" stroke="${cssVar('--cm-fg-faint','#9aa')}" stroke-width="1" stroke-dasharray="2 3"/>
        <text class="lmx-cap" x="${(mx+3).toFixed(1)}" y="10" text-anchor="start" fill="${cssVar('--cm-fg-faint','#9aa')}">${esc(tt('load_monitor.exp_season_start','season start'))}</text>`; }
    return `<div class="lmx-chart"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">${seasonMark}${baseLine}${bars}${labs}</svg></div>`;
  }

  async function openExposureModal(metricKey){
    exposureModalStyles();
    // build shell immediately (loading), then fill
    const ov=document.createElement('div'); ov.className='lmx-ov';
    ov.innerHTML=`<div class="lmx" role="dialog" aria-modal="true"><div class="lmx-body" style="padding:40px;text-align:center;color:var(--cm-fg-faint)"><i class="ti ti-loader-2"></i> ${esc(tt('common.loading','Loading…'))}</div></div>`;
    document.body.appendChild(ov);
    const close=()=>{ ov.remove(); document.removeEventListener('keydown', onKey); };
    const onKey=e=>{ if(e.key==='Escape') close(); };
    ov.addEventListener('click', e=>{ if(e.target===ov) close(); });
    document.addEventListener('keydown', onKey);

    let d;
    try{ d=await window.gpsExposure.metricDetail({ clubId:state.clubId, players:state.players, refDate:state.refDate, metricKey, seasonStart:state.seasonStart }); }
    catch{ d=null; }
    if(!ov.isConnected) return;
    const fmt=(d&&d.fmtVal)||window.gpsExposure.fmtVal;
    const label=tt('load_monitor.exp_'+metricKey, (d&&d.metric&&d.metric.label)||metricKey);

    if(!d||!d.ok){
      ov.querySelector('.lmx').innerHTML=`<div class="lmx-head"><div class="tl"><h3>${esc(label)}</h3></div><button class="lmx-x" aria-label="Close">✕</button></div>
        <div class="lmx-body" style="color:var(--cm-fg-faint)">${esc(tt('load_monitor.exp_nodetail','No GPS rows for this metric in the window.'))}</div>`;
      ov.querySelector('.lmx-x').addEventListener('click', close); return;
    }

    const building = !d.ready;
    const weak = !building && !d.seasonStart && exposureLowConfidence(d);
    const dv=d.delta, dCls=dv==null?'flat':dv>=2?'up':dv<=-2?'down':'flat';
    const isMean=d.metric.agg==='mean';
    const dTxt=dv==null?'—':(dv>0?'+':'')+dv.toFixed(0)+'%';
    const unit=d.metric.unit?` ${esc(d.metric.unit)}`:'';
    const scope = building
      ? (d.seasonStart
          ? tt('load_monitor.exp_modal_scope_build', `Squad · baseline building ${d.baseWeeks}/${d.minBaselineWeeks} wks since season start`, { have:d.baseWeeks, need:d.minBaselineWeeks })
          : tt('load_monitor.exp_modal_scope_nos', 'Squad · not enough history for a baseline yet'))
      : tt('load_monitor.exp_modal_scope', `Squad · last 7 days vs ${d.baseWeeks}-wk baseline`, { n:d.baseWeeks });

    const warn = building
      ? `<div class="lmx-warn"><i class="ti ti-progress"></i><span>${esc( d.seasonStart
          ? tt('load_monitor.exp_building_note', `Season started ${d.seasonStart}. The baseline needs ${d.minBaselineWeeks} complete weeks before a % is shown — you have ${d.baseWeeks} so far. Until then, read the raw weekly bars and per-player rows below.`,
              { date:d.seasonStart, need:d.minBaselineWeeks, have:d.baseWeeks })
          : tt('load_monitor.exp_building_note_nos','Not enough logged history yet to build a baseline. Read the raw weekly bars and per-player rows below.') )}</span></div>`
      : (weak && !isMean) ? `<div class="lmx-warn"><i class="ti ti-alert-triangle"></i><span>${esc(
          tt('load_monitor.exp_lowconf', `Thin baseline: prior weeks logged ~${d.baseSessionsAvg.toFixed(1)} sessions vs ${d.curSessions} this week. Summed totals jump for a data-logging reason, so the % overstates the real change. Compare per-player rows below instead.`,
            { base:d.baseSessionsAvg.toFixed(1), cur:d.curSessions }))}</span></div>` : '';

    const eq=`<div class="lmx-eq">
      <span>${esc(tt('load_monitor.exp_now','This week'))} <b>${esc(fmt(d.current,d.metric.fmt))}${unit}</b></span>
      <span>−</span>
      <span>${esc(tt('load_monitor.exp_baseline','baseline'))} <b>${building?esc(tt('load_monitor.exp_building','building…')):esc(fmt(d.baseline,d.metric.fmt))+unit}</b></span>
      <span>=</span>
      <span class="d ${building?'flat':dCls}">${building?'—':dTxt}</span>
      <span style="color:var(--cm-fg-faint)">· ${esc(isMean?tt('load_monitor.exp_agg_mean','per-session average'):tt('load_monitor.exp_agg_sum','squad total'))}</span>
    </div>`;

    const rows=d.per.filter(p=>p.current!=null||p.baseline!=null).map(p=>{
      const pd=p.delta, pc=pd==null?'flat':pd>=2?'up':pd<=-2?'down':'flat';
      const pt=pd==null?'—':(pd>0?'+':'')+pd.toFixed(0)+'%';
      return `<tr>
        <td>${esc(p.name)}</td>
        <td>${esc(fmt(p.current,d.metric.fmt))}</td>
        <td style="color:var(--cm-fg-faint)">${esc(fmt(p.baseline,d.metric.fmt))}</td>
        <td class="sp">${spark(p.spark, accent(), 20)}</td>
        <td><span class="lmx-d ${pc}">${pt}</span></td>
      </tr>`;
    }).join('');

    ov.querySelector('.lmx').innerHTML=`
      <div class="lmx-head">
        <div class="tl"><h3>${esc(label)}</h3><div class="sc">${esc(scope)}</div></div>
        <button class="lmx-x" aria-label="${esc(tt('common.close','Close'))}">✕</button>
      </div>
      <div class="lmx-body">
        ${eq}
        ${warn}
        ${exposureBarChart(d, fmt)}
        <div class="lmx-sech">${esc(tt('load_monitor.exp_perplayer','Per-player · this week'))}</div>
        <table class="lmx-tbl">
          <thead><tr>
            <th>${esc(tt('common.player','Player'))}</th>
            <th>${esc(tt('load_monitor.exp_now','This week'))}</th>
            <th>${esc(tt('load_monitor.exp_baseline','baseline'))}</th>
            <th>${esc(tt('load_monitor.exp_trend','6-wk'))}</th>
            <th>Δ</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
    ov.querySelector('.lmx-x').addEventListener('click', close);
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
        ? await window.cmFetchAll(()=> sb().from('availability').select('player_id,date,status').eq('club_id',state.clubId).in('player_id',ids).gte('date',from).lte('date',state.refDate), {label:'lm.availability', orderBy:'date'})
        : ((await sb().from('availability').select('player_id,date,status').eq('club_id',state.clubId).in('player_id',ids).gte('date',from).lte('date',state.refDate)).data||[]);
    }catch{ rows=[]; }
    const byP={};
    (rows||[]).forEach(r=>{ (byP[r.player_id]||(byP[r.player_id]=[])).push(r); });
    Object.values(byP).forEach(a=> a.sort((x,y)=> x.date<y.date?-1:1));
    return byP;   // per player: chronological [{date,status,minutes}]
  }

  // ── Risk signals (multi-metric ACWR over a 28-day window) ────────────────────
  const COL_DEFAULT  = ['total_distance','high_speed_distance','distance_per_minute','accel_decel','player_load'];   // the 5 legacy columns
  // A metric can be a risk signal when it ACCUMULATES: adding up a week of max speeds, or
  // of metres-per-minute, produces a number that means nothing. This used to be a fixed
  // list of football keys; cmGpsCatalog answers it per metric from the club's own
  // catalogue, so a club that adds a cumulative metric of its own gets it here for free.
  function isSignalKey(k){
    if(k==='accel_decel') return true;            // derived: two counts added together
    const C = window.cmGpsCatalog;
    return C ? C.agg(k)==='sum' : false;
  }
  const SIGNAL_DEFAULT = ['high_speed_distance','very_high_speed_distance','sprint_distance','accel_decel'];   // high-intensity

  function catalogKeys(){ return new Set((state.catalog||[]).map(m=>m.key)); }
  function colDef(key){ return (state.catalog||[]).find(x=>x.key===key)||null; }
  function signalLabel(key){ if(key==='accel_decel') return 'A+D'; const m=colDef(key); return m? m.label : key; }
  function colLabel(key){ return signalLabel(key); }
  function colUnit(key){ if(key==='accel_decel') return ''; const m=colDef(key); return m&&m.unit? m.unit : ''; }
  function colVal(row, key){ return key==='accel_decel'? (+row.accelerations||0)+(+row.decelerations||0) : (+row[key]||0); }

  // ── Columns (master) ─────────────────────────────────────────────────────────
  // The picker offers what the CLUB measures, in the club's own order — not a hardcoded
  // football list. Restricted to metrics that are real gps_reports columns, because
  // fetchSignalRisk builds a SELECT out of these keys; custom (key/value) metrics need the
  // join gps-reader does and are not wired here yet.
  function eligibleCols(){
    const ck=catalogKeys();
    const C=window.cmGpsCatalog;
    const out = (C ? C.columns().filter(k=>ck.has(k)) : Array.from(ck));
    if(ck.has('accelerations')&&ck.has('decelerations')) out.push('accel_decel');
    return out;
  }
  function defaultCols(){ const el=new Set(eligibleCols()); const d=COL_DEFAULT.filter(k=>el.has(k)); if(d.length) return d; const e=eligibleCols(); return e.length? e.slice(0,5) : COL_DEFAULT.slice(); }
  function loadCols(){ try{ const s=JSON.parse(localStorage.getItem(`cm_lm_avail_cols_${state.clubId}`)||'null'); if(Array.isArray(s)){ const f=eligibleCols().filter(k=>s.includes(k)); if(f.length) return f; } }catch{} return defaultCols(); }
  function saveCols(){ try{ localStorage.setItem(`cm_lm_avail_cols_${state.clubId}`, JSON.stringify(state.cols)); }catch{} }

  // ── Signals = SUB-TOGGLE of active columns (only load metrics among them) ─────
  function eligibleSignals(){ return (state.cols||[]).filter(isSignalKey); }
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

  // Unified "Metrics" popover: columns = master, signals = sub-toggle of active+eligible columns.
  function renderMetricsPopover(){
    const el=$('signalsList'); if(!el) return;
    const elig=eligibleCols();
    if(!elig.length){ el.innerHTML=`<div style="font:var(--cm-body-sm);color:var(--cm-fg-faint);padding:4px 2px">—</div>`; return; }
    const sigTag=esc(tt('load_monitor.signal_tag','signal'));
    el.innerHTML=elig.map(k=>{
      const isCol=state.cols.includes(k);
      const sigOk=isCol && isSignalKey(k);   // signal only when shown as column AND it accumulates
      const isSig=state.signalSet.includes(k);
      return `<div style="display:flex;align-items:center;gap:8px;padding:5px 2px;color:var(--cm-fg)">`
        + `<label style="display:flex;align-items:center;gap:8px;flex:1;min-width:0;cursor:pointer;font:500 12.5px/1 var(--cm-font-sans)"><input type="checkbox" data-col="${esc(k)}" ${isCol?'checked':''}> <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(colLabel(k))}</span></label>`
        + `<label style="display:flex;align-items:center;gap:5px;cursor:${sigOk?'pointer':'not-allowed'};opacity:${sigOk?'1':'.4'};color:var(--cm-fg-muted);font:600 10.5px/1 var(--cm-font-sans);text-transform:uppercase;letter-spacing:.04em"><input type="checkbox" data-sig="${esc(k)}" ${isSig?'checked':''} ${sigOk?'':'disabled'}> ${sigTag}</label>`
        + `</div>`;
    }).join('');
    el.querySelectorAll('input[data-col]').forEach(inp=> inp.addEventListener('change', async ()=>{
      const k=inp.dataset.col;
      if(inp.checked){ if(!state.cols.includes(k)) state.cols.push(k); } else state.cols=state.cols.filter(x=>x!==k);
      state.cols = eligibleCols().filter(x=> state.cols.includes(x));   // keep stable catalog order
      saveCols();
      state.signalSet = state.signalSet.filter(x=> eligibleSignals().includes(x));   // drop signals whose column was removed
      saveSignalSet(); renderMetricsPopover();   // refresh disabled state of signal checks
      await renderAvailability();
    }));
    el.querySelectorAll('input[data-sig]').forEach(inp=> inp.addEventListener('change', async ()=>{
      const k=inp.dataset.sig;
      if(inp.checked){ if(!state.signalSet.includes(k)) state.signalSet.push(k); } else state.signalSet=state.signalSet.filter(x=>x!==k);
      saveSignalSet();
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
      // Zone-colored chips instead of raw mono text: amber = overreach, red = danger.
      const chips = rs.signals.slice(0,2).map(s=>
        `<span class="lm-sigchip ${s.acwr>1.5?'danger':'over'}">${esc(s.label)} <b>${s.acwr.toFixed(2)}</b></span>`).join('');
      const more = rs.signals.length>2? `<span class="lm-sigchip more">+${rs.signals.length-2}</span>` : '';
      const riskCell = `<td><div class="lm-risk ${riskCls}"${detail?` title="${esc(detail)}"`:''}><span class="bar"><i></i><i></i><i></i></span><span class="lab">${esc(riskLab)}</span>${chips?`<span class="sigs">${chips}${more}</span>`:''}</div></td>`;

      const name=((p.first_name||'')+' '+(p.last_name||'')).trim();
      const ini=(((p.first_name||'')[0]||'')+((p.last_name||'')[0]||'')).toUpperCase()||'?';
      const html = `<tr>
        <td><div class="lm-player"><div class="lm-av" data-cm-photo="${p.id}">${esc(ini)}</div><div class="who"><div class="nm">${esc(name||tt('common.player','Player'))}</div>
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
    await loadOutOfAvg();                                 // lesionados/limitados fuera de los promedios
    await renderACWR();                                   // sets state.lastSquad
    try { state.lastStress = await window.stressors.build({ clubId:state.clubId, teamId:state.teamId, refStr:state.refDate, days:21, tt }); } catch { state.lastStress=null; }
    await Promise.all([ renderExposure(), renderStressors(), renderAvailability(state.lastSquad?.perPlayer) ]);
    renderDecisionQueue();
  }

  async function loadPlayers(){
    try {
      // Solo jugadores cuyo equipo PRIMARIO es el activo. Los invitados (miembros de este
      // equipo pero con primario en otro / segundo equipo) NO deben aparecer acá: su carga se
      // ve en su club/categoría primaria. is_primary lo garantiza el alta/asignación en Squad.
      const q = window.cmTeamPlayers
        ? window.cmTeamPlayers(state.teamId, 'id,first_name,last_name,number,position,status')
            .eq('player_teams.is_primary', true)
            .in('status',['available','injured','modified','unavailable','sick','away'])
        : sb().from('players').select('id,first_name,last_name,number,position,status').eq('club_id',state.clubId);
      const { data } = await q.order('number');
      state.players = data || [];
      if(window.cmLoadPlayerPhotos) window.cmLoadPlayerPhotos(state.clubId);   // ceba caché de fotos (data-cm-photo)
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
    sel.addEventListener('change', async ()=>{ state.teamId=sel.value; sessionStorage.setItem('cal_active_team',state.teamId); await loadSeason(); await loadPlayers(); await loadAll(); });
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
    // Unified Metrics popover: columns (master) + which count as risk signal (sub-toggle)
    const sigBtn=$('signalsBtn'), sigPop=$('signalsPop');
    if(sigBtn&&sigPop){
      renderMetricsPopover();
      sigBtn.addEventListener('click', e=>{ e.stopPropagation(); renderMetricsPopover(); sigPop.classList.toggle('on'); });
      document.addEventListener('click', e=>{ if(sigPop.classList.contains('on') && !sigPop.contains(e.target) && !sigBtn.contains(e.target)) sigPop.classList.remove('on'); });
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

    // Default the ACWR model to the club setting (club_gps_settings.acwr_model) so Load Monitor
    // agrees with every other surface out of the box. UNCOUPLED always. The model/coupling toggles
    // remain as an analyst override, but the DEFAULT view is the unified club model.
    try { state.model = await window.gpsACWR?.loadClubModel?.(state.clubId) || state.model; state.coupled = false; } catch {}

    try { state.catalog = await window.getCatalog?.(state.clubId) || []; } catch { state.catalog=[]; }
    // The picker needs the club's metrics, which arrive with the catalogue.
    try { await window.cmGpsCatalog?.ready(); } catch(_e){}
    fillMetricSel();
    state.cols = loadCols();
    state.signalSet = loadSignalSet();

    await initTeamSwitch();
    await loadSeason();
    await loadPlayers();
    wireControls();
    await loadAll();
  })();
})();
