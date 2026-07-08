/* ────────────────────────────────────────────────────────────────────────
   load-monitor.js — controller for the redesigned Load Monitor page.

   Renders REAL data into the new design's panes (ids from the mockup):
     ACWR hero  : metricSel, settingsPop, kpiN/kpiDen/kpiFoot/kpiAvg, zones, acwrPane
     GPS exp.   : gpsGrid            (via window.gpsExposure.compute)
     Stressors  : stressList         (via window.stressors.build)
     Avail.     : availBody          (per-player 7-day GPS sparklines + risk)
     Dec. queue : dqList             (auto-derived prioritised actions)

   Reuses window.sb + helpers (supabase-init.js), window.gpsACWR (engine),
   window.gpsExposure, window.stressors, Chart.js. Never throws; degrades to
   empty/skeleton states. Multi-tenant via club_id / team membership.
   ──────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const sb = () => window.sb;

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
    metric:'srpe', model:'ewma', coupled:false, chart:null };

  function metricKey(){ return METRIC_MAP[state.metric] || 'srpe_load'; }
  function metricLabel(){ const m=window.gpsACWR?.getMetric(metricKey()); return m? m.label : 's-RPE'; }

  // ── ACWR: KPIs + zones + chart ──────────────────────────────────────────────
  async function renderACWR(){
    const sub=$('acwrSub'); if(sub) sub.textContent=`${metricLabel()} · ${state.model==='ewma'?'EWMA 7:28':'rolling 7:28'} · last 6 weeks`;
    const mn=$('metricName'); if(mn) mn.textContent=metricLabel();

    let squad;
    try { squad = await window.gpsACWR.calculateSquad({ clubId:state.clubId, refDate:state.refDate, metricKey:metricKey(), model:state.model, coupled:state.coupled }); }
    catch { squad=null; }

    const total = state.players.length || (squad? Object.keys(squad.perPlayer).length : 0);
    const c = squad?.counts || { under:0,sweet:0,over:0,risk:0,noData:0 };
    const riskN = c.over + c.risk;
    if($('kpiN')) $('kpiN').textContent = String(riskN);
    if($('kpiDen')) $('kpiDen').textContent = `/ ${total}`;
    if($('kpiFoot')) $('kpiFoot').innerHTML = `<b>${riskN}</b> players ≥ 1.3 ACWR · <b>${c.risk}</b> above 1.5 (danger).`;

    const med = squad ? median(Object.values(squad.perPlayer).map(p=>p.acwr)) : null;
    if($('kpiAvg')) $('kpiAvg').innerHTML = (med!=null? med.toFixed(2) : '—') + `<small>squad median</small>`;

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
      pane.innerHTML = `<div class="lm-chart-skeleton" style="animation:none"><div class="lm-empty" style="padding:40px;text-align:center;color:var(--cm-fg-faint)">No ${esc(metricLabel())} data in the last 6 weeks.</div></div>`;
      if(state.chart){ state.chart.destroy(); state.chart=null; }
      return;
    }

    pane.innerHTML = `
      <div class="lm-chart-legend">
        <span class="lm-lg"><span class="line acute"></span>Squad ACWR (${state.model==='ewma'?'EWMA':'RA'})</span>
        <span class="lm-lg"><span class="bar"></span>Session load</span>
        <span class="lm-lg spacer"></span>
      </div>
      <div style="position:relative;height:280px"><canvas id="acwrCanvas"></canvas></div>`;

    const labels = tl.dates.map(d=> new Date(d+'T12:00:00').toLocaleDateString(undefined,{day:'numeric',month:'short'}));
    const acu=cssVar('--cm-fg-strong','#111'), fai=cssVar('--cm-fg-faint','#aaa'), acc=accent();
    const maxLoad=Math.max(1,...tl.squadLoad);
    if(state.chart){ state.chart.destroy(); state.chart=null; }
    state.chart = new Chart($('acwrCanvas'), {
      data:{ labels, datasets:[
        { type:'line', data:Array(labels.length).fill(1.5), borderColor:'rgba(220,38,38,0.35)', borderDash:[4,3], borderWidth:1, pointRadius:0, yAxisID:'y', order:4 },
        { type:'line', data:Array(labels.length).fill(1.3), borderColor:'rgba(217,119,6,0.30)', borderDash:[3,3], borderWidth:1, pointRadius:0, yAxisID:'y', order:4 },
        { type:'line', data:Array(labels.length).fill(0.8), borderColor:'rgba(34,197,94,0.30)', borderDash:[3,3], borderWidth:1, pointRadius:0, yAxisID:'y', order:4 },
        { type:'bar', label:'Session load', data:tl.squadLoad, backgroundColor:'rgba(120,120,130,0.16)', borderWidth:0, borderRadius:2, yAxisID:'y2', order:5 },
        { type:'line', label:'Squad ACWR', data:tl.squadAcwr, borderColor:acc, backgroundColor:'rgba(99,102,241,0.08)', borderWidth:2.5, pointRadius:2.5, pointHoverRadius:5, tension:0.3, fill:true, spanGaps:true, yAxisID:'y', order:1 },
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
    if(!res || !res.ok){
      grid.innerHTML=''; if(empty){ empty.style.display='block'; empty.innerHTML=`<div style="padding:26px;text-align:center;color:var(--cm-fg-faint)"><i class="ti ti-satellite" style="font-size:22px"></i><div style="margin-top:6px">No GPS data yet</div></div>`; }
      return;
    }
    if(empty) empty.style.display='none';
    const fmt=res.fmtVal||window.gpsExposure.fmtVal;
    grid.innerHTML = res.tiles.map(t=>{
      const d=t.delta;
      const dCls = d==null?'flat': d>=2?'up': d<=-2?'down':'flat';
      const dIco = d==null?'ti-minus': d>=2?'ti-trending-up': d<=-2?'ti-trending-down':'ti-minus';
      const dTxt = d==null?'—':(d>0?'+':'')+d.toFixed(0)+'%';
      return `<div class="lm-gps-cell">
        <div class="top"><span class="lbl">${esc(t.label)}</span><span class="lm-delta ${dCls}"><i class="ti ${dIco}"></i>${dTxt}</span></div>
        <div class="val">${fmt(t.current,t.fmt)}${t.unit?`<small>${esc(t.unit)}</small>`:''}</div>
        ${spark(t.spark, accent(), 34)}
        <div class="base"><span>baseline</span><span>${fmt(t.baseline,t.fmt)}</span></div>
      </div>`;
    }).join('');
  }

  // ── Impending stressors ─────────────────────────────────────────────────────
  async function renderStressors(){
    const list=$('stressList'); if(!list) return;
    let res;
    try { res = await window.stressors.build({ clubId:state.clubId, teamId:state.teamId, refStr:state.refDate, days:21 }); }
    catch { res=null; }
    const items = res?.stressors || [];
    if(!items.length){ list.innerHTML=`<div style="padding:26px 8px;text-align:center;color:var(--cm-fg-faint)"><i class="ti ti-circle-check" style="font-size:22px;color:var(--cm-success)"></i><div style="margin-top:6px">No flagged stressors in the next 21 days.</div></div>`; return; }
    const ico={ heat:'ti-temperature-sun', travel:'ti-plane', cong:'ti-calendar-exclamation' };
    list.innerHTML = items.map(s=>{
      const dt=new Date(s.date+'T00:00:00');
      const when=`<div class="d">${dt.getDate()} ${dt.toLocaleDateString(undefined,{month:'short'})}</div><div class="t">${dt.toLocaleDateString(undefined,{weekday:'short'})}</div>`;
      return `<div class="lm-stress-item">
        <div class="lm-stress-when">${when}</div>
        <div class="lm-stress-rail"><span class="lm-stress-dot ${s.sev==='high'?'is-high':''}"></span>
          <div class="lm-stress-main">
            <div class="tt"><i class="ti ${ico[s.kind]||'ti-alert-triangle'}"></i>${esc(s.title)}</div>
            <div class="meta">${esc(s.hint||'')}</div>
          </div>
        </div>
        <span class="cm-pill ${s.sev==='high'?'is-danger':''}" style="align-self:start"><span class="cm-dot"></span>${s.sev}</span>
      </div>`;
    }).join('');
  }

  // ── Availability watch (per-player 7-day GPS sparklines + risk) ──────────────
  async function fetchGpsDaily(fromDate,toDate){
    const { data:sess } = await sb().from('training_sessions').select('id,session_date').eq('club_id',state.clubId).gte('session_date',fromDate).lte('session_date',toDate);
    if(!sess?.length) return {};
    const sd=Object.fromEntries(sess.map(s=>[s.id,s.session_date])), ids=sess.map(s=>s.id);
    const cols='player_id,session_id,total_distance,high_speed_distance,distance_per_minute,accelerations,decelerations,player_load';
    let rows;
    try{
      rows = window.cmFetchAll
        ? await window.cmFetchAll(()=> sb().from('gps_reports').select(cols).eq('club_id',state.clubId).in('session_id',ids), {label:'lm.avail'})
        : ((await sb().from('gps_reports').select(cols).eq('club_id',state.clubId).in('session_id',ids)).data||[]);
    }catch{ rows=[]; }
    const byP={};
    (rows||[]).forEach(r=>{ const date=sd[r.session_id]; if(!date) return; (byP[r.player_id]||(byP[r.player_id]=[])).push({ date,
      dist:+r.total_distance||0, hid:+r.high_speed_distance||0, mmin:+r.distance_per_minute||0, ad:(+r.accelerations||0)+(+r.decelerations||0), load:+r.player_load||0 }); });
    return byP;
  }

  async function renderAvailability(acwrPer){
    const body=$('availBody'), empty=$('availEmpty'); if(!body) return;
    const from7=offset(state.refDate,-7);
    const gps=await fetchGpsDaily(from7,state.refDate);

    if(!state.players.length){ body.innerHTML=''; if(empty){ empty.style.display='block'; empty.innerHTML=`<div style="padding:24px;text-align:center;color:var(--cm-fg-faint)">No players in this squad.</div>`; } return; }
    if(empty) empty.style.display='none';

    const availCls={ available:['ok','Available'], modified:['mod','Modified'], injured:['out','Injured'], unavailable:['out','Unavailable'], sick:['out','Sick'], away:['unk','Away'] };
    const cols=[['dist','m'],['hid','m'],['mmin','m/min'],['ad',''],['load','AU']];

    const rows = state.players.map(p=>{
      const recs=(gps[p.id]||[]).slice().sort((a,b)=> a.date<b.date?-1:1);
      const enough = recs.length>=3;
      const posc=POS_CSS[(p.position||'').toUpperCase()]||'mf';
      const av=availCls[p.status]||['unk','—'];
      const acwr=acwrPer?.[p.id]?.acwr;
      const insuf=acwrPer?.[p.id]?.insufficient;
      const riskCls = (acwr==null)?'low': acwr>1.5?'high': acwr>1.3?'med':'low';
      const riskLab = (acwr==null)? (insuf?'n<4':'—') : acwr>1.5?'High': acwr>1.3?'Med':'Low';

      const cells = cols.map(([k,unit])=>{
        if(!enough) return `<td class="lm-sparkcell insufficient"><span class="insuf">n&lt;4</span></td>`;
        const series=recs.map(r=>r[k]);
        const latest=series[series.length-1], mn=mean(series);
        const hot = mn && latest>mn*1.2, cool = mn && latest<mn*0.8;
        const disp = (k==='mmin')? latest.toFixed(1) : latest>=1000?(latest/1000).toFixed(1)+'k':Math.round(latest);
        return `<td><div class="lm-sparkcell">${spark(series, hot?cssVar('--cm-danger','#ef4444'):cool?cssVar('--cm-success','#22c55e'):accent(),26)}<div class="n ${hot?'hot':cool?'cool':''}">${disp}${unit?`<small style="opacity:.6">${unit}</small>`:''}</div></div></td>`;
      }).join('');

      return `<tr>
        <td><div class="lm-player"><div class="who"><div class="nm">${esc((p.first_name||'')+' '+(p.last_name||'')).trim()||'Player'}</div>
          <div class="role"><span class="pos-chip ${posc}">${esc((p.position||'—').toUpperCase())}</span>${p.number!=null?`#${esc(p.number)}`:''}</div></div></div></td>
        <td><span class="lm-avail ${av[0]}"><span class="cm-dot"></span>${av[1]}</span></td>
        ${cells}
        <td><div class="lm-risk ${riskCls}"><span class="bar"><i></i><i></i><i></i></span><span class="lab">${riskLab}</span></div></td>
      </tr>`;
    }).join('');
    body.innerHTML=rows;
  }

  // ── Decision queue (auto-derived) ────────────────────────────────────────────
  function renderDecisionQueue({ squad, stressors }){
    const list=$('dqList'); if(!list) return;
    const items=[];
    const per=squad?.perPlayer||{};
    const danger=Object.entries(per).filter(([,v])=>v.acwr!=null&&v.acwr>1.5).map(([id])=>id);
    const over=Object.entries(per).filter(([,v])=>v.acwr!=null&&v.acwr>1.3&&v.acwr<=1.5);
    const nameOf=id=>{ const p=state.players.find(x=>x.id===id); return p?`${(p.first_name||'')[0]||''}. ${p.last_name||''}`.trim():'player'; };

    if(danger.length) items.push({ ic:'ti-alert-triangle', prio:'high', t:`Review high-speed exposure for ${danger.length} player${danger.length>1?'s':''}`, who:`Sport Science · ${danger.map(nameOf).slice(0,3).join(', ')}${danger.length>3?'…':''}` });
    if(over.length)   items.push({ ic:'ti-activity', prio:'med', t:`Adjust MD-2 loading · ${over.length} in overreach`, who:'Fitness coach' });
    const hiStr=(stressors?.stressors||[]).filter(s=>s.sev==='high');
    hiStr.slice(0,2).forEach(s=> items.push({ ic: s.kind==='heat'?'ti-temperature-sun':s.kind==='travel'?'ti-plane':'ti-calendar-exclamation', prio:'med', t:`Mitigation plan · ${esc(s.title)}`, who:`${new Date(s.date+'T00:00:00').toLocaleDateString(undefined,{day:'numeric',month:'short'})}` }));
    const restr=state.players.filter(p=>['injured','modified','unavailable','sick'].includes(p.status));
    if(restr.length) items.push({ ic:'ti-heart-rate-monitor', prio:'med', t:`Rehab progression update · ${restr.length} players`, who:'Medical' });
    items.push({ ic:'ti-clipboard-check', prio:'low', t:'Confirm starting XI for MD', who:'Head coach' });

    const pill={ high:'is-prio-high', med:'is-prio-med', low:'is-prio-low' };
    const plab={ high:'High', med:'Medium', low:'Low' };
    list.innerHTML = items.map(i=>`
      <div class="lm-dq-item">
        <div class="lm-dq-ic"><i class="ti ${i.ic}"></i></div>
        <div class="lm-dq-main"><div class="t">${i.t}</div><div class="who"><i class="ti ti-user"></i>${esc(i.who)}</div></div>
        <div class="lm-dq-right"><span class="cm-pill ${pill[i.prio]}">${plab[i.prio]}</span></div>
      </div>`).join('');
  }

  // ── orchestration ────────────────────────────────────────────────────────────
  async function loadAll(){
    // ACWR + KPIs + chart
    await renderACWR();
    // squad snapshot (reused for availability risk + decision queue)
    let squad=null, stress=null;
    try { squad = await window.gpsACWR.calculateSquad({ clubId:state.clubId, refDate:state.refDate, metricKey:metricKey(), model:state.model, coupled:state.coupled }); } catch {}
    try { stress = await window.stressors.build({ clubId:state.clubId, teamId:state.teamId, refStr:state.refDate, days:21 }); } catch {}
    await Promise.all([ renderExposure(), renderStressors(), renderAvailability(squad?.perPlayer) ]);
    renderDecisionQueue({ squad, stressors:stress });
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
    const ms=$('metricSel'); ms?.addEventListener('change', async ()=>{ state.metric=ms.value; await renderACWR(); await renderAvailability((await safeSquad())?.perPlayer); });
    const sbtn=$('settingsBtn'), pop=$('settingsPop');
    sbtn?.addEventListener('click', e=>{ e.stopPropagation(); pop?.classList.toggle('on'); });
    document.addEventListener('click', e=>{ if(pop?.classList.contains('on') && !pop.contains(e.target) && e.target!==sbtn) pop.classList.remove('on'); });
    document.querySelectorAll('.lm-seg2[data-set="model"] button').forEach(b=> b.addEventListener('click', async ()=>{
      state.model = b.textContent.toLowerCase().includes('rolling')?'ra':'ewma';
      document.querySelectorAll('.lm-seg2[data-set="model"] button').forEach(x=>x.classList.toggle('on',x===b));
      await renderACWR();
    }));
    document.querySelectorAll('.lm-seg2[data-set="couple"] button').forEach(b=> b.addEventListener('click', async ()=>{
      state.coupled = b.textContent.toLowerCase().includes('coupled') && !b.textContent.toLowerCase().includes('un');
      document.querySelectorAll('.lm-seg2[data-set="couple"] button').forEach(x=>x.classList.toggle('on',x===b));
      await renderACWR();
    }));
    $('btnRefresh')?.addEventListener('click', ()=> loadAll());
  }
  async function safeSquad(){ try{ return await window.gpsACWR.calculateSquad({ clubId:state.clubId, refDate:state.refDate, metricKey:metricKey(), model:state.model, coupled:state.coupled }); }catch{ return null; } }

  // ── boot ─────────────────────────────────────────────────────────────────────
  (async function boot(){
    try { if(window.guardModule && !(await window.guardModule())) return; } catch {}
    try { await Promise.all([window.getProfile?.(), window.getClub?.()]); } catch {}
    try { state.clubId = await window.getClubId(); } catch { state.clubId=null; }
    try { window.applyClubTheme?.(); } catch {}
    if(!state.clubId){ console.warn('[LM] no club id'); return; }

    await initTeamSwitch();
    await loadPlayers();
    wireControls();
    await loadAll();
  })();
})();
