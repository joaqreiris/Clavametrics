#!/usr/bin/env python3
"""
i18n para Contact.html. Corré desde la raíz del repo (requiere i18n.js en el root):
    python3 apply_i18n_contact.py
Hace Contact.html.bak y avisa si algún texto no se encontró.
"""
import os, shutil, sys
PATH = "Contact.html"
if not os.path.exists(PATH):
    print("No encuentro Contact.html. Corré el script en la raíz del repo."); sys.exit(1)
src = open(PATH, encoding="utf-8").read()
if 'data-i18n="ct.h1"' in src:
    print("AVISO: Contact ya está tageado. Aborto para no duplicar."); sys.exit(1)

R = [
    # NAV
    ('<a href="Home.html#modules">Product</a>', '<a href="Home.html#modules" data-i18n="nav.product">Product</a>'),
    ('<a href="Home.html#how">How it works</a>', '<a href="Home.html#how" data-i18n="nav.how">How it works</a>'),
    ('<a href="Pricing.html">Pricing</a>', '<a href="Pricing.html" data-i18n="nav.pricing">Pricing</a>'),
    ('<a href="Home.html#who">Customers</a>', '<a href="Home.html#who" data-i18n="nav.customers">Customers</a>'),
    ('<a class="signin" href="Login.html">Sign in</a>', '<a class="signin" href="Login.html" data-i18n="nav.signin">Sign in</a>'),
    ('Start free<i class="ti ti-arrow-right" style="font-size:14px"></i>',
     '<span data-i18n="nav.startfree">Start free</span><i class="ti ti-arrow-right" style="font-size:14px"></i>'),
    # HERO
    ('<span class="mk-eyebrow">Book a demo</span>', '<span class="mk-eyebrow" data-i18n="hero.demo">Book a demo</span>'),
    ('<h1>See ClavaMetrics on your own squad</h1>', '<h1 data-i18n="ct.h1">See ClavaMetrics on your own squad</h1>'),
    # Benefits (b + inner span)
    ('<b>30-minute walkthrough</b><span>A focused session with someone who knows performance, not a sales pitch.</span>',
     '<b data-i18n="ct.b1.t">30-minute walkthrough</b><span data-i18n="ct.b1.d">A focused session with someone who knows performance, not a sales pitch.</span>'),
    ('<b>Set up around your categories</b><span>We\'ll show planning, load and availability mapped to your teams.</span>',
     '<b data-i18n="ct.b2.t">Set up around your categories</b><span data-i18n="ct.b2.d">We\'ll show planning, load and availability mapped to your teams.</span>'),
    ('<b>Integrations &amp; migration</b><span>Bringing GPS data or spreadsheets across? We\'ll cover how.</span>',
     '<b data-i18n="ct.b3.t">Integrations &amp; migration</b><span data-i18n="ct.b3.d">Bringing GPS data or spreadsheets across? We\'ll cover how.</span>'),
    # Contact strip
    ('<span><i class="ti ti-clock"></i>We reply within one business day</span>',
     '<span><i class="ti ti-clock"></i><span data-i18n="ct.reply">We reply within one business day</span></span>'),
    ('<a href="Register.html"><i class="ti ti-bolt"></i>Or start free, no demo needed</a>',
     '<a href="Register.html"><i class="ti ti-bolt"></i><span data-i18n="ct.orfree">Or start free, no demo needed</span></a>'),
    # Card head
    ('<span class="badge"><i class="ti ti-calendar-event"></i>Request a demo</span>',
     '<span class="badge"><i class="ti ti-calendar-event"></i><span data-i18n="ct.badge">Request a demo</span></span>'),
    ('<span class="free">Prefer to explore? <a href="Register.html">Start free</a></span>',
     '<span class="free"><span data-i18n="ct.free.pre">Prefer to explore? </span><a href="Register.html" data-i18n="nav.startfree">Start free</a></span>'),
    # Form labels (req-* span-wrapped; plain labels direct)
    ('<label class="cm-label" for="f-name">Full name<span class="req">*</span></label>',
     '<label class="cm-label" for="f-name"><span data-i18n="ct.lbl.name">Full name</span><span class="req">*</span></label>'),
    ('<label class="cm-label" for="f-email">Work email<span class="req">*</span></label>',
     '<label class="cm-label" for="f-email"><span data-i18n="ct.lbl.email">Work email</span><span class="req">*</span></label>'),
    ('<label class="cm-label" for="f-club">Club / organization<span class="req">*</span></label>',
     '<label class="cm-label" for="f-club"><span data-i18n="ct.lbl.club">Club / organization</span><span class="req">*</span></label>'),
    ('<label class="cm-label" for="f-role">Your role</label>', '<label class="cm-label" for="f-role" data-i18n="ct.lbl.role">Your role</label>'),
    ('<label class="cm-label" for="f-sport">Sport</label>', '<label class="cm-label" for="f-sport" data-i18n="ct.lbl.sport">Sport</label>'),
    ('<label class="cm-label" for="f-size">Athletes</label>', '<label class="cm-label" for="f-size" data-i18n="ct.lbl.size">Athletes</label>'),
    ('<label class="cm-label" for="f-msg">Anything we should know?</label>', '<label class="cm-label" for="f-msg" data-i18n="ct.lbl.msg">Anything we should know?</label>'),
    # Textarea placeholder
    ('name="message" placeholder="How many categories, current tools, what you\'d like to solve…"',
     'name="message" data-i18n-ph="ct.ph.msg" placeholder="How many categories, current tools, what you\'d like to solve…"'),
    # Options — role
    ('<option value="">Select…</option>', '<option value="" data-i18n="ct.opt.select">Select…</option>'),
    ('<option>Head coach</option>', '<option data-i18n="ct.role.coach">Head coach</option>'),
    ('<option>Strength &amp; conditioning</option>', '<option data-i18n="ct.role.sc">Strength &amp; conditioning</option>'),
    ('<option>Physio / medical</option>', '<option data-i18n="ct.role.physio">Physio / medical</option>'),
    ('<option>Performance analyst</option>', '<option data-i18n="ct.role.analyst">Performance analyst</option>'),
    ('<option>Performance director</option>', '<option data-i18n="ct.role.director">Performance director</option>'),
    ('<option>Club management</option>', '<option data-i18n="ct.role.mgmt">Club management</option>'),
    ('<option>Other</option>', '<option data-i18n="ct.opt.other">Other</option>'),
    # Options — sport
    ('<option>Football</option>', '<option data-i18n="ct.sport.football">Football</option>'),
    ('<option>Basketball</option>', '<option data-i18n="ct.sport.basket">Basketball</option>'),
    ('<option>Volleyball</option>', '<option data-i18n="ct.sport.volley">Volleyball</option>'),
    ('<option>Rugby</option>', '<option data-i18n="ct.sport.rugby">Rugby</option>'),
    ('<option>Swimming</option>', '<option data-i18n="ct.sport.swim">Swimming</option>'),
    ('<option>Athletics</option>', '<option data-i18n="ct.sport.athletics">Athletics</option>'),
    ('<option>Multisport</option>', '<option data-i18n="ct.sport.multi">Multisport</option>'),
    # Options — size (only worded ones)
    ('<option>Under 15</option>', '<option data-i18n="ct.size.u15">Under 15</option>'),
    ('<option>400+ (federation)</option>', '<option data-i18n="ct.size.xl">400+ (federation)</option>'),
    # Submit + note
    ('Request demo<i class="ti ti-arrow-right" style="font-size:16px"></i>',
     '<span data-i18n="ct.submit">Request demo</span><i class="ti ti-arrow-right" style="font-size:16px"></i>'),
    ('<span class="note">By submitting you agree to our Privacy Policy. No spam, ever.</span>',
     '<span class="note" data-i18n="ct.note">By submitting you agree to our Privacy Policy. No spam, ever.</span>'),
    # Success
    ('<h3>Request received</h3>', '<h3 data-i18n="ct.success.t">Request received</h3>'),
    ('<p>Thanks — we\'ll be in touch within one business day to set up your walkthrough.</p>',
     '<p data-i18n="ct.success.d">Thanks — we\'ll be in touch within one business day to set up your walkthrough.</p>'),
    ('<i class="ti ti-arrow-left" style="font-size:15px"></i>Back to home',
     '<i class="ti ti-arrow-left" style="font-size:15px"></i><span data-i18n="ct.success.back">Back to home</span>'),
    # Logos
    ('<p>Trusted by performance staff at clubs &amp; federations</p>',
     '<p data-i18n="ct.logos">Trusted by performance staff at clubs &amp; federations</p>'),
    # FOOTER
    ('<a href="Home.html#modules">Features</a>', '<a href="Home.html#modules" data-i18n="foot.features">Features</a>'),
    ('<a href="Login.html">Sign in</a>', '<a href="Login.html" data-i18n="nav.signin">Sign in</a>'),
    ('<a href="Home.html#who">Football clubs</a>', '<a href="Home.html#who" data-i18n="foot.sol.football">Football clubs</a>'),
    ('<a href="Home.html#who">Multisport</a>', '<a href="Home.html#who" data-i18n="foot.sol.multisport">Multisport</a>'),
    ('<a href="Home.html#who">Federations</a>', '<a href="Home.html#who" data-i18n="foot.sol.federations">Federations</a>'),
    ('<a href="Home.html#who">Medical &amp; rehab</a>', '<a href="Home.html#who" data-i18n="foot.sol.medical">Medical &amp; rehab</a>'),
    ('<a href="#">About</a>', '<a href="#" data-i18n="foot.about">About</a>'),
    ('<a href="Home.html#testimonials">Customers</a>', '<a href="Home.html#testimonials" data-i18n="nav.customers">Customers</a>'),
    ('<a href="Contact.html">Contact</a>', '<a href="Contact.html" data-i18n="foot.contact">Contact</a>'),
    ('<a href="#">Docs</a>', '<a href="#" data-i18n="foot.docs">Docs</a>'),
    ('<h4>Product</h4>', '<h4 data-i18n="foot.col.product">Product</h4>'),
    ('<h4>Solutions</h4>', '<h4 data-i18n="foot.col.solutions">Solutions</h4>'),
    ('<h4>Company</h4>', '<h4 data-i18n="foot.col.company">Company</h4>'),
    ('<span>© ClavaMetrics, Inc. · Performance OS for sport</span>',
     '<span data-i18n="foot.copy">© ClavaMetrics, Inc. · Performance OS for sport</span>'),
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
print("OK. Backup en Contact.html.bak")
print("data-i18n insertados:", src.count('data-i18n="') + src.count('data-i18n-ph="'))
print("script i18n.js agregado:", 'i18n.js' in src)
if missing:
    print("\nTEXTOS NO ENCONTRADOS (pasámelos):")
    for m in missing: print("  -", m)
else:
    print("\nTodos los textos encontrados. Nada que hacer a mano.")
