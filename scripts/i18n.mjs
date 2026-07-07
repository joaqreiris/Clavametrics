#!/usr/bin/env node
/* ClavaMetrics i18n toolbox — zero-dependency.
 *
 *   node scripts/i18n.mjs audit                 # coverage report (pages + locales)
 *   node scripts/i18n.mjs scan "Squad.html"     # harvest untranslated strings -> candidates
 *   node scripts/i18n.mjs scan "Squad.html" --csv > squad.csv
 *   node scripts/i18n.mjs new ja                 # scaffold locales/ja.json from en.json
 *   node scripts/i18n.mjs check                  # CI: non-zero exit if a locale is incomplete
 *
 * "scan" is a REPORTER (never edits your HTML). It lists visible text + key
 * attributes that still need a data-i18n tag, with a suggested key namespaced
 * from the file name. Use the output as an atomic worklist.
 */
import fs from "node:fs";
import path from "node:path";

const LOCALES = "locales";
const BASE = "en";
const cmd = process.argv[2];
const arg = process.argv[3];
const flags = new Set(process.argv.slice(3).filter(a => a.startsWith("--")));

function loadLocale(code) {
  return JSON.parse(fs.readFileSync(path.join(LOCALES, code + ".json"), "utf8"));
}
function listLocales() {
  return fs.readdirSync(LOCALES).filter(f => f.endsWith(".json")).map(f => f.replace(/\.json$/, ""));
}
function htmlFiles() {
  return fs.readdirSync(".").filter(f => f.endsWith(".html"));
}

// ── slug a filename into a key namespace: "GPS Analysis.html" -> "gps_analysis"
function nsOf(file) {
  return path.basename(file, ".html").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
// short slug of a phrase -> key leaf
function slug(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").split("_").slice(0, 5).join("_") || "x";
}

// ── conservative HTML text harvester ─────────────────────────────────────────
// Skips <script>, <style>, <svg>, comments, and elements already carrying a
// data-i18n* attribute. Reports visible text nodes + translatable attributes.
const SKIP_TAGS = new Set(["script", "style", "svg", "noscript", "template", "code", "pre"]);
const ATTR_KEYS = ["placeholder", "title", "aria-label", "alt"];
const TRANSLATABLE = /[A-Za-z]{2,}/; // must contain a word

function scan(file) {
  const src = fs.readFileSync(file, "utf8");
  const out = [];
  let i = 0, line = 1;
  const stackSkip = [];
  let inComment = false;

  function pushText(text, ln) {
    const trimmed = text.replace(/\s+/g, " ").trim();
    if (!trimmed || !TRANSLATABLE.test(trimmed)) return;
    // ignore pure entities / numbers / single symbols
    if (/^[\d\s.,:%$€/+\-]+$/.test(trimmed)) return;
    out.push({ line: ln, kind: "text", text: trimmed });
  }

  while (i < src.length) {
    if (src[i] === "\n") line++;
    if (inComment) {
      if (src.startsWith("-->", i)) { inComment = false; i += 3; continue; }
      i++; continue;
    }
    if (src.startsWith("<!--", i)) { inComment = true; i += 4; continue; }
    // declarations like <!DOCTYPE html> — skip to '>'
    if (src.startsWith("<!", i)) { const gt = src.indexOf(">", i); i = gt === -1 ? src.length : gt + 1; continue; }

    if (src[i] === "<") {
      // closing tag?
      const close = /^<\/([a-zA-Z0-9-]+)\s*>/.exec(src.slice(i));
      if (close) {
        const tag = close[1].toLowerCase();
        if (stackSkip.length && stackSkip[stackSkip.length - 1] === tag) stackSkip.pop();
        i += close[0].length; continue;
      }
      // opening tag
      const open = /^<([a-zA-Z0-9-]+)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/.exec(src.slice(i));
      if (open) {
        const tag = open[1].toLowerCase();
        const attrs = open[2] || "";
        const selfClose = open[3] === "/";
        const hasI18n = /\bdata-i18n(-\w+)?\s*=/.test(attrs);
        // translatable attributes on this element
        if (!hasI18n) {
          for (const a of ATTR_KEYS) {
            const m = new RegExp("\\b" + a + "\\s*=\\s*\"([^\"]+)\"").exec(attrs)
                   || new RegExp("\\b" + a + "\\s*=\\s*'([^']+)'").exec(attrs);
            if (m && TRANSLATABLE.test(m[1]) && !/^[\d\s.,:%$€/+\-]+$/.test(m[1].trim()))
              out.push({ line, kind: "attr:" + a, text: m[1].trim() });
          }
        }
        if (!selfClose && SKIP_TAGS.has(tag)) stackSkip.push(tag);
        i += open[0].length; continue;
      }
      // stray '<'
      i++; continue;
    }

    // text run until next '<'
    const next = src.indexOf("<", i);
    const end = next === -1 ? src.length : next;
    const chunk = src.slice(i, end);
    for (const c of chunk) if (c === "\n") line++;
    if (!stackSkip.length) pushText(chunk, line);
    i = end;
  }
  return out;
}

// ── commands ─────────────────────────────────────────────────────────────────
function cmdAudit() {
  const locales = listLocales();
  const en = loadLocale(BASE);
  const enKeys = Object.keys(en);

  console.log("── LOCALE COMPLETENESS ──");
  console.log(`base (${BASE}): ${enKeys.length} keys`);
  for (const l of locales) {
    if (l === BASE) continue;
    const d = loadLocale(l);
    const missing = enKeys.filter(k => !(k in d));
    const extra = Object.keys(d).filter(k => !(k in en));
    const untranslated = enKeys.filter(k => k in d && d[k] === en[k] && typeof en[k] === "string");
    console.log(`  ${l}: ${Object.keys(d).length} keys | missing ${missing.length} | extra ${extra.length} | same-as-en ${untranslated.length}`);
  }

  console.log("\n── PAGE COVERAGE (data-i18n tags per page) ──");
  const rows = [];
  for (const f of htmlFiles()) {
    const src = fs.readFileSync(f, "utf8");
    const tags = (src.match(/data-i18n(-\w+)?=/g) || []).length;
    const loads = /assets\/i18n\.js|["']i18n\.js/.test(src);
    rows.push({ f, tags, loads });
  }
  rows.sort((a, b) => a.tags - b.tags);
  const done = rows.filter(r => r.tags > 0).length;
  console.log(`${done}/${rows.length} pages have i18n tags\n`);
  for (const r of rows) {
    const mark = r.tags > 0 ? (r.loads ? "✓" : "!") : "·";
    console.log(`  ${mark} ${String(r.tags).padStart(4)}  ${r.loads ? "[loads]" : "[     ]"}  ${r.f}`);
  }
  console.log("\n  ✓ tagged & loads runtime   ! tagged but no runtime include   · untouched");
}

function cmdScan(file) {
  if (!file || !fs.existsSync(file)) { console.error("scan: file not found:", file); process.exit(1); }
  const ns = nsOf(file);
  const items = scan(file);
  const seen = new Map();
  const rows = items.map(it => {
    let leaf = slug(it.text);
    let key = `${ns}.${leaf}`, n = 1;
    while (seen.has(key) && seen.get(key) !== it.text) key = `${ns}.${leaf}_${++n}`;
    seen.set(key, it.text);
    return { key, ...it };
  });
  if (flags.has("--csv")) {
    console.log("key,line,kind,text");
    for (const r of rows) console.log(`"${r.key}",${r.line},${r.kind},"${r.text.replace(/"/g, '""')}"`);
  } else {
    console.log(`# ${file} — ${rows.length} candidate string(s), namespace "${ns}"\n`);
    for (const r of rows) console.log(`${String(r.line).padStart(5)}  ${r.kind.padEnd(12)}  ${r.key}\n         ${JSON.stringify(r.text)}`);
    console.log(`\n${rows.length} strings. Add the keys you want to locales/*.json, then tag the elements with data-i18n="<key>".`);
  }
}

function cmdNew(code) {
  if (!code || !/^[a-z]{2}(-[a-z]{2})?$/.test(code)) { console.error("new: pass a language code, e.g. `new ja` or `new zh-cn`"); process.exit(1); }
  const target = path.join(LOCALES, code + ".json");
  if (fs.existsSync(target)) { console.error("new: already exists:", target); process.exit(1); }
  const en = loadLocale(BASE);
  fs.writeFileSync(target, JSON.stringify(en, null, 2) + "\n"); // pre-filled with EN, ready to translate
  console.log(`Created ${target} with ${Object.keys(en).length} keys (English placeholders).`);
  console.log(`Next: 1) translate the values  2) register "${code}" in assets/i18n.js LANGS/LABEL/NAME`);
  console.log(`      3) (optional) add its country codes to COUNTRY_LANG`);
}

function cmdCheck() {
  const en = loadLocale(BASE);
  const enKeys = Object.keys(en);
  let bad = 0;
  for (const l of listLocales()) {
    if (l === BASE) continue;
    const d = loadLocale(l);
    const missing = enKeys.filter(k => !(k in d));
    if (missing.length) { bad++; console.error(`✗ ${l}: missing ${missing.length} keys, e.g. ${missing.slice(0, 5).join(", ")}`); }
    else console.log(`✓ ${l}: complete`);
  }
  process.exit(bad ? 1 : 0);
}

switch (cmd) {
  case "audit": cmdAudit(); break;
  case "scan":  cmdScan(arg); break;
  case "new":   cmdNew(arg); break;
  case "check": cmdCheck(); break;
  default:
    console.log("usage: node scripts/i18n.mjs <audit|scan <file>|new <code>|check>");
}
