#!/usr/bin/env python3
"""
i18n para Pricing.html. Corré desde la raíz del repo (requiere i18n.js en el root):
    python3 apply_i18n_pricing.py
Tambien arregla el link muerto Product.html -> Home.html#modules.
Hace Pricing.html.bak y avisa si algún texto no se encontró.
"""
import os, shutil, sys
PATH = "Pricing.html"
if not os.path.exists(PATH):
    print("No encuentro Pricing.html. Corré el script en la raíz del repo."); sys.exit(1)
src = open(PATH, encoding="utf-8").read()
if 'data-i18n="pr.eyebrow"' in src:
    print("AVISO: Pricing ya está tageado. Aborto para no duplicar."); sys.exit(1)

R = [
    # NAV (+ fix Product.html dead link)
    ('<a href="Product.html">Product</a>', '<a href="Home.html#modules" data-i18n="nav.product">Product</a>'),
    ('<a href="Home.html#how">How it works</a>', '<a href="Home.html#how" data-i18n="nav.how">How it works</a>'),
    ('<a href="Pricing.html" class="is-active">Pricing</a>', '<a href="Pricing.html" class="is-active" data-i18n="nav.pricing">Pricing</a>'),
    ('<a href="Home.html#who">Customers</a>', '<a href="Home.html#who" data-i18n="nav.customers">Customers</a>'),
    ('<a href="#">Docs</a>', '<a href="#" data-i18n="foot.docs">Docs</a>'),
    ('<a class="signin" href="Login.html">Sign in</a>', '<a class="signin" href="Login.html" data-i18n="nav.signin">Sign in</a>'),
    ('Start free<i class="ti ti-arrow-right" style="font-size:14px"></i>',
     '<span data-i18n="nav.startfree">Start free</span><i class="ti ti-arrow-right" style="font-size:14px"></i>'),
    # HERO
    ('<span class="pr-eyebrow">Per-category pricing</span>', '<span class="pr-eyebrow" data-i18n="pr.eyebrow">Per-category pricing</span>'),
    ('<h1>Pay for the categories <em>you actually run.</em></h1>', '<h1 data-i18n-html="pr.h1">Pay for the categories <em>you actually run.</em></h1>'),
    ('<p>Mix tiers across senior, reserves, and youth — one workspace, one bill, and only what each squad needs. No per-athlete surprises.</p>',
     '<p data-i18n="pr.sub">Mix tiers across senior, reserves, and youth — one workspace, one bill, and only what each squad needs. No per-athlete surprises.</p>'),
    # TOGGLE
    ('<button class="is-on" data-billing="monthly">Monthly</button>', '<button class="is-on" data-billing="monthly" data-i18n="pr.monthly">Monthly</button>'),
    ('<button data-billing="annual">Annual <span class="save">−16%</span></button>',
     '<button data-billing="annual"><span data-i18n="pr.annual">Annual</span> <span class="save">−16%</span></button>'),
    # TIER tags
    ('<p class="pr-tier-tag">For grassroots and youth categories getting started.</p>', '<p class="pr-tier-tag" data-i18n="pr.tier1.tag">For grassroots and youth categories getting started.</p>'),
    ('<p class="pr-tier-tag">For developing categories with real planning needs.</p>', '<p class="pr-tier-tag" data-i18n="pr.tier2.tag">For developing categories with real planning needs.</p>'),
    ('<p class="pr-tier-tag">For senior &amp; pre-pro teams running full performance ops.</p>', '<p class="pr-tier-tag" data-i18n="pr.tier3.tag">For senior &amp; pre-pro teams running full performance ops.</p>'),
    ('<p class="pr-tier-tag">For elite squads with unlimited rosters and reporting.</p>', '<p class="pr-tier-tag" data-i18n="pr.tier4.tag">For elite squads with unlimited rosters and reporting.</p>'),
    # TIER per (x4)
    ('<span class="per">/ category / mo</span>', '<span class="per" data-i18n="pr.per">/ category / mo</span>'),
    # TIER meta
    ('<div class="pr-tier-meta">Up to 15 athletes · manual data only</div>', '<div class="pr-tier-meta" data-i18n="pr.tier1.meta">Up to 15 athletes · manual data only</div>'),
    ('<div class="pr-tier-meta">Up to 30 athletes · CSV imports</div>', '<div class="pr-tier-meta" data-i18n="pr.tier2.meta">Up to 30 athletes · CSV imports</div>'),
    ('<div class="pr-tier-meta">Up to 75 athletes · native GPS integrations</div>', '<div class="pr-tier-meta" data-i18n="pr.tier3.meta">Up to 75 athletes · native GPS integrations</div>'),
    ('<div class="pr-tier-meta">Unlimited athletes · everything included</div>', '<div class="pr-tier-meta" data-i18n="pr.tier4.meta">Unlimited athletes · everything included</div>'),
    # TIER CTAs (span-wrap)
    ('>Get started free</a>', '><span data-i18n="pr.cta.free">Get started free</span></a>'),
    ('>Start 14-day trial</a>', '><span data-i18n="pr.cta.trial">Start 14-day trial</span></a>'),
    ('<span class="pr-tier-badge">Most popular</span>', '<span class="pr-tier-badge" data-i18n="pr.badge">Most popular</span>'),
    # TIER feature spans (data-i18n-html for the ones with <strong>)
    ('<span>Roster &amp; availability</span>', '<span data-i18n-html="pr.f.roster">Roster &amp; availability</span>'),
    ('<span>Simple <strong>RPE</strong> form</span>', '<span data-i18n-html="pr.f.rpe">Simple <strong>RPE</strong> form</span>'),
    ('<span>Manual injuries log</span>', '<span data-i18n-html="pr.f.injlog">Manual injuries log</span>'),
    ('<span>Athlete mobile app</span>', '<span data-i18n-html="pr.f.app">Athlete mobile app</span>'),
    ('<span>No GPS / Catapult integration</span>', '<span data-i18n-html="pr.f.nogps">No GPS / Catapult integration</span>'),
    ('<span>Everything in <strong>Iniciación</strong></span>', '<span data-i18n-html="pr.f.alliniciacion">Everything in <strong>Iniciación</strong></span>'),
    ('<span>Microcycles &amp; daily planning</span>', '<span data-i18n-html="pr.f.micro">Microcycles &amp; daily planning</span>'),
    ('<span>Wellness + sleep tracking</span>', '<span data-i18n-html="pr.f.sleep">Wellness + sleep tracking</span>'),
    ('<span><strong>CSV</strong> GPS import</span>', '<span data-i18n-html="pr.f.csvimport"><strong>CSV</strong> GPS import</span>'),
    ('<span>Basic load monitoring</span>', '<span data-i18n-html="pr.f.basicload">Basic load monitoring</span>'),
    ('<span>Everything in <strong>Básico</strong></span>', '<span data-i18n-html="pr.f.allbasico">Everything in <strong>Básico</strong></span>'),
    ('<span><strong>Catapult</strong> + <strong>StatSports</strong> sync</span>', '<span data-i18n-html="pr.f.gpssync"><strong>Catapult</strong> + <strong>StatSports</strong> sync</span>'),
    ('<span>ACWR &amp; load alerts</span>', '<span data-i18n-html="pr.f.acwr">ACWR &amp; load alerts</span>'),
    ('<span>Match reports + GPS analysis</span>', '<span data-i18n-html="pr.f.matchgps">Match reports + GPS analysis</span>'),
    ('<span>Physio &amp; nutrition modules</span>', '<span data-i18n-html="pr.f.physionut">Physio &amp; nutrition modules</span>'),
    ('<span>Custom dashboards</span>', '<span data-i18n-html="pr.f.dashboards">Custom dashboards</span>'),
    ('<span>Everything in <strong>Profesional</strong></span>', '<span data-i18n-html="pr.f.allprofesional">Everything in <strong>Profesional</strong></span>'),
    ('<span>Unlimited athletes</span>', '<span data-i18n-html="pr.f.unlimited">Unlimited athletes</span>'),
    ('<span>Predictive injury models</span>', '<span data-i18n-html="pr.f.predictive">Predictive injury models</span>'),
    ('<span>Multi-staff seats (unlimited)</span>', '<span data-i18n-html="pr.f.seats">Multi-staff seats (unlimited)</span>'),
    ('<span>Priority support &amp; SLA</span>', '<span data-i18n-html="pr.f.sla">Priority support &amp; SLA</span>'),
    # MIX section
    ('<h3>Mix tiers across your categories.</h3>', '<h3 data-i18n="pr.mix.h3">Mix tiers across your categories.</h3>'),
    ('<p>You don\'t pay one fixed plan per club — each category picks its own tier. The Sub-14 stays free while the senior squad runs on Profesional. Your bill reflects exactly what each squad uses.</p>',
     '<p data-i18n="pr.mix.p">You don\'t pay one fixed plan per club — each category picks its own tier. The Sub-14 stays free while the senior squad runs on Profesional. Your bill reflects exactly what each squad uses.</p>'),
    # CALCULATOR
    ('<div class="cat">Senior</div>', '<div class="cat" data-i18n="pr.cat.senior">Senior</div>'),
    ('<div class="cat-sub">28 athletes · GPS · match analysis</div>', '<div class="cat-sub" data-i18n="pr.cat.senior.sub">28 athletes · GPS · match analysis</div>'),
    ('<div class="cat">Reserves</div>', '<div class="cat" data-i18n="pr.cat.reserves">Reserves</div>'),
    ('<div class="cat-sub">22 athletes · GPS · load monitoring</div>', '<div class="cat-sub" data-i18n="pr.cat.reserves.sub">22 athletes · GPS · load monitoring</div>'),
    ('<div class="cat-sub">24 athletes · CSV imports</div>', '<div class="cat-sub" data-i18n="pr.cat.sub17.sub">24 athletes · CSV imports</div>'),
    ('<div class="cat-sub">14 athletes · RPE + wellness</div>', '<div class="cat-sub" data-i18n="pr.cat.sub14.sub">14 athletes · RPE + wellness</div>'),
    ('<span class="lbl">Monthly total</span>', '<span class="lbl" data-i18n="pr.calc.total">Monthly total</span>'),
    ('<span class="vs">vs $600+ flat-rate competitors</span>', '<span class="vs" data-i18n="pr.calc.vs">vs $600+ flat-rate competitors</span>'),
    ('margin-left:4px">/ mo</span>', 'margin-left:4px" data-i18n="pr.permo">/ mo</span>'),
    # COMPARISON TABLE
    ('<h2>Compare features by tier</h2>', '<h2 data-i18n="pr.cmp.h2">Compare features by tier</h2>'),
    ('<p>Everything in ClavaMetrics, mapped against the four category tiers.</p>', '<p data-i18n="pr.cmp.sub">Everything in ClavaMetrics, mapped against the four category tiers.</p>'),
    ('<th>Feature</th>', '<th data-i18n="pr.cmp.feature">Feature</th>'),
    ('</i>Athletes per category</td>', '</i><span data-i18n="pr.cmp.athletes">Athletes per category</span></td>'),
    ('</i>Staff seats</td>', '</i><span data-i18n="pr.cmp.seats">Staff seats</span></td>'),
    ('</i>Microcycles &amp; daily planner</td>', '</i><span data-i18n="pr.cmp.micro">Microcycles &amp; daily planner</span></td>'),
    ('</i>Sessions library</td>', '</i><span data-i18n="pr.cmp.sessions">Sessions library</span></td>'),
    ('</i>Tactical planner canvas</td>', '</i><span data-i18n="pr.cmp.tactical">Tactical planner canvas</span></td>'),
    ('</i>RPE &amp; wellness</td>', '</i><span data-i18n="pr.cmp.rpe">RPE &amp; wellness</span></td>'),
    ('</i>ACWR &amp; load alerts</td>', '</i><span data-i18n="pr.cmp.acwr">ACWR &amp; load alerts</span></td>'),
    ('</i>Predictive injury models</td>', '</i><span data-i18n="pr.cmp.predictive">Predictive injury models</span></td>'),
    ('</i>CSV imports</td>', '</i><span data-i18n="pr.cmp.csv">CSV imports</span></td>'),
    ('</i>Catapult / StatSports sync</td>', '</i><span data-i18n="pr.cmp.sync">Catapult / StatSports sync</span></td>'),
    ('</i>Support</td>', '</i><span data-i18n="pr.cmp.support">Support</span></td>'),
    ('<td class="center mono">Unlimited</td>', '<td class="center mono" data-i18n="pr.cmp.unlimited">Unlimited</td>'),
    ('<span class="mono">Basic</span>', '<span class="mono" data-i18n="pr.cmp.basic">Basic</span>'),
    ('<span class="mono">Community</span>', '<span class="mono" data-i18n="pr.cmp.community">Community</span>'),
    ('<span class="mono">Email</span>', '<span class="mono" data-i18n="pr.cmp.email">Email</span>'),
    ('<span class="mono">Priority email</span>', '<span class="mono" data-i18n="pr.cmp.prioemail">Priority email</span>'),
    # ENTERPRISE
    ('<span class="pr-ent-eyebrow">Enterprise &amp; federations</span>', '<span class="pr-ent-eyebrow" data-i18n="pr.ent.eyebrow">Enterprise &amp; federations</span>'),
    ('<h3>Running <em>10+ categories</em> or a national federation?</h3>', '<h3 data-i18n-html="pr.ent.h3">Running <em>10+ categories</em> or a national federation?</h3>'),
    ('<p>Custom contracts for clubs and federations with multi-tenant needs, on-prem data residency, SSO/SAML, and dedicated onboarding. Volume pricing applies after 10 paid categories.</p>',
     '<p data-i18n="pr.ent.p">Custom contracts for clubs and federations with multi-tenant needs, on-prem data residency, SSO/SAML, and dedicated onboarding. Volume pricing applies after 10 paid categories.</p>'),
    ('<span><i class="ti ti-database"></i>EU &amp; LATAM regions</span>', '<span><i class="ti ti-database"></i><span data-i18n="pr.ent.regions">EU &amp; LATAM regions</span></span>'),
    ('<span><i class="ti ti-api"></i>API access</span>', '<span><i class="ti ti-api"></i><span data-i18n="pr.ent.api">API access</span></span>'),
    ('<span><i class="ti ti-user-shield"></i>Custom DPA</span>', '<span><i class="ti ti-user-shield"></i><span data-i18n="pr.ent.dpa">Custom DPA</span></span>'),
    ('<label>Work email</label>', '<label data-i18n="ct.lbl.email">Work email</label>'),
    ('<label>Organization</label>', '<label data-i18n="pr.ent.org">Organization</label>'),
    ('<label>Categories</label>', '<label data-i18n="pr.ent.cats">Categories</label>'),
    ('type="text" required placeholder="Club name or federation"', 'type="text" required data-i18n-ph="pr.ent.ph.org" placeholder="Club name or federation"'),
    ('<option>10–20 categories</option>', '<option data-i18n="pr.ent.opt1">10–20 categories</option>'),
    ('<option>20–50 categories</option>', '<option data-i18n="pr.ent.opt2">20–50 categories</option>'),
    ('<option>50+ categories</option>', '<option data-i18n="pr.ent.opt3">50+ categories</option>'),
    ('<option>National federation</option>', '<option data-i18n="pr.ent.opt4">National federation</option>'),
    ('Talk to sales<i class="ti ti-arrow-right"></i>', '<span data-i18n="pr.ent.talk">Talk to sales</span><i class="ti ti-arrow-right"></i>'),
    ('<div class="pr-ent-form-meta">Avg. response · under 24h</div>', '<div class="pr-ent-form-meta" data-i18n="pr.ent.meta">Avg. response · under 24h</div>'),
    # FAQ
    ('<h2>Frequently asked</h2>', '<h2 data-i18n="sec.faq.h2">Frequently asked</h2>'),
    ('<summary>How does per-category pricing actually work? <i class="ti ti-plus"></i></summary>',
     '<summary><span data-i18n="pr.faq.q1">How does per-category pricing actually work?</span> <i class="ti ti-plus"></i></summary>'),
    ('<p class="ans">You register one club workspace, then assign a tier to each category from the Admin panel. The Sub-14 can stay on Iniciación (free) while the senior squad runs on Profesional. You only pay for the categories that need paid features, billed monthly or annually as one consolidated invoice.</p>',
     '<p class="ans" data-i18n="pr.faq.a1">You register one club workspace, then assign a tier to each category from the Admin panel. The Sub-14 can stay on Iniciación (free) while the senior squad runs on Profesional. You only pay for the categories that need paid features, billed monthly or annually as one consolidated invoice.</p>'),
    ('<summary>Can I change a category\'s tier mid-month? <i class="ti ti-plus"></i></summary>',
     '<summary><span data-i18n="pr.faq.q2">Can I change a category\'s tier mid-month?</span> <i class="ti ti-plus"></i></summary>'),
    ('<p class="ans">Yes. Upgrades take effect immediately and are prorated to the day. Downgrades take effect at the end of the current billing period — no data is lost, the affected features simply become read-only until you re-upgrade.</p>',
     '<p class="ans" data-i18n="pr.faq.a2">Yes. Upgrades take effect immediately and are prorated to the day. Downgrades take effect at the end of the current billing period — no data is lost, the affected features simply become read-only until you re-upgrade.</p>'),
    ('<summary>Do you offer a free trial? <i class="ti ti-plus"></i></summary>',
     '<summary><span data-i18n="pr.faq.q3">Do you offer a free trial?</span> <i class="ti ti-plus"></i></summary>'),
    ('<p class="ans">Every paid tier comes with a 14-day trial, no card required. The Iniciación tier is free forever for categories under 15 athletes.</p>',
     '<p class="ans" data-i18n="pr.faq.a3">Every paid tier comes with a 14-day trial, no card required. The Iniciación tier is free forever for categories under 15 athletes.</p>'),
    ('<summary>What happens to my data if I cancel? <i class="ti ti-plus"></i></summary>',
     '<summary><span data-i18n="pr.faq.q4">What happens to my data if I cancel?</span> <i class="ti ti-plus"></i></summary>'),
    ('<p class="ans">Your data stays available for 90 days in read-only mode after cancellation. You can export anything (CSV, JSON, full backup) at any time from the Admin panel. After 90 days the workspace is permanently deleted.</p>',
     '<p class="ans" data-i18n="pr.faq.a4">Your data stays available for 90 days in read-only mode after cancellation. You can export anything (CSV, JSON, full backup) at any time from the Admin panel. After 90 days the workspace is permanently deleted.</p>'),
    ('<summary>Do I need separate accounts for Catapult or StatSports? <i class="ti ti-plus"></i></summary>',
     '<summary><span data-i18n="pr.faq.q5">Do I need separate accounts for Catapult or StatSports?</span> <i class="ti ti-plus"></i></summary>'),
    ('<p class="ans">No — ClavaMetrics connects to your existing Catapult or StatSports account via OAuth on Profesional and Full tiers. We sync sessions automatically; no CSV exports needed.</p>',
     '<p class="ans" data-i18n="pr.faq.a5">No — ClavaMetrics connects to your existing Catapult or StatSports account via OAuth on Profesional and Full tiers. We sync sessions automatically; no CSV exports needed.</p>'),
    ('<summary>How is billing handled? <i class="ti ti-plus"></i></summary>',
     '<summary><span data-i18n="pr.faq.q6">How is billing handled?</span> <i class="ti ti-plus"></i></summary>'),
    ('<p class="ans">One consolidated invoice per club, monthly or annual. We accept credit card, ACH (US), SEPA (EU) and bank transfer for annual contracts over $5K. All invoices are available in the Billing dashboard.</p>',
     '<p class="ans" data-i18n="pr.faq.a6">One consolidated invoice per club, monthly or annual. We accept credit card, ACH (US), SEPA (EU) and bank transfer for annual contracts over $5K. All invoices are available in the Billing dashboard.</p>'),
    # FOOTER (pr-foot)
    ('<span>© ClavaMetrics, Inc. · Performance OS for sport</span>', '<span data-i18n="foot.copy">© ClavaMetrics, Inc. · Performance OS for sport</span>'),
    ('<a href="#">Privacy</a>', '<a href="#" data-i18n="foot.privacy">Privacy</a>'),
    ('<a href="#">Terms</a>', '<a href="#" data-i18n="foot.terms">Terms</a>'),
    ('<a href="#">DPA</a>', '<a href="#" data-i18n="foot.dpa">DPA</a>'),
    ('<a href="#">Status</a>', '<a href="#" data-i18n="foot.status">Status</a>'),
]

shutil.copy(PATH, PATH + ".bak")
missing = []
for old, new in R:
    if old not in src:
        missing.append(old[:80])
    src = src.replace(old, new)
if 'i18n.js' not in src:
    src = src.replace('</body>', '<script src="i18n.js"></script>\n</body>')
open(PATH, "w", encoding="utf-8").write(src)
print("OK. Backup en Pricing.html.bak")
print("data-i18n insertados:", src.count('data-i18n="') + src.count('data-i18n-html="') + src.count('data-i18n-ph="'))
print("Product.html dead link arreglado:", 'href="Product.html"' not in src)
print("script i18n.js agregado:", 'i18n.js' in src)
if missing:
    print("\nTEXTOS NO ENCONTRADOS (pasámelos):")
    for m in missing: print("  -", m)
else:
    print("\nTodos los textos encontrados. Nada que hacer a mano.")
