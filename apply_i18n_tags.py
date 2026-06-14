#!/usr/bin/env python3
"""
Aplica los tags de i18n sobre TU Home.html local (en el directorio actual),
sin pisar otros cambios de tu agente. Corré desde la raíz del repo:

    python3 apply_i18n_tags.py

- Hace 60 reemplazos exactos (agrega data-i18n="...").
- Envuelve el texto de los botones con icono en <span> para no romper el <i>.
- Conecta el rotador del hero al i18n.
- Agrega <script src="i18n.js"></script> antes de </body>.
- Te avisa si algún texto NO se encontró (porque tu agente lo cambió),
  así sabés exactamente qué tag agregar a mano.

Hace backup en Home.html.bak antes de escribir.
"""
import os, shutil, sys

PATH = "Home.html"
if not os.path.exists(PATH):
    print("No encuentro Home.html en este directorio. Corré el script en la raíz del repo.")
    sys.exit(1)

src = open(PATH, encoding="utf-8").read()

R = [
    ('<a href="#modules">Product</a>', '<a href="#modules" data-i18n="nav.product">Product</a>'),
    ('<a href="#how">How it works</a>', '<a href="#how" data-i18n="nav.how">How it works</a>'),
    ('<a href="Pricing.html">Pricing</a>', '<a href="Pricing.html" data-i18n="nav.pricing">Pricing</a>'),
    ('<a href="#testimonials">Customers</a>', '<a href="#testimonials" data-i18n="nav.customers">Customers</a>'),
    ('<a class="signin" href="Login.html">Sign in</a>', '<a class="signin" href="Login.html" data-i18n="nav.signin">Sign in</a>'),
    ('<a href="Login.html">Sign in</a>', '<a href="Login.html" data-i18n="nav.signin">Sign in</a>'),
    ('Start free<i class="ti ti-arrow-right" style="font-size:14px"></i>',
     '<span data-i18n="nav.startfree">Start free</span><i class="ti ti-arrow-right" style="font-size:14px"></i>'),
    ('Start free<i class="ti ti-arrow-right" style="font-size:16px"></i>',
     '<span data-i18n="nav.startfree">Start free</span><i class="ti ti-arrow-right" style="font-size:16px"></i>'),
    ('<i class="ti ti-calendar-event" style="font-size:16px"></i>Book a demo',
     '<i class="ti ti-calendar-event" style="font-size:16px"></i><span data-i18n="hero.demo">Book a demo</span>'),
    ('<span class="mk-eyebrow hero-eyebrow">Performance OS for sport</span>',
     '<span class="mk-eyebrow hero-eyebrow" data-i18n="hero.eyebrow">Performance OS for sport</span>'),
    ('<h1>The performance OS for<br>',
     '<h1><span data-i18n="hero.h1pre">The performance OS for</span><br>'),
    ('<p class="sub">Plan microcycles, monitor load, track availability and analyze GPS — across every category, in one workspace. From the senior squad down to the Sub-14.</p>',
     '<p class="sub" data-i18n="hero.sub">Plan microcycles, monitor load, track availability and analyze GPS — across every category, in one workspace. From the senior squad down to the Sub-14.</p>'),
    ('<span>14 days free</span>', '<span data-i18n="hero.trust1">14 days free</span>'),
    ('<span>No credit card required</span>', '<span data-i18n="hero.trust2">No credit card required</span>'),
    ('<span>Cancel anytime</span>', '<span data-i18n="hero.trust3">Cancel anytime</span>'),
    ('<span class="mk-eyebrow is-plain">Modules</span>', '<span class="mk-eyebrow is-plain" data-i18n="sec.modules.eye">Modules</span>'),
    ('<span class="mk-eyebrow is-plain">The loop</span>', '<span class="mk-eyebrow is-plain" data-i18n="sec.loop.eye">The loop</span>'),
    ('<span class="mk-eyebrow is-plain">Watch</span>', '<span class="mk-eyebrow is-plain" data-i18n="sec.watch.eye">Watch</span>'),
    ("<span class=\"mk-eyebrow is-plain\">Who it's for</span>", "<span class=\"mk-eyebrow is-plain\" data-i18n=\"sec.who.eye\">Who it's for</span>"),
    ('<span class="mk-eyebrow is-plain">Anywhere</span>', '<span class="mk-eyebrow is-plain" data-i18n="sec.devices.eye">Anywhere</span>'),
    ('<span class="mk-eyebrow is-plain">Testimonials</span>', '<span class="mk-eyebrow is-plain" data-i18n="sec.testi.eye">Testimonials</span>'),
    ('<span class="mk-eyebrow is-plain">FAQ</span>', '<span class="mk-eyebrow is-plain" data-i18n="sec.faq.eye">FAQ</span>'),
    ('<h2>Everything performance staff needs</h2>', '<h2 data-i18n="sec.modules.h2">Everything performance staff needs</h2>'),
    ('<h2>From plan to decision, in one loop</h2>', '<h2 data-i18n="sec.loop.h2">From plan to decision, in one loop</h2>'),
    ('<h2>See the whole loop in 90 seconds</h2>', '<h2 data-i18n="sec.watch.h2">See the whole loop in 90 seconds</h2>'),
    ('<h2>Built for everyone in the building</h2>', '<h2 data-i18n="sec.who.h2">Built for everyone in the building</h2>'),
    ('<h2>Staff on desktop. Athletes on mobile.</h2>', '<h2 data-i18n="sec.devices.h2">Staff on desktop. Athletes on mobile.</h2>'),
    ('<h2>From grassroots to the first division</h2>', '<h2 data-i18n="sec.testi.h2">From grassroots to the first division</h2>'),
    ('<h2>Frequently asked</h2>', '<h2 data-i18n="sec.faq.h2">Frequently asked</h2>'),
    ('<span class="dev-tag"><i class="ti ti-device-desktop"></i>Web platform · Staff</span>',
     '<span class="dev-tag"><i class="ti ti-device-desktop"></i><span data-i18n="devices.staff.tag">Web platform · Staff</span></span>'),
    ('<span class="dev-tag"><i class="ti ti-device-mobile"></i>Mobile app · Athletes</span>',
     '<span class="dev-tag"><i class="ti ti-device-mobile"></i><span data-i18n="devices.athlete.tag">Mobile app · Athletes</span></span>'),
    ('<h3>Plan, monitor and analyze</h3>', '<h3 data-i18n="devices.staff.h3">Plan, monitor and analyze</h3>'),
    ('<p>The full performance OS — planner, load monitor, GPS analysis and reports — on one screen.</p>',
     '<p data-i18n="devices.staff.p">The full performance OS — planner, load monitor, GPS analysis and reports — on one screen.</p>'),
    ('<h3>Check in on the go</h3>', '<h3 data-i18n="devices.athlete.h3">Check in on the go</h3>'),
    ("<p>Wellness, RPE and today's session — in the athlete's pocket.</p>",
     "<p data-i18n=\"devices.athlete.p\">Wellness, RPE and today's session — in the athlete's pocket.</p>"),
    ('<span class="mk-eyebrow">Get started</span>', '<span class="mk-eyebrow" data-i18n="cta.eye">Get started</span>'),
    ('<h2>Run every category from one place</h2>', '<h2 data-i18n="cta.h2">Run every category from one place</h2>'),
    ('<p>Set up your club workspace in minutes. Start free on youth categories, and add paid tiers only where you need them.</p>',
     '<p data-i18n="cta.p">Set up your club workspace in minutes. Start free on youth categories, and add paid tiers only where you need them.</p>'),
    ('<p>The performance OS for clubs and federations. Every sport, every category, one workspace.</p>',
     '<p data-i18n="foot.brand.p">The performance OS for clubs and federations. Every sport, every category, one workspace.</p>'),
    ('<h4>Product</h4>', '<h4 data-i18n="foot.col.product">Product</h4>'),
    ('<a href="#modules">Features</a>', '<a href="#modules" data-i18n="foot.features">Features</a>'),
    ('<h4>Solutions</h4>', '<h4 data-i18n="foot.col.solutions">Solutions</h4>'),
    ('<a href="#who">Football clubs</a>', '<a href="#who" data-i18n="foot.sol.football">Football clubs</a>'),
    ('<a href="#who">Multisport</a>', '<a href="#who" data-i18n="foot.sol.multisport">Multisport</a>'),
    ('<a href="#who">Federations</a>', '<a href="#who" data-i18n="foot.sol.federations">Federations</a>'),
    ('<a href="#who">Medical &amp; rehab</a>', '<a href="#who" data-i18n="foot.sol.medical">Medical &amp; rehab</a>'),
    ('<h4>Company</h4>', '<h4 data-i18n="foot.col.company">Company</h4>'),
    ('<a href="#">About</a>', '<a href="#" data-i18n="foot.about">About</a>'),
    ('<a href="Contact.html">Contact</a>', '<a href="Contact.html" data-i18n="foot.contact">Contact</a>'),
    ('<a href="#">Docs</a>', '<a href="#" data-i18n="foot.docs">Docs</a>'),
    ('<span>© ClavaMetrics, Inc. · Performance OS for sport</span>',
     '<span data-i18n="foot.copy">© ClavaMetrics, Inc. · Performance OS for sport</span>'),
    ('<a href="#">Privacy</a>', '<a href="#" data-i18n="foot.privacy">Privacy</a>'),
    ('<a href="#">Terms</a>', '<a href="#" data-i18n="foot.terms">Terms</a>'),
    ('<a href="#">DPA</a>', '<a href="#" data-i18n="foot.dpa">DPA</a>'),
    ('<a href="#">Status</a>', '<a href="#" data-i18n="foot.status">Status</a>'),
    ('const words = ["football clubs", "multisport academies", "national federations", "performance staff", "youth academies"];',
     'const words = (window.CM_I18N && window.CM_I18N.rotator) || ["football clubs", "multisport academies", "national federations", "performance staff", "youth academies"];'),
]

if 'data-i18n' in src:
    print("AVISO: Home.html ya tiene data-i18n. ¿Ya lo corriste? Aborto para no duplicar.")
    sys.exit(1)

shutil.copy(PATH, PATH + ".bak")

missing = []
for old, new in R:
    if old not in src:
        missing.append(old)
    src = src.replace(old, new)

if 'i18n.js' not in src:
    src = src.replace('</body>', '<script src="i18n.js"></script>\n</body>')

open(PATH, "w", encoding="utf-8").write(src)

print("OK. Backup en Home.html.bak")
print("data-i18n insertados:", src.count('data-i18n="'))
print("script i18n.js agregado:", 'i18n.js' in src)
print("rotador conectado:", 'window.CM_I18N && window.CM_I18N.rotator' in src)
if missing:
    print("\nTEXTOS NO ENCONTRADOS (tu agente los cambió — agregales el data-i18n a mano):")
    for m in missing:
        print("  -", m[:90])
else:
    print("\nTodos los textos encontrados. Nada que hacer a mano.")
