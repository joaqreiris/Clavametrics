import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
const REACT_PROD    = '<script defer src="https://unpkg.com/react@18.3.1/umd/react.production.min.js" crossorigin="anonymous"></script>';
const REACTDOM_PROD = '<script defer src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js" crossorigin="anonymous"></script>';

// text/babel script con src="...jsx" en CUALQUIER orden de atributos (type antes o después de src).
const BABEL_SRC = /<script\b(?=[^>]*\btype="text\/babel")(?=[^>]*\bsrc="([^"]+)\.jsx")[^>]*><\/script>/g;
// text/babel SIN src (en ningún lado del tag) = JSX inline → no se puede migrar con un regex
// (necesita extraer a .jsx + build). El lookahead de src se ancla al inicio del tag para no
// confundir el orden de atributos invertido (src="..." type="text/babel").
const BABEL_INLINE = /<script\b(?![^>]*\bsrc=)[^>]*\btype="text\/babel"[^>]*>/;

let changed = 0;
const skipped = [];
for (const f of readdirSync('.').filter(f => f.endsWith('.html'))) {
  let s = readFileSync(f, 'utf8');
  if (!s.includes('@babel/standalone')) continue;        // salta páginas ya migradas (GPS) o sin babel
  if (BABEL_INLINE.test(s)) { skipped.push(f); continue; } // JSX inline → dejar babel, migrar a mano
  const before = s;
  s = s.replace(/<script[^>]*react@[\d.]+\/umd\/react\.development\.js[^>]*><\/script>/g, REACT_PROD);
  s = s.replace(/<script[^>]*react-dom@[\d.]+\/umd\/react-dom\.development\.js[^>]*><\/script>/g, REACTDOM_PROD);
  s = s.replace(/[ \t]*<script[^>]*@babel\/standalone[^>]*><\/script>\n?/g, '');
  s = s.replace(BABEL_SRC, '<script defer src="$1.js"></script>');
  if (s !== before) { writeFileSync(f, s); changed++; console.log('  ✓', f); }
}
console.log(`Codemod: ${changed} páginas transformadas.`);
if (skipped.length) console.log(`Saltadas (JSX inline, requieren extracción manual): ${skipped.join(', ')}`);
