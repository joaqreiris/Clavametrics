// Copia de seguridad propia: base de datos + Storage, a una carpeta local.
//
// POR QUÉ EXISTE, si Supabase Pro ya hace backups diarios:
//   1. Los backups de Supabase NO incluyen los archivos de Storage — solo los metadatos
//      de la tabla storage.objects. Las fotos de jugadores, los adjuntos del chat y los
//      documentos médicos NO están cubiertos por nada más que este script.
//   2. Si se borra el proyecto, Supabase borra también sus backups. Este es el único
//      que sobrevive a un problema con la cuenta.
//   3. Un dump lógico se puede abrir, leer y restaurar PARCIALMENTE (una sola tabla).
//      Los backups físicos del panel son todo-o-nada y te obligan a volver el proyecto
//      entero a un momento anterior.
//
// Uso:
//   export SUPABASE_URL=https://xesrumijvdmqjrufgeka.supabase.co
//   export SUPABASE_SERVICE_ROLE_KEY=<service role key: Dashboard > Settings > API>
//   export SUPABASE_DB_URL=<connection string: Dashboard > Settings > Database>
//
//   node scripts/backup.mjs                  → dry-run: dice qué haría y cuánto pesa
//   node scripts/backup.mjs --apply          → hace la copia de verdad
//
//   --out=<dir>    dónde escribir (default: ./backups, ignorado por git)
//   --keep=<n>     cuántas copias conservar (default: 4)
//   --skip-db      solo Storage
//   --skip-storage solo base de datos
//
// Restaurar: ver scripts/RESTORE.md — y probarlo ANTES de necesitarlo.
import { createClient } from '@supabase/supabase-js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';

const run = promisify(execFile);

const URL_    = process.env.SUPABASE_URL;
const KEY     = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DB_URL  = process.env.SUPABASE_DB_URL;
const APPLY   = process.argv.includes('--apply');
const SKIP_DB = process.argv.includes('--skip-db');
const SKIP_ST = process.argv.includes('--skip-storage');
const arg     = (name, def) => {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : def;
};
const OUT  = path.resolve(arg('out', 'backups'));
const KEEP = Math.max(1, parseInt(arg('keep', '4'), 10) || 4);

// Fecha LOCAL, no UTC: un backup del domingo a la noche no debe quedar fechado el lunes.
const stamp = (() => {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
})();

const human = b => b > 1048576 ? `${(b / 1048576).toFixed(1)} MB`
             : b > 1024       ? `${(b / 1024).toFixed(0)} kB` : `${b} B`;

let fallos = 0;

async function dumpDb(dir) {
  if (SKIP_DB) return;
  if (!DB_URL) {
    console.error('  ✗ falta SUPABASE_DB_URL — sin eso no se puede volcar la base');
    fallos++; return;
  }
  const file = path.join(dir, `db-${stamp}.sql`);
  if (!APPLY) { console.log(`  · volcaría la base a ${path.relative(process.cwd(), file)}`); return; }
  try {
    // El CLI escribe el dump por stdout; se pide el schema Y los datos.
    const { stdout } = await run('supabase', ['db', 'dump', '--db-url', DB_URL, '--data-only=false'],
      { maxBuffer: 1024 * 1024 * 512 });
    await fs.writeFile(file, stdout);
    const { size } = await fs.stat(file);
    console.log(`  ✓ base de datos → ${path.basename(file)} (${human(size)})`);
  } catch (e) {
    console.error('  ✗ falló el volcado de la base:', (e.stderr || e.message || '').toString().trim().split('\n')[0]);
    console.error('    Probá a mano:  supabase db dump --db-url "$SUPABASE_DB_URL" -f db.sql');
    fallos++;
  }
}

async function dumpStorage(dir) {
  if (SKIP_ST) return;
  if (!URL_ || !KEY) {
    console.error('  ✗ faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY — no se puede bajar Storage');
    fallos++; return;
  }
  const sb = createClient(URL_, KEY, { auth: { persistSession: false } });
  const { data: buckets, error } = await sb.storage.listBuckets();
  if (error) { console.error('  ✗ no se pudieron listar los buckets:', error.message); fallos++; return; }

  let totalN = 0, totalB = 0;
  for (const b of buckets) {
    // listBuckets no da los objetos: se leen de storage.objects vía paginado del SDK.
    const objetos = await listarObjetos(sb, b.name);
    const bytes = objetos.reduce((s, o) => s + (o.size || 0), 0);
    totalN += objetos.length; totalB += bytes;
    if (!APPLY) { console.log(`  · ${b.name}: ${objetos.length} archivos (${human(bytes)})`); continue; }

    let ok = 0;
    for (const o of objetos) {
      const destino = path.join(dir, 'storage', b.name, o.path);
      try {
        const { data, error: e2 } = await sb.storage.from(b.name).download(o.path);
        if (e2) throw e2;
        await fs.mkdir(path.dirname(destino), { recursive: true });
        await fs.writeFile(destino, Buffer.from(await data.arrayBuffer()));
        ok++;
      } catch (e) {
        console.error(`    ✗ ${b.name}/${o.path}: ${e.message || e}`);
        fallos++;
      }
    }
    console.log(`  ✓ ${b.name} → ${ok}/${objetos.length} archivos (${human(bytes)})`);
  }
  if (!APPLY) console.log(`  · total Storage: ${totalN} archivos, ${human(totalB)}`);
}

// El SDK lista por carpeta y de a 100: hay que recorrer el árbol y paginar, o se pierden
// archivos en silencio (el mismo techo que muerde en PostgREST — ver notas del proyecto).
async function listarObjetos(sb, bucket, prefijo = '') {
  const salida = [];
  for (let desde = 0; ; desde += 100) {
    const { data, error } = await sb.storage.from(bucket)
      .list(prefijo, { limit: 100, offset: desde, sortBy: { column: 'name', order: 'asc' } });
    if (error) { console.error(`    ✗ listando ${bucket}/${prefijo}: ${error.message}`); fallos++; break; }
    if (!data || !data.length) break;
    for (const it of data) {
      const rel = prefijo ? `${prefijo}/${it.name}` : it.name;
      // Sin id = es una carpeta, hay que bajar un nivel.
      if (it.id) salida.push({ path: rel, size: it.metadata?.size || 0 });
      else salida.push(...await listarObjetos(sb, bucket, rel));
    }
    if (data.length < 100) break;
  }
  return salida;
}

async function rotar() {
  let previas;
  try { previas = await fs.readdir(OUT); } catch { return; }
  const viejas = previas
    .filter(n => /^\d{4}-\d{2}-\d{2}$/.test(n))
    .sort()
    .slice(0, -KEEP);
  for (const v of viejas) {
    if (!APPLY) { console.log(`  · borraría la copia vieja ${v}`); continue; }
    await fs.rm(path.join(OUT, v), { recursive: true, force: true });
    console.log(`  ✓ borrada la copia vieja ${v}`);
  }
}

const dir = path.join(OUT, stamp);
console.log(APPLY ? `Copia de seguridad → ${dir}` : `DRY-RUN (agregá --apply para hacerla de verdad) → ${dir}`);
if (APPLY) await fs.mkdir(dir, { recursive: true });
await dumpDb(dir);
await dumpStorage(dir);
await rotar();

if (fallos) {
  console.error(`\n⚠️  Terminó con ${fallos} error(es). Una copia incompleta no es una copia: revisá antes de confiar en ella.`);
  process.exit(1);
}
console.log(APPLY ? '\n✓ Copia completa.' : '\nDry-run terminado. Nada se escribió.');
