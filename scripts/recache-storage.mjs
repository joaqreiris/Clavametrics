// One-time: vuelve a subir lo que YA está en Storage con cacheControl largo (y achica las
// imágenes desmedidas de paso). El cacheControl se fija en el momento de la subida, así que
// los archivos viejos siguen sirviéndose con max-age=3600 (o 60, los logos) por más que el
// código nuevo suba bien: el navegador vuelve a pedirlos cada hora y eso es egress puro.
//
// NO cambia ningún path — las URLs firmadas y las filas que las referencian siguen valiendo.
//
// Uso:
//   npm i -D sharp                    (solo la primera vez)
//   SUPABASE_URL=https://xesrumijvdmqjrufgeka.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=<service role key del dashboard> \
//   node scripts/recache-storage.mjs           → dry-run (solo informa)
//   ... node scripts/recache-storage.mjs --apply   → ejecuta de verdad
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const URL_ = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !KEY) { console.error('Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
const APPLY = process.argv.includes('--apply');
const sb = createClient(URL_, KEY, { auth: { persistSession: false } });

const CACHE = '31536000';   // 1 año — coincide con window.CM_CACHE_IMMUTABLE en la app

// maxDim/maxBytes = a partir de qué tamaño vale la pena recomprimir. null = no tocar los
// bytes, sólo refrescar el cacheControl (medical-documents queda afuera a propósito).
const BUCKETS = [
  { id: 'profile-avatars',    maxDim: 512,  maxBytes: 150 * 1024 },
  { id: 'club-logos',         maxDim: 512,  maxBytes: 120 * 1024 },
  { id: 'player-photos',      maxDim: 1000, maxBytes: 200 * 1024 },
  { id: 'drill-previews',     maxDim: 1600, maxBytes: 300 * 1024 },
  { id: 'gym-exercise-media', maxDim: 1200, maxBytes: 400 * 1024 },
  { id: 'club-assets',        maxDim: 512,  maxBytes: 100 * 1024 },
  { id: 'field-objects',      maxDim: null, maxBytes: null },
  { id: 'chat-attachments',   maxDim: null, maxBytes: null },
];

// Storage.list() sólo devuelve una carpeta por vez, así que hay que bajar recursivamente.
async function walk(bucket, prefix = '', out = []) {
  const { data, error } = await sb.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error) { console.warn(`  ! list ${bucket}/${prefix}: ${error.message}`); return out; }
  for (const e of data || []) {
    const path = prefix ? `${prefix}/${e.name}` : e.name;
    if (e.id === null) await walk(bucket, path, out);            // carpeta
    else out.push({ path, size: Number(e.metadata?.size || 0), mime: e.metadata?.mimetype || '' });
  }
  return out;
}

// Recomprime sólo si es una imagen rasterizada y el resultado es realmente más chico.
// Los GIF (animados) y los SVG se dejan intactos: reencodearlos los rompe. Sale WebP, que
// conserva la transparencia (importante para logos y escudos). El path NO cambia aunque
// termine en .png — lo que manda al renderizar es el Content-Type, que sí se actualiza.
async function shrink(buf, mime, maxDim, maxBytes) {
  if (maxDim == null) return null;
  if (!/^image\/(png|jpe?g|webp)$/.test(mime)) return null;
  if (buf.length <= maxBytes) return null;
  const out = await sharp(buf)
    .resize({ width: maxDim, height: maxDim, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer();
  if (out.length >= buf.length) return null;
  return { buf: out, mime: 'image/webp' };
}

const mb = n => (n / 1048576).toFixed(2) + ' MB';
let totBefore = 0, totAfter = 0, totFiles = 0, totFail = 0;

for (const b of BUCKETS) {
  const files = await walk(b.id);
  if (!files.length) { console.log(`${b.id}: vacío`); continue; }
  let before = 0, after = 0, shrunk = 0, failed = 0;
  for (const f of files) {
    try {
      const dl = await sb.storage.from(b.id).download(f.path);
      if (dl.error) { console.warn(`  ! ${b.id}/${f.path}: no se pudo bajar (${dl.error.message})`); failed++; continue; }
      const src = Buffer.from(await dl.data.arrayBuffer());
      const sm = await shrink(src, f.mime, b.maxDim, b.maxBytes);
      before += src.length; after += sm ? sm.buf.length : src.length;
      if (sm) shrunk++;
      if (APPLY) {
        // update() reemplaza el contenido EN EL MISMO PATH y reescribe el cacheControl.
        const up = await sb.storage.from(b.id).update(f.path, sm ? sm.buf : src, {
          cacheControl: CACHE,
          contentType: sm ? sm.mime : (f.mime || undefined),
          upsert: true,
        });
        if (up.error) { console.warn(`  ! ${b.id}/${f.path}: update falló (${up.error.message})`); failed++; continue; }
      }
    } catch (e) { console.warn(`  ! ${b.id}/${f.path}: ${e.message}`); failed++; }
  }
  console.log(`${b.id}: ${files.length} archivos · recomprimidos ${shrunk} · fallidos ${failed} · ${mb(before)} → ${mb(after)}`);
  totBefore += before; totAfter += after; totFiles += files.length; totFail += failed;
}

console.log(`\n${APPLY ? 'Aplicado' : 'DRY-RUN (nada se modificó; correr con --apply)'}`);
console.log(`${totFiles} archivos · fallidos ${totFail} · ${mb(totBefore)} → ${mb(totAfter)} (ahorro ${mb(totBefore - totAfter)})`);
console.log(`cacheControl objetivo: ${CACHE}s`);
