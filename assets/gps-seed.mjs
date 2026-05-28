#!/usr/bin/env node
// assets/gps-seed.mjs
// GPS seed adaptativo — lee la DB real, pide confirmación, inserta idempotentemente.
// Uso: node assets/gps-seed.mjs
// Rollback: node assets/gps-seed.mjs --rollback
// Requiere: SUPABASE_URL y SUPABASE_SERVICE_KEY como variables de entorno.

import { createClient } from '@supabase/supabase-js';
import readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';

// ── Env check ────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('\n❌  Faltan variables de entorno:');
  console.error('   export SUPABASE_URL="https://<project>.supabase.co"');
  console.error('   export SUPABASE_SERVICE_KEY="<service_role_key>"\n');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

// ── Position normalization ────────────────────────────────────
function normalizePos(raw) {
  const p = (raw || '').toLowerCase();
  if (/gk|goal|arq|portero/.test(p))               return 'GK';
  if (/cb|centre.back|central|def.central/.test(p)) return 'CB';
  if (/fb|wb|full.back|wing.back|lateral/.test(p))  return 'FB';
  if (/mf|mid|volante|centrocamp/.test(p))           return 'MF';
  if (/wg|wing|extremo|winger/.test(p))              return 'WG';
  if (/st|cf|striker|forward|delantero/.test(p))     return 'ST';
  return 'MF';
}

// ── Position load profiles (match day = 100%, Akenhead/Owen/Martín-García) ──
const PROFILES = {
  GK: { dist:4500,  hsr:100,  spr:30,  acc:18, dec:16, spd:22.0, load:280 },
  CB: { dist:9800,  hsr:380,  spr:110, acc:32, dec:30, spd:28.5, load:540 },
  FB: { dist:10800, hsr:720,  spr:240, acc:42, dec:38, spd:31.0, load:620 },
  MF: { dist:11400, hsr:580,  spr:180, acc:48, dec:44, spd:29.5, load:680 },
  WG: { dist:11000, hsr:920,  spr:380, acc:38, dec:35, spd:32.0, load:640 },
  ST: { dist:10200, hsr:760,  spr:320, acc:36, dec:33, spd:32.5, load:580 },
};

// ── Phase multipliers (% of match day) ───────────────────────
const PHASES = {
  'MD+1': { dist:0.35, hsr:0.15, spr:0.10, acc:0.25, dec:0.22, spd:0.70, load:0.30 },
  'MD-4': { dist:0.75, hsr:0.60, spr:0.55, acc:0.80, dec:0.78, spd:0.85, load:0.70 },
  'MD-3': { dist:0.90, hsr:0.80, spr:0.75, acc:0.90, dec:0.88, spd:0.92, load:0.85 },
  'MD-2': { dist:0.55, hsr:0.70, spr:0.80, acc:0.65, dec:0.62, spd:0.95, load:0.60 },
  'MD-1': { dist:0.40, hsr:0.25, spr:0.20, acc:0.40, dec:0.38, spd:0.80, load:0.35 },
  'MD':   { dist:1.00, hsr:1.00, spr:1.00, acc:1.00, dec:1.00, spd:1.00, load:1.00 },
};

const PHASE_TYPE = {
  'MD+1': 'Recovery',
  'MD-4': 'Conditioning',
  'MD-3': 'Tactical',
  'MD-2': 'Tactical',
  'MD-1': 'Conditioning',
  'MD':   'Match',
};

// ── Gaussian noise (±15% per session) ────────────────────────
function gauss() {
  let u = 0, v = 0;
  while (!u) u = Math.random();
  while (!v) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function noisy(val) { return Math.max(0, val * (1 + gauss() * 0.15)); }

// ── Build one gps_reports row ─────────────────────────────────
function buildRow(player, phase, sessionId, clubId, mods = {}) {
  const prof = PROFILES[normalizePos(player.position)] || PROFILES.MF;
  const mult = PHASES[phase];
  return {
    player_id:           player.id,
    session_id:          sessionId,
    club_id:             clubId,
    total_distance:      Math.round(noisy(prof.dist  * mult.dist)  * (mods.dist  ?? 1)),
    high_speed_distance: Math.round(noisy(prof.hsr   * mult.hsr)   * (mods.hsr   ?? 1)),
    sprint_distance:     Math.round(noisy(prof.spr   * mult.spr)   * (mods.spr   ?? 1)),
    accelerations:       Math.round(noisy(prof.acc   * mult.acc)   * (mods.acc   ?? 1)),
    decelerations:       Math.round(noisy(prof.dec   * mult.dec)   * (mods.dec   ?? 1)),
    max_speed:           +( noisy(prof.spd   * mult.spd)           * (mods.spd   ?? 1)).toFixed(1),
    player_load:         Math.round(noisy(prof.load  * mult.load)  * (mods.load  ?? 1)),
  };
}

// ── Date helpers ──────────────────────────────────────────────
function toISO(d) { return d.toISOString().slice(0, 10); }

function getMCWeeks(n = 8) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sunday = new Date(today);
  sunday.setDate(today.getDate() - today.getDay()); // most recent Sunday
  return Array.from({ length: n }, (_, i) => {
    const sun = new Date(sunday);
    sun.setDate(sunday.getDate() - 7 * (n - 1 - i)); // i=0 = oldest, i=n-1 = current
    return { n: i + 1, sun };
  });
}

// ── Rollback ─────────────────────────────────────────────────
async function rollback(clubId) {
  console.log('\n⏳  Rollback: eliminando datos seed…');
  const { data: seedSessions } = await sb.from('training_sessions')
    .select('id').like('notes', '[SEED]%').eq('club_id', clubId);
  const ids = (seedSessions || []).map(s => s.id);
  if (!ids.length) { console.log('✓ No hay datos seed para eliminar.\n'); return; }
  const { error: e1 } = await sb.from('gps_reports').delete().in('session_id', ids);
  if (e1) console.error('  ⚠️  gps_reports:', e1.message);
  const { error: e2 } = await sb.from('training_sessions').delete().in('id', ids);
  if (e2) console.error('  ⚠️  training_sessions:', e2.message);
  console.log(`✓ Eliminadas ${ids.length} sesiones seed y sus gps_reports.\n`);
}

// ── Main ──────────────────────────────────────────────────────
const rl = readline.createInterface({ input, output });

async function main() {
  console.log('\n📊  GPS Seed — ClavaMetrics\n');

  // ─ Step 1: Inspect DB ─────────────────────────────────────
  const [
    { data: clubs },
    { data: players },
    { data: sessions },
    { count: gpsCount },
  ] = await Promise.all([
    sb.from('clubs').select('id, name'),
    sb.from('players')
      .select('id, first_name, last_name, position, status, club_id')
      .neq('status', 'inactive'),
    sb.from('training_sessions')
      .select('id, club_id, title, session_date, session_type')
      .order('session_date', { ascending: false }),
    sb.from('gps_reports').select('id', { count: 'exact', head: true }),
  ]);

  if (!clubs?.length) { console.error('❌  No hay clubs en la DB.'); process.exit(1); }

  // ─ Club selection ──────────────────────────────────────────
  let club;
  if (clubs.length === 1) {
    club = clubs[0];
  } else {
    console.log('\n🏟️  Clubs disponibles:');
    clubs.forEach((c, i) => console.log(`   ${i + 1}) ${c.name}  (${c.id})`));
    const pick = await rl.question(`\nElegí un club (1-${clubs.length}): `);
    const idx = parseInt(pick.trim(), 10) - 1;
    if (isNaN(idx) || idx < 0 || idx >= clubs.length) {
      console.error('❌  Selección inválida.'); rl.close(); process.exit(1);
    }
    club = clubs[idx];
    console.log(`✓ Club seleccionado: ${club.name}\n`);
  }

  const clubPlayers  = (players  || []).filter(p => p.club_id === club.id);
  const clubSessions = (sessions || []).filter(s => s.club_id === club.id);

  // Position breakdown
  const byCat = {};
  clubPlayers.forEach(p => { const k = normalizePos(p.position); byCat[k] = (byCat[k] || 0) + 1; });

  // Position mapping (raw → normalized)
  const rawToNorm = {};
  clubPlayers.forEach(p => { rawToNorm[p.position || '(none)'] = normalizePos(p.position); });

  const w = 55;
  const line = (txt = '') => console.log(`│  ${txt.padEnd(w - 4)}│`);
  console.log('┌' + '─'.repeat(w - 2) + '┐');
  line(`Club: ${club.name}`);
  line(`Players activos: ${clubPlayers.length}`);
  Object.entries(byCat).forEach(([k, v]) => line(`  ${k}: ${v}`));
  line();
  line(`Sessions existentes: ${clubSessions.length}`);
  line(`GPS reports existentes: ${gpsCount ?? 0}`);
  line(`Última sesión: ${clubSessions[0] ? `${clubSessions[0].session_date} · ${clubSessions[0].session_type}` : 'ninguna'}`);
  line();
  line('Mapeo de posiciones:');
  [...new Set(Object.entries(rawToNorm).map(([r, n]) => `  "${r}" → ${n}`))].forEach(m => line(m));
  console.log('└' + '─'.repeat(w - 2) + '┘');

  // ─ Minimum check ──────────────────────────────────────────
  if (clubPlayers.length < 10) {
    console.error('\n❌  Necesitás al menos 10 jugadores activos.');
    console.error('   Cargá jugadores desde Squad.html y volvé a correr este script.\n');
    rl.close(); process.exit(1);
  }

  // ─ Rollback mode ──────────────────────────────────────────
  if (process.argv.includes('--rollback')) {
    await rollback(club.id);
    rl.close(); process.exit(0);
  }

  // ─ What we'll insert ──────────────────────────────────────
  const weeks = getMCWeeks(8);
  const estSessions = weeks.length * 6;
  const estReports  = weeks.length * (5 * clubPlayers.length + Math.ceil(clubPlayers.length * 0.5));

  console.log('\n📋  Lo que voy a insertar:');
  console.log(`    8 microciclos: ${toISO(weeks[0].sun)} → ${toISO(weeks[7].sun)}`);
  console.log(`    ${estSessions} training_sessions nuevas (marcadas [SEED])`);
  console.log(`    ~${estReports} gps_reports`);
  console.log(`    2 anomalías deliberadas para testing`);
  console.log('\n⚠️  Revertir: node assets/gps-seed.mjs --rollback\n');

  const ans = await rl.question('¿Continuar? (y/N) ');
  if (ans.trim().toLowerCase() !== 'y') {
    console.log('Cancelado.\n'); rl.close(); process.exit(0);
  }

  // ─ Clean up any previous seed before inserting ────────────
  const { data: prevSeed } = await sb.from('training_sessions')
    .select('id').like('notes', '[SEED]%').eq('club_id', club.id);
  if (prevSeed?.length) {
    console.log(`\n⚠️  Encontré ${prevSeed.length} sesiones seed previas — limpiando primero.`);
    await rollback(club.id);
  }

  // ─ Step 2: Insert sessions ────────────────────────────────
  console.log('\n⏳  Insertando training_sessions…');
  const startTime = new Date().toISOString();

  const PHASE_DAYS = [
    { day: 0, phase: 'MD+1' },
    // day 1 = lunes = descanso
    { day: 2, phase: 'MD-4' },
    { day: 3, phase: 'MD-3' },
    { day: 4, phase: 'MD-2' },
    { day: 5, phase: 'MD-1' },
    { day: 6, phase: 'MD'   },
  ];

  const sessionMeta = []; // { id, mcN, phase, players[] }

  for (const wk of weeks) {
    for (const { day, phase } of PHASE_DAYS) {
      const d = new Date(wk.sun);
      d.setDate(wk.sun.getDate() + day);
      const { data: ins, error } = await sb.from('training_sessions').insert({
        club_id:      club.id,
        title:        `MC${wk.n} · ${phase}`,
        session_date: toISO(d),
        session_type: PHASE_TYPE[phase],
        notes:        `[SEED] MC${wk.n} · ${phase}`,
      }).select('id').single();

      if (error) {
        console.error(`  ⚠️  MC${wk.n} ${phase} (${toISO(d)}): ${error.message}`);
        continue;
      }

      // MD+1: only ~50% of players (the "starters" who played the match)
      const subset = phase === 'MD+1'
        ? [...clubPlayers].sort(() => Math.random() - 0.5).slice(0, Math.ceil(clubPlayers.length * 0.5))
        : clubPlayers;

      sessionMeta.push({ id: ins.id, mcN: wk.n, phase, players: subset });
    }
  }
  console.log(`✓ ${sessionMeta.length} sesiones insertadas`);

  // ─ Step 3: Pick anomaly players ───────────────────────────
  const mfwg = clubPlayers.filter(p => ['MF','WG'].includes(normalizePos(p.position)));
  const fbwg = clubPlayers.filter(p => ['FB','WG'].includes(normalizePos(p.position)));
  const anomaly1 = mfwg[Math.floor(Math.random() * mfwg.length)] || clubPlayers[0];
  const anomaly2 = fbwg.find(p => p.id !== anomaly1.id) || clubPlayers.find(p => p.id !== anomaly1.id) || clubPlayers[1];

  // ─ Step 4: Build + insert gps_reports ────────────────────
  console.log('⏳  Insertando gps_reports…');
  const rows = [];

  for (const sm of sessionMeta) {
    for (const player of sm.players) {
      const mods = {};

      // Anomaly 1: MC 6 · MF/WG → HSR + Sprint +80% → ACWR >1.5
      if (player.id === anomaly1.id && sm.mcN === 6 && sm.phase !== 'MD+1') {
        mods.hsr = 1.8; mods.spr = 1.8;
      }

      // Anomaly 2: MC 3 · MD-4/MD-3 · FB/WG → HSR -40% → simula caída pre-injury
      if (player.id === anomaly2.id && sm.mcN === 3 && ['MD-4','MD-3'].includes(sm.phase)) {
        mods.hsr = 0.6;
      }

      rows.push(buildRow(player, sm.phase, sm.id, club.id, mods));
    }
  }

  // Batch in chunks of 500
  let insertedRows = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await sb.from('gps_reports').insert(rows.slice(i, i + 500));
    if (error) { console.error('  ❌  gps_reports batch error:', error.message); break; }
    insertedRows += Math.min(500, rows.length - i);
    process.stdout.write(`\r  ${insertedRows}/${rows.length} filas…`);
  }
  console.log();

  // ─ Step 5: Validate ───────────────────────────────────────
  const { count: newSessions } = await sb.from('training_sessions')
    .select('id', { count: 'exact', head: true })
    .like('notes', '[SEED]%').eq('club_id', club.id);

  const { count: newReports } = await sb.from('gps_reports')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', startTime);

  console.log('\n✅  Seed completado:');
  console.log(`    training_sessions insertadas: ${newSessions}`);
  console.log(`    gps_reports insertados:       ${newReports}`);
  console.log('\n🎯  Anomalías inyectadas (buscalas en el dashboard):');
  console.log(`    1) ${anomaly1.first_name} ${anomaly1.last_name} (${anomaly1.position || '?'})`);
  console.log(`       MC 6 · todas las fases → HSR + Sprint +80% → genera ACWR > 1.5`);
  console.log(`    2) ${anomaly2.first_name} ${anomaly2.last_name} (${anomaly2.position || '?'})`);
  console.log(`       MC 3 · MD-4 y MD-3 → HSR -40% → simula caída pre-injury`);
  console.log('\n🔄  Para revertir:');
  console.log('    node assets/gps-seed.mjs --rollback\n');

  rl.close();
}

main().catch(err => {
  console.error('\n❌  Error fatal:', err.message || err);
  process.exit(1);
});
