#!/usr/bin/env node
/* =============================================================
   ClavaMetrics — Support center generator (Markdown → HTML)
   -------------------------------------------------------------
   Reads support-site/content/<lang>/*.md, renders each to a static
   HTML page under /support, builds the /support hub grouped by world,
   and a client-side search index.

   No build step at runtime, no dependencies: this is run by hand
   (like scripts/i18n.mjs) and the generated HTML is committed.

       node scripts/build-support.mjs

   Add a page  = drop a new .md (with frontmatter) in content/en/.
   Add a world = edit support-site/docs-index.json.
   Only English is generated for now; the layout (content/<lang>/)
   is already i18n-ready for when translations are added.
   ============================================================= */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, copyFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SITE = join(ROOT, "support-site");
const TPL = join(SITE, "templates");
const OUT = join(ROOT, "support");
const LANG = "en"; // only language generated for now

/* ─────────────────────────── Frontmatter ─────────────────────────── */
// Minimal `key: value` YAML subset — enough for our flat frontmatter.
function parseFrontmatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: raw };
  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const i = line.indexOf(":");
    if (i === -1) continue;
    const key = line.slice(0, i).trim();
    let val = line.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    data[key] = val;
  }
  return { data, body: m[2] };
}

/* ─────────────────────────── Inline markdown ─────────────────────────── */
function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function renderInline(text) {
  // Protect inline code first so its contents aren't touched by other rules.
  const codes = [];
  let s = text.replace(/`([^`]+)`/g, (_, c) => {
    codes.push("<code>" + escapeHtml(c) + "</code>");
    return "" + (codes.length - 1) + "";
  });
  s = escapeHtml(s);
  // Links [text](url)
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, url) => '<a href="' + url + '">' + t + "</a>");
  // Bold then italic
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  // Restore code spans
  s = s.replace(/(\d+)/g, (_, i) => codes[+i]);
  return s;
}

function slugifyHeading(text) {
  return text.toLowerCase().replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-");
}

/* ─────────────────────────── Block markdown ─────────────────────────── */
// Renders the subset used by our docs: h2/h3, paragraphs, ul/ol, GFM
// tables, blockquotes, hr. Returns { html, headings } where headings are
// the H2s (used for the TOC and the search index).
function renderMarkdown(body) {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  const headings = [];
  let i = 0;

  const isTableSep = (l) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(l);
  const splitRow = (l) => l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());

  while (i < lines.length) {
    let line = lines[i];

    // blank
    if (!line.trim()) { i++; continue; }

    // headings (## / ###)
    const h = line.match(/^(#{2,3})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      let txt = h[2].trim();
      // Explicit stable id via trailing `{#anchor}` — lets translated headings
      // keep the same anchor so cross-language links (e.g. glossary#acwr) hold.
      let id;
      const am = txt.match(/\s*\{#([a-z0-9-]+)\}\s*$/i);
      if (am) { id = am[1]; txt = txt.slice(0, am.index).trim(); }
      else { id = slugifyHeading(txt); }
      if (level === 2) headings.push({ id, text: txt });
      out.push("<h" + level + ' id="' + id + '">' + renderInline(txt) + "</h" + level + ">");
      i++;
      continue;
    }

    // horizontal rule
    if (/^---+$/.test(line.trim())) { out.push("<hr>"); i++; continue; }

    // table
    if (line.includes("|") && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const header = splitRow(line);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      let t = "<table><thead><tr>" + header.map((c) => "<th>" + renderInline(c) + "</th>").join("") + "</tr></thead><tbody>";
      for (const r of rows) {
        t += "<tr>" + header.map((_, ci) => "<td>" + renderInline(r[ci] || "") + "</td>").join("") + "</tr>";
      }
      t += "</tbody></table>";
      out.push(t);
      continue;
    }

    // blockquote (collapse consecutive > lines)
    if (/^\s*>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^\s*>\s?/, ""));
        i++;
      }
      out.push("<blockquote><p>" + renderInline(buf.join(" ")) + "</p></blockquote>");
      continue;
    }

    // unordered list
    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        i++;
      }
      out.push("<ul>" + items.map((x) => "<li>" + renderInline(x) + "</li>").join("") + "</ul>");
      continue;
    }

    // ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      out.push("<ol>" + items.map((x) => "<li>" + renderInline(x) + "</li>").join("") + "</ol>");
      continue;
    }

    // paragraph (collect until blank / block start)
    const buf = [line];
    i++;
    while (
      i < lines.length && lines[i].trim() &&
      !/^(#{2,3})\s/.test(lines[i]) && !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) && !/^\s*>\s?/.test(lines[i]) &&
      !/^---+$/.test(lines[i].trim()) &&
      !(lines[i].includes("|") && i + 1 < lines.length && isTableSep(lines[i + 1]))
    ) {
      buf.push(lines[i]);
      i++;
    }
    out.push("<p>" + renderInline(buf.join(" ")) + "</p>");
  }

  // Plain-text version for the search index.
  const text = body
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\{#[\w-]+\}/g, " ")
    .replace(/[#>*`_|-]/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

  return { html: out.join("\n"), headings, text };
}

/* ─────────────────────────── UI strings (per language) ─────────────────────────── */
// Doc-chrome strings around the translated content.
const UI = {
  en: {
    htmlLang: "en", titleSuffix: "ClavaMetrics Support",
    navProduct: "Product", navHow: "How it works", navPricing: "Pricing", navSupport: "Support",
    navSignin: "Sign in", navStart: "Start free",
    bcRoot: "Support", toc: "On this page", searchPh: "Search the docs…", browse: "Browse docs",
    appPage: "App page:", comingSoon: "Documentation for this area is coming soon.",
    hubEye: "Support center", hubTitle: "ClavaMetrics documentation",
    hubIntro: "What every page of the platform does, how it fits your performance week, and the domain concepts behind it — written for the technical staff.",
    hubSearchPh: "Search the docs — try “ACWR”, “microcycle”, “GPS”…",
    footBrand: "The performance OS for clubs and federations. Every sport, every category, one workspace.",
    footProduct: "Product", footFeatures: "Features", footDocs: "Support", footSupportCenter: "Support center",
    footGlossary: "Glossary", footCompany: "Company", footContact: "Contact",
    footCopy: "© ClavaMetrics, Inc. · Performance OS for sport",
  },
  es: {
    htmlLang: "es", titleSuffix: "Soporte ClavaMetrics",
    navProduct: "Producto", navHow: "Cómo funciona", navPricing: "Precios", navSupport: "Soporte",
    navSignin: "Iniciar sesión", navStart: "Empezar gratis",
    bcRoot: "Soporte", toc: "En esta página", searchPh: "Buscar en la documentación…", browse: "Ver documentación",
    appPage: "Página de la app:", comingSoon: "La documentación de esta área está en camino.",
    hubEye: "Centro de soporte", hubTitle: "Documentación de ClavaMetrics",
    hubIntro: "Qué hace cada página de la plataforma, cómo encaja en tu semana de rendimiento y los conceptos de dominio detrás — escrito para el cuerpo técnico.",
    hubSearchPh: "Buscá en la documentación — probá “ACWR”, “microciclo”, “GPS”…",
    footBrand: "El sistema operativo del rendimiento para clubes y federaciones. Cada deporte, cada categoría, un solo espacio.",
    footProduct: "Producto", footFeatures: "Funciones", footDocs: "Soporte", footSupportCenter: "Centro de soporte",
    footGlossary: "Glosario", footCompany: "Empresa", footContact: "Contacto",
    footCopy: "© ClavaMetrics, Inc. · El sistema operativo del rendimiento deportivo",
  },
  pt: {
    htmlLang: "pt", titleSuffix: "Suporte ClavaMetrics",
    navProduct: "Produto", navHow: "Como funciona", navPricing: "Preços", navSupport: "Suporte",
    navSignin: "Entrar", navStart: "Começar grátis",
    bcRoot: "Suporte", toc: "Nesta página", searchPh: "Buscar na documentação…", browse: "Ver documentação",
    appPage: "Página do app:", comingSoon: "A documentação desta área está a caminho.",
    hubEye: "Central de suporte", hubTitle: "Documentação da ClavaMetrics",
    hubIntro: "O que cada página da plataforma faz, como se encaixa na sua semana de performance e os conceitos por trás — escrito para a comissão técnica.",
    hubSearchPh: "Busque na documentação — tente “ACWR”, “microciclo”, “GPS”…",
    footBrand: "O sistema operacional da performance para clubes e federações. Cada esporte, cada categoria, um só espaço.",
    footProduct: "Produto", footFeatures: "Recursos", footDocs: "Suporte", footSupportCenter: "Central de suporte",
    footGlossary: "Glossário", footCompany: "Empresa", footContact: "Contato",
    footCopy: "© ClavaMetrics, Inc. · O sistema operacional da performance esportiva",
  },
};

/* ─────────────────────────── Load inputs ─────────────────────────── */
const idx = JSON.parse(readFileSync(join(SITE, "docs-index.json"), "utf8"));
const worlds = idx.worlds;
const worldById = Object.fromEntries(worlds.map((w) => [w.id, w]));
const wTitle = (w, lang) => (w.i18n && w.i18n[lang] && w.i18n[lang].title) || w.title;
const wSummary = (w, lang) => (w.i18n && w.i18n[lang] && w.i18n[lang].summary) || w.summary;

const CONTENT = join(SITE, "content");
const LANGS = readdirSync(CONTENT, { withFileTypes: true })
  .filter((d) => d.isDirectory()).map((d) => d.name).filter((l) => UI[l])
  .sort((a, b) => (a === "en" ? -1 : b === "en" ? 1 : a.localeCompare(b)));

const pageTpl = readFileSync(join(TPL, "page.html"), "utf8");
const indexTpl = readFileSync(join(TPL, "index.html"), "utf8");
const SITE_URL = "https://clavametrics.vercel.app";

function fill(tpl, map) {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in map ? map[k] : ""));
}
// Rewrite intra-support links into the language subtree (en stays at /support).
function localize(html, lang) {
  if (lang === "en") return html;
  return html
    .replace(/href="\/support\/([a-z0-9-]+)"/g, 'href="/support/' + lang + '/$1"')
    .replace(/href="\/support"/g, 'href="/support/' + lang + '"');
}

/* ─────────────────────────── Emit (per language) ─────────────────────────── */
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
copyFileSync(join(TPL, "docs.css"), join(OUT, "docs.css")); // shared, referenced absolutely
copyFileSync(join(TPL, "docs.js"), join(OUT, "docs.js"));

const helpMap = {};
const summary = [];

for (const lang of LANGS) {
  const ui = UI[lang];
  const base = lang === "en" ? "/support" : "/support/" + lang;
  const outDir = lang === "en" ? OUT : join(OUT, lang);
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  const files = readdirSync(join(CONTENT, lang)).filter((f) => f.endsWith(".md"));
  const pages = files.map((f) => {
    const { data, body } = parseFrontmatter(readFileSync(join(CONTENT, lang, f), "utf8"));
    if (!data.slug) throw new Error(`Missing slug in ${lang}/${f}`);
    if (!worldById[data.world]) throw new Error(`Unknown world "${data.world}" in ${lang}/${f}`);
    return { file: f, title: data.title || data.slug, slug: data.slug, world: data.world,
      app_page: data.app_page || "", order: Number(data.order || 999), summary: data.summary || "", ...renderMarkdown(body) };
  });

  const pagesByWorld = {};
  for (const w of worlds) pagesByWorld[w.id] = pages.filter((p) => p.world === w.id).sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));

  const langSwitch = (slug) => '<div class="dx-lang" role="group" aria-label="Language">' +
    LANGS.map((l) => {
      const href = (l === "en" ? "/support" : "/support/" + l) + (slug ? "/" + slug : "");
      return '<a class="dx-lang-opt' + (l === lang ? " is-on" : "") + '" href="' + href + '" lang="' + l + '">' + l.toUpperCase() + "</a>";
    }).join("") + "</div>";

  const sidebar = (activeSlug) => worlds.map((w) => {
    const items = pagesByWorld[w.id]; if (!items.length) return "";
    return '<div class="dx-side-world"><h4><i class="ti ' + w.icon + '"></i>' + escapeHtml(wTitle(w, lang)) + "</h4>" +
      items.map((p) => '<a href="' + base + "/" + p.slug + '"' + (p.slug === activeSlug ? ' class="is-active"' : "") + ">" + escapeHtml(p.title) + "</a>").join("") + "</div>";
  }).join("\n");

  for (const p of pages) {
    const toc = p.headings.map((h) => '<a href="#' + h.id + '">' + escapeHtml(h.text) + "</a>").join("");
    const appPage = p.app_page ? '<span class="dx-apppage"><i class="ti ti-app-window"></i>' + ui.appPage + " " + escapeHtml(p.app_page) + "</span>" : "";
    const html = fill(pageTpl, {
      HTML_LANG: ui.htmlLang, TITLE: escapeHtml(p.title), TITLE_SUFFIX: ui.titleSuffix, SLUG: p.slug,
      CANON: SITE_URL + base + "/" + p.slug, META_DESC: escapeHtml(p.summary), SUMMARY: escapeHtml(p.summary),
      WORLD: p.world, WORLD_TITLE: escapeHtml(wTitle(worldById[p.world], lang)), APP_PAGE: appPage,
      ARTICLE: localize(p.html, lang), TOC: toc || '<a href="#">—</a>', SIDEBAR: sidebar(p.slug), LANG_SWITCH: langSwitch(p.slug),
      NAV_PRODUCT: ui.navProduct, NAV_HOW: ui.navHow, NAV_PRICING: ui.navPricing, NAV_SUPPORT: ui.navSupport,
      NAV_SIGNIN: ui.navSignin, NAV_START: ui.navStart, BASE: base, BC_ROOT: ui.bcRoot, TOC_TITLE: ui.toc,
      SEARCH_PH: ui.searchPh, BROWSE: ui.browse, FOOT_BRAND: ui.footBrand, FOOT_PRODUCT: ui.footProduct,
      FOOT_FEATURES: ui.footFeatures, FOOT_DOCS: ui.footDocs, FOOT_SUPPORT_CENTER: ui.footSupportCenter,
      FOOT_GLOSSARY: ui.footGlossary, FOOT_COMPANY: ui.footCompany, FOOT_CONTACT: ui.footContact, FOOT_COPY: ui.footCopy,
    });
    writeFileSync(join(outDir, p.slug + ".html"), html);
    if (lang === "en" && p.app_page) helpMap[p.app_page] = p.slug;
  }

  const worldsHtml = worlds.map((w) => {
    const items = pagesByWorld[w.id];
    const cards = items.length
      ? '<div class="dx-card-grid">' + items.map((p) => '<a class="dx-card" href="' + base + "/" + p.slug + '"><h3>' + escapeHtml(p.title) + '<i class="ti ti-arrow-right"></i></h3><p>' + escapeHtml(p.summary) + "</p></a>").join("") + "</div>"
      : '<div class="dx-card-grid"><p class="dx-hub-empty">' + ui.comingSoon + "</p></div>";
    return '<section class="dx-hub-world" id="' + w.id + '"><div class="dx-hub-world-head"><span class="ic"><i class="ti ' + w.icon + '"></i></span><div><h2>' + escapeHtml(wTitle(w, lang)) + "</h2><p>" + escapeHtml(wSummary(w, lang)) + "</p></div></div>" + cards + "</section>";
  }).join("\n");

  writeFileSync(join(outDir, "index.html"), fill(indexTpl, {
    HTML_LANG: ui.htmlLang, TITLE_SUFFIX: ui.titleSuffix, CANON: SITE_URL + base, HUB_EYE: ui.hubEye,
    HUB_TITLE: ui.hubTitle, HUB_INTRO: escapeHtml(ui.hubIntro), HUB_SEARCH_PH: ui.hubSearchPh, WORLDS: worldsHtml,
    LANG_SWITCH: langSwitch(""), NAV_PRODUCT: ui.navProduct, NAV_HOW: ui.navHow, NAV_PRICING: ui.navPricing,
    NAV_SUPPORT: ui.navSupport, NAV_SIGNIN: ui.navSignin, NAV_START: ui.navStart, BASE: base,
    FOOT_BRAND: ui.footBrand, FOOT_PRODUCT: ui.footProduct, FOOT_FEATURES: ui.footFeatures, FOOT_DOCS: ui.footDocs,
    FOOT_SUPPORT_CENTER: ui.footSupportCenter, FOOT_GLOSSARY: ui.footGlossary, FOOT_COMPANY: ui.footCompany,
    FOOT_CONTACT: ui.footContact, FOOT_COPY: ui.footCopy,
  }));

  const searchIndex = pages.map((p) => ({ slug: p.slug, title: p.title, world: p.world,
    worldTitle: wTitle(worldById[p.world], lang), headings: p.headings.map((h) => h.text), text: p.text.slice(0, 1200) }));
  writeFileSync(join(outDir, "search-index.json"), JSON.stringify(searchIndex));
  summary.push({ lang, n: pages.length });
}

writeFileSync(join(OUT, "help-map.json"), JSON.stringify(helpMap, null, 2) + "\n");

/* ─────────────────────────── Summary ─────────────────────────── */
console.log("ClavaMetrics support center generated\n");
for (const s of summary) console.log("  " + (s.lang === "en" ? "/support" : "/support/" + s.lang).padEnd(14) + s.n + " pages + hub + search-index.json");
console.log("  /support/help-map.json  " + Object.keys(helpMap).length + " app pages");
console.log("  docs.css, docs.js       copied\n");
console.log("Done.");
