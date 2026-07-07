// One-shot: extract DICT / ROTATOR / HOW from the legacy i18n.js into
// per-locale JSON files under /locales. Lossless. Run once, then delete.
import fs from "node:fs";
import vm from "node:vm";

const LANGS = ["en", "es", "pt"];
let src = fs.readFileSync("i18n.js", "utf8");

// Inject a dump right after all three literals are defined (before detect()).
src = src.replace("function detect() {",
  "globalThis.__CM_DUMP = { DICT: DICT, ROTATOR: ROTATOR, HOW: HOW };\n  function detect() {");

// Minimal DOM/browser stubs so the IIFE's init() runs without throwing.
const noopEl = { setAttribute(){}, getAttribute(){return null;}, appendChild(){}, addEventListener(){}, classList:{toggle(){},remove(){},add(){}}, style:{}, innerHTML:"", textContent:"", getBoundingClientRect(){return{bottom:0,right:0};} };
const doc = {
  documentElement: noopEl, head: noopEl, body: noopEl,
  readyState: "complete",
  getElementById(){return null;}, querySelector(){return null;},
  querySelectorAll(){return [];}, createElement(){return noopEl;},
  addEventListener(){}, dispatchEvent(){},
};
const sandbox = {
  document: doc,
  navigator: { language: "en", languages: ["en"] },
  localStorage: { getItem(){return null;}, setItem(){} },
  window: {}, CustomEvent: function(){}, console,
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(src, sandbox);

const { DICT, ROTATOR, HOW } = sandbox.__CM_DUMP;

// Flat dotted keys (matches the legacy DICT shape; avoids leaf/parent collisions)
const out = Object.fromEntries(LANGS.map(l => [l, {}]));
for (const [key, entry] of Object.entries(DICT))
  for (const l of LANGS)
    out[l][key] = entry[l] != null ? entry[l] : entry.en;
for (const l of LANGS) {
  out[l]["_rotator"] = ROTATOR[l] || ROTATOR.en;
  out[l]["_how"] = HOW[l] || HOW.en;
}
for (const l of LANGS)
  fs.writeFileSync(`locales/${l}.json`, JSON.stringify(out[l], null, 2) + "\n");

console.log(`Migrated ${Object.keys(DICT).length} marketing keys + rotator + how -> locales/{${LANGS.join(",")}}.json`);
