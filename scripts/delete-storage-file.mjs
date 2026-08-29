// Borra un archivo suelto de Storage. Pensado para la basura que se cuela en los buckets
// (un video en un bucket de imágenes, un archivo huérfano que ya no referencia ninguna fila).
//
// OJO: es irreversible y no revisa si alguna fila todavía apunta al archivo. Limpiá primero
// la referencia en la tabla y después borrá.
//
// Uso:
//   SUPABASE_URL=https://xesrumijvdmqjrufgeka.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=<service role key> \
//   node scripts/delete-storage-file.mjs <bucket> <path>
import { createClient } from '@supabase/supabase-js';

const URL_ = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !KEY) { console.error('Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }

const [bucket, path] = process.argv.slice(2).filter(a => !a.startsWith('--'));
if (!bucket || !path) {
  console.error('Uso: node scripts/delete-storage-file.mjs <bucket> <path>');
  process.exit(1);
}

const sb = createClient(URL_, KEY, { auth: { persistSession: false } });

// Confirmar que existe (y de paso mostrar qué se está por borrar) antes de tocar nada:
// un remove() sobre un path inexistente devuelve éxito, así que sin esto un typo se vería
// como "borrado ok" y el archivo real seguiría ahí.
const dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
const file = path.slice(path.lastIndexOf('/') + 1);
const { data: listed, error: lsErr } = await sb.storage.from(bucket).list(dir, { search: file });
if (lsErr) { console.error(`No se pudo leer ${bucket}/${dir}: ${lsErr.message}`); process.exit(1); }
const hit = (listed || []).find(f => f.name === file);
if (!hit) { console.error(`No existe: ${bucket}/${path}`); process.exit(1); }

const mb = (Number(hit.metadata?.size || 0) / 1048576).toFixed(2);
console.log(`Borrando ${bucket}/${path}  (${mb} MB, ${hit.metadata?.mimetype || '?'})`);

const { error } = await sb.storage.from(bucket).remove([path]);
if (error) { console.error(`Falló: ${error.message}`); process.exit(1); }
console.log('Borrado.');
