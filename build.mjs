import { build } from 'esbuild';
import { readdirSync } from 'node:fs';

// Compila cada .jsx de la raíz a .js minificado (IIFE), preservando los globals (window.X / Object.assign).
const entryPoints = readdirSync('.').filter(f => f.endsWith('.jsx'));
if (!entryPoints.length) { console.log('No .jsx files found.'); process.exit(0); }

await build({
  entryPoints,
  outdir: '.',
  bundle: true,
  minify: true,
  format: 'iife',
  loader: { '.jsx': 'jsx' },
  jsx: 'transform',
  target: ['es2019'],
  logLevel: 'error',
});
console.log('Built:', entryPoints.map(f => f.replace('.jsx', '.js')).join(', '));
