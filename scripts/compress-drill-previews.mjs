// One-time: recomprime las vistas previas PNG del bucket drill-previews a WebP q85.
// Recorre las filas de `exercises` con preview_path .png (la fuente de verdad — los
// archivos huérfanos sin fila se dejan como están), baja cada archivo, lo convierte
// (≤1600px, sin agrandar), sube el .webp, apunta la fila al path nuevo y borra el .png.
//
// Uso:
//   npm i -D sharp                    (solo la primera vez)
//   SUPABASE_URL=https://xesrumijvdmqjrufgeka.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=<service role key del dashboard> \
//   node scripts/compress-drill-previews.mjs           → dry-run (solo muestra ahorro)
//   ... node scripts/compress-drill-previews.mjs --apply   → ejecuta de verdad
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const URL_ = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !KEY) { console.error('Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
const APPLY = process.argv.includes('--apply');
const sb = createClient(URL_, KEY, { auth: { persistSession: false } });
const BUCKET = 'drill-previews';

const { data: rows, error } = await sb.from('exercises')
  .select('id,club_id,preview_path')
  .not('preview_path', 'is', null)
  .like('preview_path', '%.png');
if (error) { console.error('Query error:', error.message); process.exit(1); }
console.log(`${rows.length} ejercicios con preview .png${APPLY ? '' : '  (DRY-RUN: nada se modifica; correr con --apply)'}\n`);

let before = 0, after = 0, done = 0, skipped = 0, failed = 0;
for (const r of rows) {
  try {
    const dl = await sb.storage.from(BUCKET).download(r.preview_path);
    if (dl.error) { console.warn(`  ! ${r.preview_path}: no se pudo bajar (${dl.error.message})`); failed++; continue; }
    const src = Buffer.from(await dl.data.arrayBuffer());
    const webp = await sharp(src)
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();
    if (webp.length >= src.length) { skipped++; continue; }   // ya era chico: no tocar
    before += src.length; after += webp.length;
    const newPath = r.preview_path.replace(/\.png$/, '.webp');
    if (APPLY) {
      const up = await sb.storage.from(BUCKET).upload(newPath, webp, { upsert: true, contentType: 'image/webp' });
      if (up.error) { console.warn(`  ! ${newPath}: upload falló (${up.error.message})`); failed++; continue; }
      const upd = await sb.from('exercises').update({ preview_path: newPath }).eq('id', r.id);
      if (upd.error) { console.warn(`  ! fila ${r.id}: update falló (${upd.error.message}) — se deja el .png`); failed++; continue; }
      await sb.storage.from(BUCKET).remove([r.preview_path]);
    }
    done++;
    if (done % 25 === 0) console.log(`  … ${done}/${rows.length}`);
  } catch (e) { console.warn(`  ! ${r.preview_path}: ${e.message}`); failed++; }
}
const mb = n => (n / 1048576).toFixed(1) + ' MB';
console.log(`\n${APPLY ? 'Convertidos' : 'Se convertirían'}: ${done} · sin cambio: ${skipped} · fallidos: ${failed}`);
console.log(`Tamaño: ${mb(before)} → ${mb(after)}  (ahorro ${mb(before - after)})`);
