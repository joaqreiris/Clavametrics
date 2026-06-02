/* =============================================================
   GP Builder Core — shared catalog, types, renderers, config.
   Exposed as window.GP. Pure (state passed in as cfg objects).
   cfg = { type, metrics:[{id,agg}], scope, compare, range,
           size, color, palette, axes, legend, labels, title }
   ============================================================= */
(function () {
  const TYPES = {
    kpi:     { name:'KPI',     icon:'ti-number-123',   min:1, max:1 },
    bars:    { name:'Bars',    icon:'ti-chart-bar',    min:1, max:2 },
    line:    { name:'Line',    icon:'ti-chart-line',   min:1, max:6 },
    scatter: { name:'Scatter', icon:'ti-chart-dots',   min:2, max:2 },
    radar:   { name:'Radar',   icon:'ti-chart-radar',  min:3, max:8 },
    ranking: { name:'Ranking', icon:'ti-list-numbers', min:1, max:1 },
    table:   { name:'Table',   icon:'ti-table',        min:1, max:12 },
    heatmap: { name:'Heatmap', icon:'ti-layout-grid',  min:1, max:12 },
  };
  const REQ_LBL = { kpi:'pick 1', ranking:'pick 1', scatter:'pick 2 (X,Y)', bars:'pick 1–2', line:'pick 1+', radar:'pick 3+', table:'pick 1+', heatmap:'pick 1+' };
  const FULLNAME = { kpi:'KPI', bars:'Bar chart', line:'Line / temporal', scatter:'Scatter', radar:'Radar', ranking:'Ranking', table:'Table', heatmap:'Heatmap' };

  const CATALOG = [
    { g:'Volume', items:[
      { id:'total_distance', name:'Total distance', unit:'km', kind:'accum', sample:11.4, icon:'ti-route' },
      { id:'time_played', name:'Time played', unit:'min', kind:'accum', sample:90, icon:'ti-clock' },
      { id:'meters_per_min', name:'Meters / min', unit:'m/min', kind:'peak', sample:126, icon:'ti-gauge' },
    ]},
    { g:'High intensity', items:[
      { id:'high_speed_distance', name:'High-speed running', unit:'m', kind:'accum', abbr:'HSR >19.8', sample:624, icon:'ti-bolt' },
      { id:'very_high_speed_distance', name:'Very-high-speed dist.', unit:'m', kind:'accum', abbr:'VHSR >25.2', sample:212, icon:'ti-flame' },
      { id:'sprint_distance', name:'Sprint distance', unit:'m', kind:'accum', sample:148, icon:'ti-run' },
      { id:'sprint_count', name:'Sprint count', unit:'#', kind:'accum', sample:19, icon:'ti-flame' },
    ]},
    { g:'Speed', items:[
      { id:'max_speed', name:'Max speed', unit:'km/h', kind:'peak', sample:32.4, icon:'ti-brand-speedtest' },
      { id:'max_acceleration', name:'Max acceleration', unit:'m/s²', kind:'peak', sample:4.8, icon:'ti-trending-up' },
    ]},
    { g:'Accel / Decel', items:[
      { id:'acc_dec', name:'Accel + decel count', unit:'#', kind:'accum', abbr:'>3 m/s²', sample:58, icon:'ti-arrows-up-down' },
      { id:'high_intensity_efforts', name:'High-intensity efforts', unit:'#', kind:'accum', sample:42, icon:'ti-activity' },
    ]},
    { g:'Load', items:[
      { id:'player_load', name:'Player load', unit:'AU', kind:'accum', sample:1478, icon:'ti-battery-3' },
      { id:'hml_distance', name:'High metabolic load', unit:'m', kind:'accum', abbr:'HML', sample:1920, icon:'ti-flame' },
    ]},
    { g:'Custom · EAV', custom:true, items:[
      { id:'cst_asym_index', name:'Asymmetry index', unit:'%', kind:'peak', custom:true, sample:7.2, icon:'ti-arrows-diff' },
      { id:'cst_anaerobic_idx', name:'Anaerobic index', unit:'AU', kind:'accum', custom:true, sample:312, icon:'ti-flask' },
      { id:'cst_acwr', name:'ACWR (load ratio)', unit:'ratio', kind:'peak', custom:true, sample:1.18, icon:'ti-scale' },
    ]},
  ];
  const M = {}; CATALOG.forEach(g => g.items.forEach(m => M[m.id] = m));

  const AGGS = [
    { id:'avg', name:'Average', short:'AVG', icon:'ti-divide', peakOk:true },
    { id:'total', name:'Total (sum)', short:'SUM', icon:'ti-sigma', peakOk:false },
    { id:'median', name:'Median', short:'MED', icon:'ti-chart-dots', peakOk:false },
    { id:'max', name:'Maximum', short:'MAX', icon:'ti-arrow-up', peakOk:true },
    { id:'min', name:'Minimum', short:'MIN', icon:'ti-arrow-down', peakOk:true },
  ];
  const AGG = {}; AGGS.forEach(a => AGG[a.id] = a);
  const COMPARES = [
    { id:'role', name:'vs role baseline', icon:'ti-users', d:'Same position group' },
    { id:'match', name:'vs match baseline', icon:'ti-ball-football', d:'Last match peak' },
    { id:'md', name:'vs same MD code', icon:'ti-calendar-event', d:'Matchday minus code' },
    { id:'none', name:'No comparison', icon:'ti-circle-off', d:'Raw values only' },
  ];
  const RANGES = [
    { id:'mc', name:'MC 46', icon:'ti-calendar-week', d:'Current microcycle' },
    { id:'w7', name:'Last 7 days', icon:'ti-calendar', d:'Rolling week' },
    { id:'w30', name:'Last 30 days', icon:'ti-calendar-month', d:'Rolling month' },
    { id:'season', name:'Season to date', icon:'ti-calendar-stats', d:'2025/26' },
  ];
  const COLORS = [
    { id:'green', hex:'#15803D' }, { id:'blue', hex:'#2563EB' }, { id:'amber', hex:'#D97706' },
    { id:'violet', hex:'#7C3AED' }, { id:'rose', hex:'#E11D48' }, { id:'slate', hex:'#475569' },
  ];
  const PALETTES = [
    { id:'pitch', cols:['#15803D','#22C55E','#86EFAC','#D9F2E1'] },
    { id:'heat', cols:['#1D4ED8','#60A5FA','#FCD34D','#DC2626'] },
    { id:'cool', cols:['#0E7490','#0891B2','#22D3EE','#A5F3FC'] },
    { id:'mono', cols:['#1F2937','#4B5563','#9CA3AF','#E5E7EB'] },
  ];

  const esc = s => String(s).replace(/[<>&]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]));
  const fmt = n => n >= 1000 ? n.toLocaleString('en-US') : (Number.isInteger(n) ? n : n.toFixed(1));
  const defaultAgg = m => m.kind === 'peak' ? 'avg' : 'total';

  function autoTitle(cfg) {
    if (cfg.title) return cfg.title;
    if (!cfg.metrics.length) return FULLNAME[cfg.type];
    const m0 = M[cfg.metrics[0].id];
    if (cfg.type === 'kpi') return m0.name;
    if (cfg.type === 'ranking') return 'Ranking · ' + m0.name;
    if (cfg.type === 'scatter' && cfg.metrics[1]) return m0.name + ' vs ' + M[cfg.metrics[1].id].name;
    return m0.name + (cfg.metrics.length > 1 ? ` +${cfg.metrics.length - 1}` : '');
  }

  function bodyClass(type) {
    if (type === 'kpi') return 'gp-kpi';
    if (type === 'radar') return 'gp-c-b gp-radar';
    if (type === 'scatter') return 'gp-c-b gp-scatter';
    if (type === 'line') return 'gp-c-b gp-ts';
    return 'gp-c-b';
  }

  /* -------- Chart.js: registry + colors -------- */
  const _charts = new WeakMap();
  const GC_GRID  = 'rgba(148,163,184,0.12)';
  const GC_FG    = '#6B7280';
  const GC_FAINT = '#9CA3AF';

  /* =============================================================
     aggregateSeries — the SINGLE data resolver.
     Mirrors the production gp.card/v1 → Dataset contract
     (handoff/config-to-query.ts). No warehouse here, so values are
     synthesized DETERMINISTICALLY from the metric `sample` baseline;
     every chart type consumes this — there is no "example data" path.
     Returns { state:'ok', ... } | { state:'no_data', reason }.
     ============================================================= */
  const ROSTER = [
    { name:'R. Vega',     num:7,  role:'FW' },
    { name:'T. López',    num:9,  role:'FW' },
    { name:'I. Barreiro', num:18, role:'MF' },
    { name:'S. Rivas',    num:6,  role:'MF' },
    { name:'M. Paredes',  num:8,  role:'MF' },
    { name:'R. Sosa',     num:2,  role:'DF' },
    { name:'M. Mtz',      num:4,  role:'DF' },
  ];
  const SCOPED = ROSTER[0];                 /* active player for player-scope cards */
  const SESSIONS_PER = 6;                   /* synthetic sessions behind each aggregate */

  /* FNV-1a → deterministic [0,1) so the same selection always yields the same data */
  function _hash(str){ let h=2166136261>>>0; for(let i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }
  function _fac(seed){ return 0.66 + (_hash(seed)%520)/1000; }          /* ~[0.66, 1.18] */
  function _sessions(metricId, key){
    const base = M[metricId].sample, out=[];
    for (let i=0;i<SESSIONS_PER;i++) out.push(base * _fac(metricId+'|'+key+'|'+i));
    return out;
  }
  function _agg(vals, agg){
    const s=[...vals].sort((a,b)=>a-b);
    if (agg==='total')  return vals.reduce((a,b)=>a+b,0);
    if (agg==='max')    return Math.max(...vals);
    if (agg==='min')    return Math.min(...vals);
    if (agg==='median') return s[Math.floor(s.length/2)];
    return vals.reduce((a,b)=>a+b,0)/vals.length;                       /* avg */
  }
  function _val(metricId, agg, key){ return +_agg(_sessions(metricId,key), agg).toFixed(2); }
  function _roleBaseline(metricId, role){
    const grp = ROSTER.filter(p=>p.role===role);
    return grp.reduce((a,p)=>a+_val(metricId,'avg','p:'+p.name),0)/grp.length;
  }
  function _baselineValue(metricId, baselineId){
    if (baselineId==='match') return _val(metricId,'max','p:'+SCOPED.name)*1.04;
    if (baselineId==='md')    return _val(metricId,'avg','md:'+SCOPED.name);
    return _roleBaseline(metricId, SCOPED.role);                        /* role + default */
  }
  function _dateAxis(range){
    if (range==='season') return ['Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar'];
    if (range==='w30')    return ['Wk-4','Wk-3','Wk-2','Wk-1','This wk'];
    if (range==='w7')     return ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    return ['MD-4','MD-3','MD-2','MD-1','MD','MD+1'];                   /* mc microcycle */
  }
  function _short(m){ return m.abbr || m.name.split(' ').slice(0,2).join(' '); }
  function _paletteCols(cfg){ return (PALETTES.find(p=>p.id===cfg.palette)||PALETTES[0]).cols; }
  function _seriesColor(cfg, i){ const pal=_paletteCols(cfg); return i===0 ? (cfg.color||'#15803D') : (pal[(i-1)%pal.length]); }

  function aggregateSeries(cfg){
    const reason = noDataReason(cfg);
    if (reason) return { state:'no_data', reason };
    const fields = (cfg.metrics||[]).map(f=>({ ref:f, m:M[f.id] })).filter(x=>x.m);
    if (fields.length < (TYPES[cfg.type]||{min:1}).min) return { state:'no_data', reason:'Not enough metrics selected.' };

    const type = cfg.type;
    const baselineId = (cfg.compare && cfg.compare!=='none') ? cfg.compare : null;
    const players = ROSTER.map(p=>({ name:p.name, short:p.name, num:p.num }));

    /* radar / kpi → one aggregate per metric for the scoped entity, vs a baseline */
    if (type==='radar') {
      const labels=[], playerPct=[], basePct=[];
      fields.forEach(({ref,m})=>{
        const val = _val(m.id, ref.agg, 'p:'+SCOPED.name);
        const ref0 = _baselineValue(m.id, baselineId || 'role') || val || 1;
        labels.push(_short(m));
        playerPct.push(Math.max(0, Math.min(150, Math.round(val/ref0*100))));
        basePct.push(100);
      });
      const cmp = baselineId ? COMPARES.find(c=>c.id===baselineId) : null;
      return { state:'ok', viz:type, labels, player:{label:SCOPED.name, pct:playerPct},
               baseline: baselineId ? { label:cmp?cmp.name:'Baseline', pct:basePct } : null };
    }
    if (type==='kpi') {
      const { ref, m } = fields[0];
      const val = _val(m.id, ref.agg, (cfg.scope==='squad'?'sq:':'p:'+SCOPED.name));
      let cmp=null;
      if (baselineId) {
        const ref0 = _baselineValue(m.id, baselineId) || val;
        const deltaPct = Math.round((val/ref0-1)*100);
        cmp = { label:(COMPARES.find(c=>c.id===baselineId)||{}).name, deltaPct, z:+( (val-ref0)/(ref0*0.12||1) ).toFixed(1) };
      }
      return { state:'ok', viz:type, value:val, unit:m.unit, agg:ref.agg, cmp };
    }

    /* line → per-metric series over the time axis (scoped player / squad) */
    if (type==='line') {
      const dates=_dateAxis(cfg.range), keyP=cfg.scope==='squad'?'sq':SCOPED.name;
      const series=fields.map(({ref,m},i)=>({
        id:m.id, label:m.name, unit:m.unit, color:_seriesColor(cfg,i),
        data:dates.map((_,d)=>_val(m.id, ref.agg, 'd:'+keyP+':'+d)),
      }));
      return { state:'ok', viz:type, labels:dates, series };
    }

    /* scatter → one point per player (x=metric0, y=metric1) */
    if (type==='scatter') {
      const [a,b]=fields;
      const points=players.map(p=>({
        x:_val(a.m.id, a.ref.agg, 'p:'+p.name),
        y:b?_val(b.m.id, b.ref.agg, 'p:'+p.name):0,
        player:p.short,
      }));
      return { state:'ok', viz:type, points, x:a.m, y:b?b.m:null };
    }

    /* bars / ranking / table / heatmap → per-player value for each metric */
    const series=fields.map(({ref,m},i)=>({
      id:m.id, label:m.name, unit:m.unit, kind:m.kind, color:_seriesColor(cfg,i),
      data:players.map(p=>_val(m.id, ref.agg, 'p:'+p.name)),
    }));
    return { state:'ok', viz:type, labels:players.map(p=>p.short), players, series };
  }

  function _hexRgba(hex, a) {
    const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
    return `rgba(${r},${g},${b},${a})`;
  }
  function _mkWrap(h) {
    const d=document.createElement('div');
    d.style.cssText=`position:relative;width:100%;height:${h}px`;
    const c=document.createElement('canvas');
    d.appendChild(c); return [d,c];
  }
  /* Call once after Chart.js loads */
  function _setupChartJs() {
    if (typeof Chart==='undefined') return;
    if (typeof ChartDataLabels!=='undefined') { try{Chart.unregister(ChartDataLabels);}catch(e){} }
    Chart.defaults.font.family = 'Geist, system-ui, sans-serif';
    Chart.defaults.font.size   = 11;
    Chart.defaults.color       = GC_FG;
  }
  _setupChartJs();

  /* -------- renderChart: same renderer for builder preview AND saved cards -------- */
  function renderChart(container, cfg) {
    /* destroy any Chart.js instance bound to this container (canvas reuse) */
    const old = _charts.get(container);
    if (old) { old.destroy(); _charts.delete(container); }
    container.innerHTML = '';

    const { type, metrics: fields=[], color='#15803D',
            axes=true, legend=true, labels=false, range='mc' } = cfg;
    const showAxes  = axes !== false;
    const showLeg   = legend !== false;
    const showLbl   = !!labels;
    const rangeName = (RANGES.find(r=>r.id===range)||RANGES[0]).name;
    const DL        = (typeof ChartDataLabels!=='undefined' && showLbl) ? ChartDataLabels : null;
    const base      = { responsive:true, maintainAspectRatio:false, animation:{duration:350,easing:'easeOutQuart'} };

    /* SINGLE source of data. If the resolver has no real rows → empty state, NEVER example data. */
    const ds = aggregateSeries(cfg);
    if (ds.state !== 'ok') {
      container.innerHTML = `<div class="cb2-state empty"><div class="ic"><i class="ti ti-database-off"></i></div><div class="t">No data for this selection</div><div class="d">${esc(ds.reason||'No rows match the current scope, range and filters.')}</div></div>`;
      return;
    }

    switch (type) {

      /* ---- non-canvas types: plain HTML from the resolver ---- */
      case 'kpi': {
        const m=M[fields[0].id], a=AGG[fields[0].agg]||AGG.avg, c=ds.cmp;
        container.innerHTML=`<div class="l"><i class="ti ${m.icon}"></i>${c?c.label:a.short+' · '+rangeName}</div>
          <div class="v">${fmt(ds.value)} <sub>${esc(ds.unit)}</sub></div>
          ${c?`<div class="t"><span class="d ${c.deltaPct>=0?'up':'down'}"><i class="ti ti-arrow-${c.deltaPct>=0?'up':'down'}-right"></i>${c.deltaPct>=0?'+':''}${c.deltaPct}%</span> · z = ${c.z>=0?'+':''}${c.z}</div>`:`<div class="t">${a.name} · ${rangeName}</div>`}`;
        break;
      }
      case 'ranking': {
        const s0=ds.series[0];
        const rows=ds.players.map((p,i)=>({ label:`${p.name} · #${p.num}`, v:s0.data[i] })).sort((a,b)=>b.v-a.v);
        const max=Math.max(...rows.map(r=>r.v))||1;
        container.innerHTML=`<div class="gp-rank">${rows.map((r,i)=>`<div class="gp-rank-row"><span class="ax">${i+1}</span><span class="gp-rank-bar"><span class="gp-rank-fill ${i===0?'':i<3?'med':'low'}" style="width:${Math.round(r.v/max*100)}%">${esc(r.label)}</span></span><span class="gp-rank-v">${showLbl?fmt(Math.round(r.v)):''}</span></div>`).join('')}</div>`;
        break;
      }
      case 'table': {
        const cols=ds.series.slice(0,5);
        container.innerHTML=`<div class="gp-zwrap"><table class="gp-zt"><thead><tr><th class="pc">Player</th>${cols.map(s=>`<th>${esc(s.label.split(' ')[0])}</th>`).join('')}</tr></thead>
          <tbody>${ds.players.map((p,r)=>`<tr><td class="pc"><div class="gp-mini-pl" style="padding:8px 0"><span class="gp-mn">${esc(p.name)}</span></div></td>${cols.map(s=>`<td>${fmt(Math.round(s.data[r]))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
        break;
      }
      case 'heatmap': {
        const cols=ds.series.slice(0,6); const cls=['vlow','mlow','low','neu','warn','mhigh','high'];
        /* per-column z-score across the roster — a real distribution, not noise */
        const stats=cols.map(s=>{const mean=s.data.reduce((a,b)=>a+b,0)/s.data.length; const sd=Math.sqrt(s.data.reduce((a,b)=>a+(b-mean)**2,0)/s.data.length)||1; return {mean,sd};});
        container.innerHTML=`<div class="gp-zwrap"><table class="gp-zt"><thead><tr><th class="pc">Player</th>${cols.map(s=>`<th>${esc(s.label.split(' ')[0])}</th>`).join('')}</tr></thead>
          <tbody>${ds.players.map((p,r)=>`<tr><td class="pc"><div class="gp-mini-pl" style="padding:6px 0"><span class="gp-mn">${esc(p.name)}</span></div></td>${cols.map((s,c)=>{const z=(s.data[r]-stats[c].mean)/stats[c].sd;const ci=Math.max(0,Math.min(6,Math.round(z+3)));return `<td><span class="gp-zc ${cls[ci]}">${showLbl?(z>=0?'+':'')+z.toFixed(1):''}</span></td>`;}).join('')}</tr>`).join('')}</tbody></table></div>`;
        break;
      }

      /* ---- Chart.js canvas types ---- */
      case 'bars': {
        const [wrap,cv]=_mkWrap(180); container.appendChild(wrap);
        const dsets=ds.series.map(s=>({
          label:s.label, data:s.data,
          backgroundColor:_hexRgba(s.color,0.82), borderColor:s.color,
          borderWidth:1.5, borderRadius:3, borderSkipped:false,
        }));
        const ch=new Chart(cv,{ type:'bar', plugins:DL?[DL]:[], data:{labels:ds.labels,datasets:dsets}, options:{
          ...base,
          plugins:{
            legend:{display:showLeg&&ds.series.length>1, position:'bottom', labels:{boxWidth:10,padding:12,font:{size:10}}},
            tooltip:{callbacks:{label:ctx=>`${ctx.dataset.label}: ${fmt(ctx.parsed.y)} ${ds.series[ctx.datasetIndex].unit}`}},
            datalabels:{display:showLbl, anchor:'end', align:'top', formatter:v=>fmt(v), font:{size:9,weight:'600'}, color:GC_FG, offset:2},
          },
          scales:{
            x:{display:showAxes, grid:{display:false}, ticks:{font:{size:10},color:GC_FG}},
            y:{display:showAxes, grid:{color:GC_GRID}, ticks:{font:{size:10},color:GC_FG,maxTicksLimit:5}, border:{dash:[3,3]}},
          },
        }});
        _charts.set(container,ch); break;
      }

      case 'line': {
        const [wrap,cv]=_mkWrap(200); container.appendChild(wrap);
        const dsets=ds.series.map(s=>({
          label:s.label, data:s.data,
          borderColor:s.color, backgroundColor:_hexRgba(s.color,0.07),
          borderWidth:2.4, tension:0.3,
          pointRadius:showLbl?4:2.5, pointHoverRadius:5,
          fill:ds.series.length===1, pointBackgroundColor:s.color,
        }));
        const ch=new Chart(cv,{ type:'line', plugins:DL?[DL]:[], data:{labels:ds.labels,datasets:dsets}, options:{
          ...base,
          plugins:{
            legend:{display:showLeg&&ds.series.length>1, position:'bottom', labels:{boxWidth:10,padding:12,font:{size:10}}},
            datalabels:{display:showLbl, anchor:'top', align:'top', formatter:v=>fmt(v), font:{size:9,weight:'600'}, color:GC_FG, offset:1},
          },
          scales:{
            x:{display:showAxes, grid:{display:false}, ticks:{font:{size:10},color:GC_FG}},
            y:{display:showAxes, grid:{color:GC_GRID}, ticks:{font:{size:10},color:GC_FG,maxTicksLimit:5}, border:{dash:[3,3]}},
          },
        }});
        _charts.set(container,ch); break;
      }

      case 'scatter': {
        const [wrap,cv]=_mkWrap(210); container.appendChild(wrap);
        const ch=new Chart(cv,{ type:'scatter', plugins:DL?[DL]:[], data:{datasets:[{
          label:'Players', data:ds.points,
          backgroundColor:_hexRgba(color,0.72), borderColor:color, borderWidth:1.5,
          pointRadius:7, pointHoverRadius:9,
        }]}, options:{
          ...base,
          plugins:{
            legend:{display:false},
            tooltip:{callbacks:{label:ctx=>`${ctx.raw.player}: (${fmt(ctx.raw.x)} ${ds.x.unit}${ds.y?', '+fmt(ctx.raw.y)+' '+ds.y.unit:''})`}},
            datalabels:{display:showLbl, formatter:value=>value.player||'', font:{size:9,weight:'600'}, color:GC_FG, anchor:'end', align:'end', offset:2},
          },
          scales:{
            x:{display:showAxes, title:{display:showAxes,text:`${ds.x.name} (${ds.x.unit})`,font:{size:10},color:GC_FG}, grid:{color:GC_GRID}, ticks:{font:{size:10},color:GC_FG}, border:{dash:[3,3]}},
            y:{display:showAxes, title:{display:showAxes&&!!ds.y,text:ds.y?`${ds.y.name} (${ds.y.unit})`:'',font:{size:10},color:GC_FG}, grid:{color:GC_GRID}, ticks:{font:{size:10},color:GC_FG,maxTicksLimit:5}, border:{dash:[3,3]}},
          },
        }});
        _charts.set(container,ch); break;
      }

      case 'radar': {
        const hasComp=!!ds.baseline;
        const [wrap,cv]=_mkWrap(260); container.appendChild(wrap);
        /* Player polygon = % of the baseline (role/match/MD); baseline polygon = 100% reference. */
        const dsets=[{
          label:ds.player.label,
          data:ds.player.pct,
          backgroundColor:_hexRgba(color,0.18), borderColor:color, borderWidth:2.5,
          pointBackgroundColor:color, pointBorderColor:'#fff', pointBorderWidth:1.5,
          pointRadius:4, pointHoverRadius:6,
        }];
        if (hasComp) dsets.push({
          label:ds.baseline.label,
          data:ds.baseline.pct,
          backgroundColor:'rgba(148,163,184,0.08)',
          borderColor:'rgba(148,163,184,0.65)', borderWidth:1.5, borderDash:[5,3],
          pointBackgroundColor:'rgba(148,163,184,0.65)', pointBorderColor:'#fff', pointBorderWidth:1,
          pointRadius:3, pointHoverRadius:4,
        });
        const rmax=Math.max(120, Math.ceil(Math.max(...ds.player.pct)/30)*30);
        const ch=new Chart(cv,{ type:'radar', plugins:DL?[DL]:[], data:{labels:ds.labels,datasets:dsets}, options:{
          ...base,
          plugins:{
            legend:{display:showLeg&&hasComp, position:'bottom', labels:{boxWidth:10,padding:14,font:{size:10.5},usePointStyle:true}},
            tooltip:{callbacks:{label:ctx=>`${ctx.dataset.label}: ${ctx.raw}%`}},
            datalabels:{display:showLbl, formatter:v=>v+'%', font:{size:9,weight:'600'}, color:ctx=>ctx.datasetIndex===0?color:GC_FAINT, anchor:'end', align:'end', offset:3},
          },
          scales:{
            r:{
              min:0, max:rmax,
              ticks:{display:showAxes, stepSize:30, font:{size:9}, color:GC_FAINT, backdropColor:'transparent', callback:v=>v+'%'},
              grid:{color:'rgba(148,163,184,0.18)'},
              angleLines:{color:'rgba(148,163,184,0.22)'},
              pointLabels:{display:showAxes, font:{size:10,weight:'600'}, color:'#4B5563', padding:6},
            },
          },
        }});
        _charts.set(container,ch); break;
      }

      default: break;
    }
  }

  function buildConfig(cfg) {
    return {
      schema:'gp.card/v1',
      title: autoTitle(cfg),
      viz: cfg.type,
      scope: { level: cfg.scope },
      metrics: cfg.metrics.map(f => ({ id:f.id, agg:f.agg, kind:M[f.id].kind, unit:M[f.id].unit, custom: !!M[f.id].custom })),
      range: { type: cfg.range },
      comparison: cfg.compare === 'none' ? null : { baseline: cfg.compare },
      style: { size:cfg.size, color:cfg.color, palette:cfg.palette, axes:cfg.axes, legend:cfg.legend, dataLabels:cfg.labels },
    };
  }

  function hlJSON(obj) {
    let j = JSON.stringify(obj, null, 2).replace(/[<>&]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]));
    return j.replace(/("(\\.|[^"\\])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?)/g, m => {
      let cls = 'n';
      if (/^"/.test(m)) cls = /:$/.test(m) ? 'k' : 's';
      else if (/true|false|null/.test(m)) cls = 'b';
      return `<span class="${cls}">${m}</span>`;
    });
  }

  function noDataReason(cfg) {
    if (cfg.scope === 'squad') {
      const cust = cfg.metrics.find(f => M[f.id].custom);
      if (cust) return `“${M[cust.id].name}” is a custom (EAV) metric captured per player — no squad-level rollup for this selection.`;
    }
    return null;
  }

  window.GP = { TYPES, REQ_LBL, FULLNAME, CATALOG, M, AGGS, AGG, COMPARES, RANGES, COLORS, PALETTES,
    esc, fmt, defaultAgg, autoTitle, bodyClass, renderChart, aggregateSeries, buildConfig, hlJSON, noDataReason };
})();
