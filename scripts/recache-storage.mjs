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
// Sale WebP, que conserva la transparencia (importante para logos y escudos) y también la
// animación de un GIF (`animated: true` procesa todos los cuadros, no sólo el primero).
// Los SVG se dejan intactos. El path NO cambia aunque termine en .png o .gif — lo que manda
// al renderizar es el Content-Type, que sí se actualiza.
async function shrink(buf, mime, maxDim, maxBytes) {
  if (maxDim == null) return null;
  if (!/^image\/(png|jpe?g|webp|gif)$/.test(mime)) return null;
  if (buf.length <= maxBytes) return null;
  const animated = mime === 'image/gif';
  const out = await sharp(buf, animated ? { animated: true } : {})
    .resize({ width: maxDim, height: maxDim, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: animated ? 80 : 85 })
    .toBuffer();
  if (out.length >= buf.length) return null;
  return { buf: out, mime: 'image/webp' };
}

// Chequear la credencial ANTES de recorrer nada: sin esto, una key inválida hace que cada
// list() falle y el bucket se reporte como "vacío", que parece un resultado y no un error.
{
  const { error } = await sb.storage.listBuckets();
  if (error) {
    console.error(`\nNo se pudo autenticar contra Storage: ${error.message}`);
    console.error('Revisá SUPABASE_SERVICE_ROLE_KEY (Project Settings → API Keys → service_role).');
    console.error('Ojo: si pegás varias líneas de una vez, el `read` se come la línea siguiente');
    console.error('como si fuera la key. Corré el `read` solo, en su propia línea.');
    process.exit(1);
  }
}

const mb = n => (n / 1048576).toFixed(2) + ' MB';
let totBefore = 0, totAfter = 0, totFiles = 0, totFail = 0;
const intrusos = [];   // archivos que no son imagen en buckets que sólo se pintan con <img>

for (const b of BUCKETS) {
  const files = await walk(b.id);
  if (!files.length) { console.log(`${b.id}: vacío`); continue; }
  let before = 0, after = 0, shrunk = 0, failed = 0;
  for (const f of files) {
    try {
      // Un no-imagen en un bucket de imágenes no se renderiza nunca, pero se descarga
      // igual en cada carga. Así apareció un .mov de 19 MB guardado como media_type
      // 'image'. No se borra desde acá — sólo se avisa.
      if (b.maxDim != null && f.mime && !/^image\//.test(f.mime)) {
        intrusos.push({ bucket: b.id, path: f.path, size: f.size, mime: f.mime });
      }
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

if (intrusos.length) {
  console.log(`\n⚠ ${intrusos.length} archivo(s) que NO son imagen en buckets de imágenes.`);
  console.log('  No se renderizan nunca, pero se descargan igual. Revisar y borrar a mano:');
  intrusos.sort((a, b) => b.size - a.size)
    .forEach(i => console.log(`  · ${i.bucket}/${i.path}  (${mb(i.size)}, ${i.mime})`));
}
