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
      const txt = h[2].trim();
      const id = slugifyHeading(txt);
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
    .replace(/[#>*`_|-]/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

  return { html: out.join("\n"), headings, text };
}

/* ─────────────────────────── Load inputs ─────────────────────────── */
const idx = JSON.parse(readFileSync(join(SITE, "docs-index.json"), "utf8"));
const worlds = idx.worlds;
const worldById = Object.fromEntries(worlds.map((w) => [w.id, w]));

const contentDir = join(SITE, "content", LANG);
const files = readdirSync(contentDir).filter((f) => f.endsWith(".md"));

const pages = files.map((f) => {
  const raw = readFileSync(join(contentDir, f), "utf8");
  const { data, body } = parseFrontmatter(raw);
  const rendered = renderMarkdown(body);
  if (!data.slug) throw new Error(`Missing slug in frontmatter of ${f}`);
  if (!worldById[data.world]) throw new Error(`Unknown world "${data.world}" in ${f} (see docs-index.json)`);
  return {
    file: f,
    title: data.title || data.slug,
    slug: data.slug,
    world: data.world,
    worldTitle: worldById[data.world].title,
    app_page: data.app_page || "",
    order: Number(data.order || 999),
    summary: data.summary || "",
    ...rendered,
  };
});

// Group by world, ordered.
const pagesByWorld = {};
for (const w of worlds) {
  pagesByWorld[w.id] = pages
    .filter((p) => p.world === w.id)
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
}

/* ─────────────────────────── Shared fragments ─────────────────────────── */
function buildSidebar(activeSlug) {
  return worlds
    .map((w) => {
      const items = pagesByWorld[w.id];
      if (!items.length) return "";
      return (
        '<div class="dx-side-world">' +
        '<h4><i class="ti ' + w.icon + '"></i>' + w.title + "</h4>" +
        items
          .map(
            (p) =>
              '<a href="/support/' + p.slug + '"' +
              (p.slug === activeSlug ? ' class="is-active"' : "") +
              ">" + p.title + "</a>"
          )
          .join("") +
        "</div>"
      );
    })
    .join("\n");
}

function fill(tpl, map) {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in map ? map[k] : ""));
}

/* ─────────────────────────── Emit ─────────────────────────── */
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const pageTpl = readFileSync(join(TPL, "page.html"), "utf8");
const indexTpl = readFileSync(join(TPL, "index.html"), "utf8");

// Copy static assets (single source of truth in docs-site/templates/).
copyFileSync(join(TPL, "docs.css"), join(OUT, "docs.css"));
copyFileSync(join(TPL, "docs.js"), join(OUT, "docs.js"));

// Per-page HTML.
for (const p of pages) {
  const toc = p.headings.map((h) => '<a href="#' + h.id + '">' + h.text + "</a>").join("");
  const appPage = p.app_page
    ? '<span class="dx-apppage"><i class="ti ti-app-window"></i>App page: ' + escapeHtml(p.app_page) + "</span>"
    : "";
  const html = fill(pageTpl, {
    TITLE: escapeHtml(p.title),
    SLUG: p.slug,
    META_DESC: escapeHtml(p.summary),
    SUMMARY: escapeHtml(p.summary),
    WORLD: p.world,
    WORLD_TITLE: escapeHtml(p.worldTitle),
    APP_PAGE: appPage,
    ARTICLE: p.html,
    TOC: toc || '<a href="#">—</a>',
    SIDEBAR: buildSidebar(p.slug),
  });
  writeFileSync(join(OUT, p.slug + ".html"), html);
}

// Hub.
const worldsHtml = worlds
  .map((w) => {
    const items = pagesByWorld[w.id];
    const cards = items.length
      ? '<div class="dx-card-grid">' +
        items
          .map(
            (p) =>
              '<a class="dx-card" href="/support/' + p.slug + '">' +
              "<h3>" + escapeHtml(p.title) + '<i class="ti ti-arrow-right"></i></h3>' +
              "<p>" + escapeHtml(p.summary) + "</p></a>"
          )
          .join("") +
        "</div>"
      : '<div class="dx-card-grid"><p class="dx-hub-empty">Documentation for this area is coming soon.</p></div>';
    return (
      '<section class="dx-hub-world" id="' + w.id + '">' +
      '<div class="dx-hub-world-head">' +
      '<span class="ic"><i class="ti ' + w.icon + '"></i></span>' +
      "<div><h2>" + w.title + "</h2><p>" + escapeHtml(w.summary) + "</p></div></div>" +
      cards +
      "</section>"
    );
  })
  .join("\n");

writeFileSync(join(OUT, "index.html"), fill(indexTpl, { WORLDS: worldsHtml }));

// Search index.
const searchIndex = pages.map((p) => ({
  slug: p.slug,
  title: p.title,
  world: p.world,
  worldTitle: p.worldTitle,
  headings: p.headings.map((h) => h.text),
  text: p.text.slice(0, 1200),
}));
writeFileSync(join(OUT, "search-index.json"), JSON.stringify(searchIndex));

/* ─────────────────────────── Summary ─────────────────────────── */
console.log("ClavaMetrics support center generated →  /support\n");
console.log("  index.html            hub (" + pages.length + " pages, " + worlds.length + " worlds)");
for (const w of worlds) {
  const items = pagesByWorld[w.id];
  if (!items.length) continue;
  console.log("  · " + w.title);
  for (const p of items) console.log("      " + (p.slug + ".html").padEnd(24) + " ← " + p.file);
}
console.log("  search-index.json     " + searchIndex.length + " entries");
console.log("  docs.css, docs.js     copied\n");
console.log("Done.");
