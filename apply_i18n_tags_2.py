#!/usr/bin/env python3
"""
PASO 2 del i18n: tagea los cuerpos densos de Home.html (tarjetas de Modules y
Who-cards, labels de las tabs de How it works, FAQ y testimonios) y vuelve las
tabs de How it works conscientes del idioma (leen window.CM_I18N.how y se
re-renderizan al cambiar idioma).

Corré desde la raíz del repo, DESPUÉS de haber aplicado el Paso 1:

    python3 apply_i18n_tags_2.py

Requiere el i18n.js actualizado (con HOW + las claves densas) en el root.
Hace backup en Home.html.bak2 y avisa si algún texto no se encontró.
"""
import os, shutil, sys

PATH = "Home.html"
if not os.path.exists(PATH):
    print("No encuentro Home.html en este directorio. Corré el script en la raíz del repo.")
    sys.exit(1)

src = open(PATH, encoding="utf-8").read()

if 'data-i18n="mod.planner.t"' in src:
    print("AVISO: el Paso 2 ya está aplicado (encuentro mod.planner.t). Aborto para no duplicar.")
    sys.exit(1)

if 'data-i18n="nav.product"' not in src:
    print("OJO: no veo los tags del Paso 1. Corré primero apply_i18n_tags.py. Aborto.")
    sys.exit(1)

# ── Reemplazos de texto estático denso ──
R = [
    # Modules (h3 + p)
    ('<h3>Planner</h3>', '<h3 data-i18n="mod.planner.t">Planner</h3>'),
    ('<p>Build microcycles and daily sessions with drag-and-drop blocks, tagged by focus.</p>',
     '<p data-i18n="mod.planner.d">Build microcycles and daily sessions with drag-and-drop blocks, tagged by focus.</p>'),
    ('<h3>Load monitor</h3>', '<h3 data-i18n="mod.load.t">Load monitor</h3>'),
    ('<p>Acute:chronic workload ratios and alerts that flag spikes before they become injuries.</p>',
     '<p data-i18n="mod.load.d">Acute:chronic workload ratios and alerts that flag spikes before they become injuries.</p>'),
    ('<h3>Availability</h3>', '<h3 data-i18n="mod.avail.t">Availability</h3>'),
    ('<p>Daily presence, session minutes and status across the whole squad at a glance.</p>',
     '<p data-i18n="mod.avail.d">Daily presence, session minutes and status across the whole squad at a glance.</p>'),
    ('<h3>GPS analysis</h3>', '<h3 data-i18n="mod.gps.t">GPS analysis</h3>'),
    ('<p>Native Catapult &amp; StatSports sync — distance, sprints and high-speed running by session.</p>',
     '<p data-i18n="mod.gps.d">Native Catapult &amp; StatSports sync — distance, sprints and high-speed running by session.</p>'),
    ('<h3>Wellness &amp; RPE</h3>', '<h3 data-i18n="mod.wellness.t">Wellness &amp; RPE</h3>'),
    ('<p>Athlete check-ins for sleep, soreness and effort, plotted against planned load.</p>',
     '<p data-i18n="mod.wellness.d">Athlete check-ins for sleep, soreness and effort, plotted against planned load.</p>'),
    ('<h3>Physio &amp; rehab</h3>', '<h3 data-i18n="mod.physio.t">Physio &amp; rehab</h3>'),
    ('<p>Injury logs, rehab planners and return-to-play protocols shared with the medical staff.</p>',
     '<p data-i18n="mod.physio.d">Injury logs, rehab planners and return-to-play protocols shared with the medical staff.</p>'),
    ('<h3>Match reports</h3>', '<h3 data-i18n="mod.match.t">Match reports</h3>'),
    ('<p>Post-match minutes, ratings and GPS output rolled into one shareable report.</p>',
     '<p data-i18n="mod.match.d">Post-match minutes, ratings and GPS output rolled into one shareable report.</p>'),
    ('<h3>Nutrition</h3>', '<h3 data-i18n="mod.nutrition.t">Nutrition</h3>'),
    ('<p>Hydration, body composition and meal guidance tracked alongside training load.</p>',
     '<p data-i18n="mod.nutrition.d">Hydration, body composition and meal guidance tracked alongside training load.</p>'),

    # Who-cards (h3 + p)
    ('<h3>Football clubs</h3>', '<h3 data-i18n="who.football.t">Football clubs</h3>'),
    ('<p>Run senior, reserves and every youth category from one workspace — each with its own staff and plan.</p>',
     '<p data-i18n="who.football.d">Run senior, reserves and every youth category from one workspace — each with its own staff and plan.</p>'),
    ('<h3>Multisport academies</h3>', '<h3 data-i18n="who.multisport.t">Multisport academies</h3>'),
    ('<p>Basketball, volleyball, swimming, athletics and more — one performance language across every discipline.</p>',
     '<p data-i18n="who.multisport.d">Basketball, volleyball, swimming, athletics and more — one performance language across every discipline.</p>'),
    ('<h3>National federations</h3>', '<h3 data-i18n="who.federations.t">National federations</h3>'),
    ('<p>Centralize the performance data of every team and category, with multi-tenant access and data residency.</p>',
     '<p data-i18n="who.federations.d">Centralize the performance data of every team and category, with multi-tenant access and data residency.</p>'),
    ('<h3>Performance &amp; S&amp;C</h3>', '<h3 data-i18n="who.sc.t">Performance &amp; S&amp;C</h3>'),
    ('<p>Plan, prescribe and monitor load with the depth a strength &amp; conditioning team actually needs.</p>',
     '<p data-i18n="who.sc.d">Plan, prescribe and monitor load with the depth a strength &amp; conditioning team actually needs.</p>'),
    ('<h3>Medical &amp; rehab</h3>', '<h3 data-i18n="who.medical.t">Medical &amp; rehab</h3>'),
    ('<p>Track injuries, build rehab plans and manage return-to-play in sync with the training calendar.</p>',
     '<p data-i18n="who.medical.d">Track injuries, build rehab plans and manage return-to-play in sync with the training calendar.</p>'),
    ('<h3>Performance directors</h3>', '<h3 data-i18n="who.directors.t">Performance directors</h3>'),
    ('<p>One dashboard across every category to oversee availability, load and methodology club-wide.</p>',
     '<p data-i18n="who.directors.d">One dashboard across every category to oversee availability, load and methodology club-wide.</p>'),

    # How-it-works tab labels (icon precedes text -> wrap text in span)
    ('</i>Plan</button>', '</i><span data-i18n="how.tab.plan">Plan</span></button>'),
    ('</i>Monitor</button>', '</i><span data-i18n="how.tab.monitor">Monitor</span></button>'),
    ('</i>Analyze</button>', '</i><span data-i18n="how.tab.analyze">Analyze</span></button>'),
    ('</i>Decide</button>', '</i><span data-i18n="how.tab.decide">Decide</span></button>'),

    # Testimonials (intro + quotes + roles). Names stay.
    ('<p>Clubs of every size run their performance week on ClavaMetrics — the same tools scale from a single youth category to a full first team.</p>',
     '<p data-i18n="testi.intro">Clubs of every size run their performance week on ClavaMetrics — the same tools scale from a single youth category to a full first team.</p>'),
    ('<blockquote>"We were running four spreadsheets and a WhatsApp group. Now the whole Sub-17 staff plans, logs wellness and tracks load in one place — and it took us an afternoon to set up."</blockquote>',
     '<blockquote data-i18n="testi.q1">"We were running four spreadsheets and a WhatsApp group. Now the whole Sub-17 staff plans, logs wellness and tracks load in one place — and it took us an afternoon to set up."</blockquote>'),
    ('<span class="role">Fitness coach · Youth academy</span>', '<span class="role" data-i18n="testi.r1">Fitness coach · Youth academy</span>'),
    ('<blockquote>"The ACWR alerts paid for the platform in the first month. We caught two ramp-rate spikes before they turned into soft-tissue injuries — the medical and S&amp;C staff finally read from the same screen."</blockquote>',
     '<blockquote data-i18n="testi.q2">"The ACWR alerts paid for the platform in the first month. We caught two ramp-rate spikes before they turned into soft-tissue injuries — the medical and S&amp;C staff finally read from the same screen."</blockquote>'),
    ('<span class="role">Performance director · Pro club</span>', '<span class="role" data-i18n="testi.r2">Performance director · Pro club</span>'),
    ('<blockquote>"Rolling one methodology across every category used to be impossible. With ClavaMetrics our federation sees availability and load for all teams from one dashboard — without taking autonomy from each coach."</blockquote>',
     '<blockquote data-i18n="testi.q3">"Rolling one methodology across every category used to be impossible. With ClavaMetrics our federation sees availability and load for all teams from one dashboard — without taking autonomy from each coach."</blockquote>'),
    ('<span class="role">Head of methodology · Federation</span>', '<span class="role" data-i18n="testi.r3">Head of methodology · Federation</span>'),

    # FAQ (summary text span-wrapped, icon trails; answers)
    ('<summary>What exactly is ClavaMetrics? <i class="ti ti-plus"></i></summary>',
     '<summary><span data-i18n="faq.q1">What exactly is ClavaMetrics?</span> <i class="ti ti-plus"></i></summary>'),
    ('<p class="ans">A centralized performance platform for clubs and federations of every sport. Plan training, monitor load, track availability and analyze GPS — for every category, from one place, with one bill.</p>',
     '<p class="ans" data-i18n="faq.a1">A centralized performance platform for clubs and federations of every sport. Plan training, monitor load, track availability and analyze GPS — for every category, from one place, with one bill.</p>'),
    ('<summary>Does it work for sports other than football? <i class="ti ti-plus"></i></summary>',
     '<summary><span data-i18n="faq.q2">Does it work for sports other than football?</span> <i class="ti ti-plus"></i></summary>'),
    ('<p class="ans">Yes. The same planning, load and availability tools work for basketball, volleyball, swimming, athletics, rugby and more. Multisport academies run every discipline in one workspace.</p>',
     '<p class="ans" data-i18n="faq.a2">Yes. The same planning, load and availability tools work for basketball, volleyball, swimming, athletics, rugby and more. Multisport academies run every discipline in one workspace.</p>'),
    ('<summary>How do athletes receive their sessions? <i class="ti ti-plus"></i></summary>',
     '<summary><span data-i18n="faq.q3">How do athletes receive their sessions?</span> <i class="ti ti-plus"></i></summary>'),
    ('<p class="ans">Athletes get their plan, wellness check-ins and RPE forms on the mobile app. Staff build and analyze everything on the web platform — the two stay in sync automatically.</p>',
     '<p class="ans" data-i18n="faq.a3">Athletes get their plan, wellness check-ins and RPE forms on the mobile app. Staff build and analyze everything on the web platform — the two stay in sync automatically.</p>'),
    ('<summary>Do you integrate with Catapult or StatSports? <i class="ti ti-plus"></i></summary>',
     '<summary><span data-i18n="faq.q4">Do you integrate with Catapult or StatSports?</span> <i class="ti ti-plus"></i></summary>'),
    ('<p class="ans">On Profesional and Full tiers, ClavaMetrics connects to your existing Catapult or StatSports account and syncs sessions automatically — no CSV exports needed.</p>',
     '<p class="ans" data-i18n="faq.a4">On Profesional and Full tiers, ClavaMetrics connects to your existing Catapult or StatSports account and syncs sessions automatically — no CSV exports needed.</p>'),
    ('<summary>Is there a free plan? <i class="ti ti-plus"></i></summary>',
     '<summary><span data-i18n="faq.q5">Is there a free plan?</span> <i class="ti ti-plus"></i></summary>'),
    ('<p class="ans">The Iniciación tier is free forever for categories under 15 athletes. Every paid tier includes a 14-day trial with no card required.</p>',
     '<p class="ans" data-i18n="faq.a5">The Iniciación tier is free forever for categories under 15 athletes. Every paid tier includes a 14-day trial with no card required.</p>'),
]

# ── Reescritura del script de las tabs para que lean el idioma ──
HOW_OLD_DATA = 'const data = {'
HOW_NEW_DATA = 'const FALLBACK = {'

HANDLER_OLD = '''    tabs.forEach(t => t.addEventListener("click", () => {
      tabs.forEach(o => o.classList.remove("on"));
      t.classList.add("on");
      const k = t.dataset.tab, d = data[k];
      stepEl.textContent = d.step;
      titleEl.textContent = d.title;
      descEl.textContent = d.desc;
      listEl.innerHTML = d.list.map(x => '<li><i class="ti ti-check"></i>' + x + "</li>").join("");
      vis.forEach(v => v.hidden = (v.dataset.vis !== k));
    }));
  })();'''

HANDLER_NEW = '''    let activeTab = "plan";
    function howData() { return (window.CM_I18N && window.CM_I18N.how) || FALLBACK; }
    function renderHow() {
      const d = howData()[activeTab]; if (!d) return;
      if (stepEl) stepEl.textContent = d.step;
      if (titleEl) titleEl.textContent = d.title;
      if (descEl) descEl.textContent = d.desc;
      if (listEl) listEl.innerHTML = d.list.map(x => '<li><i class="ti ti-check"></i>' + x + "</li>").join("");
      vis.forEach(v => v.hidden = (v.dataset.vis !== activeTab));
    }
    window.__renderHow = renderHow;
    tabs.forEach(t => t.addEventListener("click", () => {
      tabs.forEach(o => o.classList.remove("on"));
      t.classList.add("on");
      activeTab = t.dataset.tab;
      renderHow();
    }));
    renderHow();
  })();'''

shutil.copy(PATH, PATH + ".bak2")

missing = []
for old, new in R:
    if old not in src:
        missing.append(old[:90])
    src = src.replace(old, new)

# Tabs script (only if not already rewritten)
how_ok = True
if 'window.__renderHow' not in src:
    if HOW_OLD_DATA in src and HANDLER_OLD in src:
        src = src.replace(HOW_OLD_DATA, HOW_NEW_DATA, 1)
        src = src.replace(HANDLER_OLD, HANDLER_NEW, 1)
    else:
        how_ok = False

open(PATH, "w", encoding="utf-8").write(src)

print("OK. Backup en Home.html.bak2")
print("data-i18n totales ahora:", src.count('data-i18n="'))
print("tabs i18n-aware (window.__renderHow):", 'window.__renderHow' in src)
if not how_ok:
    print("  OJO: no pude reescribir el script de tabs (tu agente lo cambió). Avisame.")
if missing:
    print("\nTEXTOS NO ENCONTRADOS (tu agente los cambió — pasámelos):")
    for m in missing:
        print("  -", m)
else:
    print("\nTodos los textos densos encontrados. Nada que hacer a mano.")
