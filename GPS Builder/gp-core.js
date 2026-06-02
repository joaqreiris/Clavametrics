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

  /* -------- Chart.js: registry + mock data + helpers -------- */
  const _charts = new WeakMap();
  const MOCK_PLAYERS  = ['R. Vega','T. López','I. Barreiro','S. Rivas','M. Paredes','R. Sosa','M. Mtz'];
  const MOCK_F7       = [0.96,0.82,0.74,0.61,0.80,0.64,1.02];
  const MOCK_DATES    = ['18 May','19 May','20 May','21 May','22 May','23 May','24 May'];
  const MOCK_LINE_FX  = [
    [1.00,0.94,1.05,0.88,0.97,0.92,0.99],
    [0.88,0.96,0.92,1.04,0.91,0.99,0.95],
    [0.95,1.02,0.89,0.96,1.08,0.94,1.01],
    [1.03,0.91,0.97,1.02,0.88,1.05,0.98],
  ];
  const MOCK_SCATTER_F = [[0.96,0.88],[0.82,0.74],[0.91,0.95],[0.68,0.61],[0.88,0.79],[0.75,0.84],[0.54,0.62],[0.93,0.91]];
  const RADAR_PF       = [0.92,0.78,0.88,0.96,0.71,0.84,0.89,0.76];
  const SERIES_COLORS  = ['#2563EB','#D97706','#7C3AED','#E11D48','#475569','#0891B2'];
  const GC_GRID  = 'rgba(148,163,184,0.12)';
  const GC_FG    = '#6B7280';
  const GC_FAINT = '#9CA3AF';

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
    /* destroy any Chart.js instance bound to this container */
    const old = _charts.get(container);
    if (old) { old.destroy(); _charts.delete(container); }
    container.innerHTML = '';

    const { type, metrics: fields=[], color='#15803D',
            axes=true, legend=true, labels=false,
            compare='none', range='mc' } = cfg;
    const ms        = fields.map(f=>M[f.id]).filter(Boolean);
    const showAxes  = axes !== false;
    const showLeg   = legend !== false;
    const showLbl   = !!labels;
    const cmp       = compare!=='none' ? (COMPARES.find(c=>c.id===compare)||null) : null;
    const rangeName = (RANGES.find(r=>r.id===range)||RANGES[0]).name;
    const DL        = (typeof ChartDataLabels!=='undefined' && showLbl) ? ChartDataLabels : null;
    const base      = { responsive:true, maintainAspectRatio:false, animation:{duration:350,easing:'easeOutQuart'} };

    switch (type) {

      /* ---- non-canvas types: plain HTML ---- */
      case 'kpi': {
        if (!ms[0]) return;
        const m=ms[0], a=AGG[fields[0].agg]||AGG.avg;
        container.innerHTML=`<div class="l"><i class="ti ${m.icon}"></i>${cmp?cmp.name:a.short+' · '+rangeName}</div>
          <div class="v">${fmt(m.sample)} <sub>${esc(m.unit)}</sub></div>
          ${cmp?`<div class="t"><span class="d up"><i class="ti ti-arrow-up-right"></i>+8%</span> · z = +0.6</div>`:`<div class="t">${a.name} · ${rangeName}</div>`}`;
        break;
      }
      case 'ranking': {
        if (!ms[0]) return;
        const m=ms[0];
        const rows=[['R. Vega · #7',96],['T. López · #4',82],['I. Barreiro · #18',74],['S. Rivas · #6',61],['M. Paredes · #8',47],['R. Sosa · #2',33]];
        container.innerHTML=`<div class="gp-rank">${rows.map((r,i)=>`<div class="gp-rank-row"><span class="ax">${i+1}</span><span class="gp-rank-bar"><span class="gp-rank-fill ${i===0?'':i<3?'med':'low'}" style="width:${r[1]}%">${esc(r[0])}</span></span><span class="gp-rank-v">${showLbl?fmt(Math.round(m.sample*r[1]/100)):''}</span></div>`).join('')}</div>`;
        break;
      }
      case 'table': {
        const cols=ms.slice(0,5); const players=['R. Vega','T. López','I. Barreiro','S. Rivas','M. Paredes'];
        container.innerHTML=`<div class="gp-zwrap"><table class="gp-zt"><thead><tr><th class="pc">Player</th>${cols.map(m=>`<th>${esc(m.name.split(' ')[0])}</th>`).join('')}</tr></thead>
          <tbody>${players.map((p,r)=>`<tr><td class="pc"><div class="gp-mini-pl" style="padding:8px 0"><span class="gp-mn">${esc(p)}</span></div></td>${cols.map((m,c)=>`<td>${fmt(Math.round(m.sample*(0.8+0.08*((r+c)%4))))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
        break;
      }
      case 'heatmap': {
        const cols=ms.slice(0,6); const players=['R. Vega','T. López','I. Barreiro','S. Rivas','M. Paredes'];
        const cls=['vlow','mlow','low','neu','warn','mhigh','high'];
        container.innerHTML=`<div class="gp-zwrap"><table class="gp-zt"><thead><tr><th class="pc">Player</th>${cols.map(m=>`<th>${esc(m.name.split(' ')[0])}</th>`).join('')}</tr></thead>
          <tbody>${players.map((p,r)=>`<tr><td class="pc"><div class="gp-mini-pl" style="padding:6px 0"><span class="gp-mn">${esc(p)}</span></div></td>${cols.map((m,c)=>{const z=(Math.sin(r*1.6+c*0.9)*2);const ci=Math.max(0,Math.min(6,Math.round(z+3)));return `<td><span class="gp-zc ${cls[ci]}">${showLbl?(z>=0?'+':'')+z.toFixed(1):''}</span></td>`;}).join('')}</tr>`).join('')}</tbody></table></div>`;
        break;
      }

      /* ---- Chart.js canvas types ---- */
      case 'bars': {
        if (!ms[0]) return;
        const [wrap,cv]=_mkWrap(180); container.appendChild(wrap);
        const ds=[{
          label:ms[0].name,
          data:MOCK_F7.map(f=>+(ms[0].sample*f).toFixed(1)),
          backgroundColor:_hexRgba(color,0.82), borderColor:color,
          borderWidth:1.5, borderRadius:3, borderSkipped:false,
        }];
        if (ms[1]) ds.push({
          label:ms[1].name,
          data:MOCK_F7.map((f,i)=>+(ms[1].sample*Math.max(0.35,f-0.1+(i*0.02))).toFixed(1)),
          backgroundColor:'rgba(148,163,184,0.42)', borderColor:'rgba(148,163,184,0.75)',
          borderWidth:1.5, borderRadius:3, borderSkipped:false,
        });
        const ch=new Chart(cv,{ type:'bar', plugins:DL?[DL]:[], data:{labels:MOCK_PLAYERS,datasets:ds}, options:{
          ...base,
          plugins:{
            legend:{display:showLeg&&!!ms[1], position:'bottom', labels:{boxWidth:10,padding:12,font:{size:10}}},
            tooltip:{callbacks:{label:ctx=>`${ctx.dataset.label}: ${fmt(ctx.parsed.y)} ${(ms[ctx.datasetIndex]||ms[0]).unit}`}},
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
        if (!ms[0]) return;
        const [wrap,cv]=_mkWrap(200); container.appendChild(wrap);
        const ds=ms.slice(0,6).map((m,i)=>({
          label:m.name,
          data:(MOCK_LINE_FX[i%MOCK_LINE_FX.length]).map(f=>+(m.sample*f).toFixed(2)),
          borderColor:i===0?color:SERIES_COLORS[i-1]||color,
          backgroundColor:_hexRgba(i===0?color:SERIES_COLORS[i-1]||color, 0.07),
          borderWidth:2.4, tension:0.3,
          pointRadius:showLbl?4:2.5, pointHoverRadius:5,
          fill:ms.length===1,
          pointBackgroundColor:i===0?color:SERIES_COLORS[i-1]||color,
        }));
        const ch=new Chart(cv,{ type:'line', plugins:DL?[DL]:[], data:{labels:MOCK_DATES,datasets:ds}, options:{
          ...base,
          plugins:{
            legend:{display:showLeg&&ms.length>1, position:'bottom', labels:{boxWidth:10,padding:12,font:{size:10}}},
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
        if (!ms[0]) return;
        const [wrap,cv]=_mkWrap(210); container.appendChild(wrap);
        const pts=MOCK_SCATTER_F.map((f,i)=>({
          x:+(ms[0].sample*f[0]).toFixed(2),
          y:ms[1]?+(ms[1].sample*f[1]).toFixed(2):0,
          player:MOCK_PLAYERS[i]||'P'+(i+1),
        }));
        const ch=new Chart(cv,{ type:'scatter', plugins:DL?[DL]:[], data:{datasets:[{
          label:'Players', data:pts,
          backgroundColor:_hexRgba(color,0.72), borderColor:color, borderWidth:1.5,
          pointRadius:7, pointHoverRadius:9,
        }]}, options:{
          ...base,
          plugins:{
            legend:{display:false},
            tooltip:{callbacks:{label:ctx=>`${ctx.raw.player}: (${fmt(ctx.raw.x)} ${ms[0].unit}${ms[1]?', '+fmt(ctx.raw.y)+' '+ms[1].unit:''})`}},
            datalabels:{display:showLbl, formatter:(_,ctx)=>ctx.raw.player, font:{size:9,weight:'600'}, color:GC_FG, anchor:'end', align:'end', offset:2},
          },
          scales:{
            x:{display:showAxes, title:{display:showAxes,text:`${ms[0].name} (${ms[0].unit})`,font:{size:10},color:GC_FG}, grid:{color:GC_GRID}, ticks:{font:{size:10},color:GC_FG}, border:{dash:[3,3]}},
            y:{display:showAxes, title:{display:showAxes&&!!ms[1],text:ms[1]?`${ms[1].name} (${ms[1].unit})`:'',font:{size:10},color:GC_FG}, grid:{color:GC_GRID}, ticks:{font:{size:10},color:GC_FG,maxTicksLimit:5}, border:{dash:[3,3]}},
          },
        }});
        _charts.set(container,ch); break;
      }

      case 'radar': {
        if (!ms[0]) return;
        const hasComp=compare!=='none';
        const [wrap,cv]=_mkWrap(260); container.appendChild(wrap);
        /* Normalize to % of sample (sample = role baseline = 100%).
           This makes all GPS metrics comparable on a single radial scale. */
        const pVals=ms.map((_,i)=>Math.round(RADAR_PF[i%RADAR_PF.length]*100));
        const bVals=ms.map(()=>100);
        const labels=ms.map(m=>m.name.split(' ').slice(0,2).join(' '));
        const ds=[{
          label:'Player',
          data:pVals,
          backgroundColor:_hexRgba(color,0.18), borderColor:color, borderWidth:2.5,
          pointBackgroundColor:color, pointBorderColor:'#fff', pointBorderWidth:1.5,
          pointRadius:4, pointHoverRadius:6,
        }];
        if (hasComp) ds.push({
          label:cmp?cmp.name:'Baseline',
          data:bVals,
          backgroundColor:'rgba(148,163,184,0.08)',
          borderColor:'rgba(148,163,184,0.65)', borderWidth:1.5, borderDash:[5,3],
          pointBackgroundColor:'rgba(148,163,184,0.65)', pointBorderColor:'#fff', pointBorderWidth:1,
          pointRadius:3, pointHoverRadius:4,
        });
        const ch=new Chart(cv,{ type:'radar', plugins:DL?[DL]:[], data:{labels,datasets:ds}, options:{
          ...base,
          plugins:{
            legend:{display:showLeg&&hasComp, position:'bottom', labels:{boxWidth:10,padding:14,font:{size:10.5},usePointStyle:true}},
            tooltip:{callbacks:{label:ctx=>`${ctx.dataset.label}: ${ctx.raw}%`}},
            datalabels:{display:showLbl, formatter:v=>v+'%', font:{size:9,weight:'600'}, color:(_,ctx)=>ctx.datasetIndex===0?color:GC_FAINT, anchor:'end', align:'end', offset:3},
          },
          scales:{
            r:{
              min:0, max:120,
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
    esc, fmt, defaultAgg, autoTitle, bodyClass, renderChart, buildConfig, hlJSON, noDataReason };
})();
