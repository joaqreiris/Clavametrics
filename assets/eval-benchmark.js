/* ────────────────────────────────────────────────────────────────────────
   eval-benchmark.js — category (team) benchmarking for player test values.
   Exposes window.evalBench.{ categoryStats, percentile, zscore }.
   "Category" = players sharing the same team_id. Reuses the latest value per
   player per test, computes per-type distribution stats, and ranks a value
   (direction handled by the caller via window.evalDir.isLowerBetter).
   ──────────────────────────────────────────────────────────────────────── */
(function(){
  const sb = () => window.sb;
  async function _latestByPlayerType({ clubId, teamId, types, physicalOnly }){
    const { data: players } = await sb().from('players').select('id').eq('club_id',clubId).eq('team_id',teamId).is('archived_at', null);
    const ids = (players||[]).map(p=>p.id);
    if (!ids.length) return {};
    let q = sb().from('evaluations').select('player_id, evaluation_type, value, test_date, unit')
      .eq('club_id',clubId).in('player_id', ids).order('test_date',{ascending:false});
    if (types && types.length) q = q.in('evaluation_type', types);
    if (physicalOnly) q = q.neq('unit','/10');
    const { data } = await q;
    const latest = {};                       // type -> {playerId: value}
    for (const r of (data||[])){
      const t = r.evaluation_type;
      latest[t] = latest[t] || {};
      if (!(r.player_id in latest[t]) && r.value!=null) latest[t][r.player_id] = Number(r.value);
    }
    return latest;
  }
  function _stats(vals){
    const v = vals.filter(x=>x!=null && !isNaN(x)).sort((a,b)=>a-b);
    const n = v.length; if(!n) return { n:0, mean:null, sd:null, min:null, max:null, values:[] };
    const mean = v.reduce((s,x)=>s+x,0)/n;
    const sd = n>1 ? Math.sqrt(v.reduce((s,x)=>s+(x-mean)**2,0)/(n-1)) : 0;
    return { n, mean, sd, min:v[0], max:v[n-1], values:v };
  }
  function percentile(value, stats, lowerBetter){
    if (value==null || !stats || !stats.n) return null;
    let below=0; for (const x of stats.values) if (x < value) below++;
    let p = (below/stats.values.length)*100;
    if (lowerBetter) p = 100 - p;
    return Math.round(p);
  }
  function zscore(value, stats){
    if (value==null || !stats || stats.sd==null || stats.sd===0) return null;
    return (value - stats.mean) / stats.sd;
  }
  async function categoryStats({ clubId, teamId, types, physicalOnly }){
    const latest = await _latestByPlayerType({ clubId, teamId, types, physicalOnly });
    const out = {}; for (const t in latest) out[t] = _stats(Object.values(latest[t]));
    return out;                              // {type:{n,mean,sd,min,max,values}}
  }
  window.evalBench = { categoryStats, percentile, zscore };
})();
