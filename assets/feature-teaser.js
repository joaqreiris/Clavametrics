/* ─────────────────────────────────────────────────────────────────────────
   feature-teaser.js — Pantalla de "teaser" para features pagas bloqueadas.

   En vez de patear al Plan Picker pelado, muestra un dashboard de MUESTRA
   difuminado (datos de ejemplo, no reales) + una tarjeta con el valor y un CTA
   para subir de plan. Patrón de conversión: "ves lo que te perdés".

   Lo dispara guardModule() (supabase-init.js): si el plan no permite la feature
   y hay un teaser configurado para esa key → renderiza esto y frena la página.

   Solo mockups en HTML/CSS (se adaptan al tema claro/oscuro; sin imágenes).
   ──────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  function tt(k, f, v) {
    var r = (window.CM_I18N && CM_I18N.t) ? CM_I18N.t(k, v) : null;
    var out = (r && r !== k) ? r : f;
    if (v) for (var x in v) out = out.replace('{' + x + '}', v[x]);
    return out;
  }
  function activeTeam() {
    try { return sessionStorage.getItem('cal_active_team') || localStorage.getItem('cal_active_team') || ''; }
    catch (_) { return ''; }
  }

  // Mockup GPS: tiles + barras de carga por jugador (todo de ejemplo).
  function gpsMock() {
    var tiles = [
      ['Total distance', '9.4 km'], ['Sprint distance', '612 m'],
      ['Player load', '742'], ['Max speed', '32.6 km/h'],
      ['HSR', '486 m'], ['Accel/Decel', '58']
    ].map(function (t) {
      return '<div class="cmft-tile"><div class="k">' + t[0] + '</div><div class="v">' + t[1] + '</div><div class="spark"></div></div>';
    }).join('');
    var bars = [78, 62, 91, 54, 84, 70, 46, 88, 66, 74, 58, 82].map(function (h, i) {
      return '<div class="cmft-bar" style="height:' + h + '%"><span>P' + (i + 1) + '</span></div>';
    }).join('');
    return '<div class="cmft-tiles">' + tiles + '</div>'
      + '<div class="cmft-panel"><div class="cmft-panel-h">Team load · last microcycle</div><div class="cmft-bars">' + bars + '</div></div>';
  }

  // Mockup Load Monitor: ACWR + tendencia + riesgo por jugador (de ejemplo).
  function loadMock() {
    var pts = [30, 42, 38, 55, 60, 52, 68, 74, 66, 80, 72, 85];
    var poly = pts.map(function (p, i) { return (i * (300 / (pts.length - 1))) + ',' + (100 - p); }).join(' ');
    var risk = [['A. Costa', 'high', '1.48'], ['M. Silva', 'ok', '1.02'], ['J. Pérez', 'ok', '0.94'], ['L. Gómez', 'warn', '1.31']]
      .map(function (r) { return '<div class="cmft-risk-row"><span class="dot ' + r[1] + '"></span><span class="nm">' + r[0] + '</span><span class="acwr">' + r[2] + '</span></div>'; }).join('');
    return '<div class="cmft-lm">'
      + '<div class="cmft-gauge"><div class="big">1.24</div><div class="lbl">ACWR</div><div class="bands"><span></span><span></span><span></span></div></div>'
      + '<div class="cmft-panel cmft-line"><div class="cmft-panel-h">Acute:Chronic trend</div>'
      + '<svg viewBox="0 0 300 100" preserveAspectRatio="none"><polyline points="' + poly + '" fill="none" stroke="currentColor" stroke-width="2.5"/></svg></div>'
      + '<div class="cmft-panel cmft-risk"><div class="cmft-panel-h">Injury risk</div>' + risk + '</div>'
      + '</div>';
  }

  var TEASERS = {
    'gps':          { plan: 'Basic',        icon: 'ti-radar-2',   accent: '#2da866', mock: gpsMock,  tkey: 'gps' },
    'load-monitor': { plan: 'Professional', icon: 'ti-heartbeat', accent: '#d4a14a', mock: loadMock, tkey: 'load' }
  };

  function ensureStyle() {
    if (document.getElementById('cmft-style')) return;
    var s = document.createElement('style');
    s.id = 'cmft-style';
    s.textContent = [
      '#cmft-overlay{position:fixed;inset:0;z-index:9000;overflow:hidden;background:var(--cm-bg,#0f1115)}',
      '#cmft-bg{position:absolute;inset:0;padding:32px;filter:blur(7px);opacity:.5;pointer-events:none;user-select:none;transform:scale(1.03)}',
      '#cmft-scrim{position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 0%,var(--cm-bg,#0f1115) 78%)}',
      '#cmft-card{position:relative;max-width:460px;margin:8vh auto 0;background:var(--cm-bg-elevated,var(--cm-surface,#fff));color:var(--cm-fg-strong,#0f1115);border:1px solid var(--cm-border,rgba(0,0,0,.1));border-radius:18px;box-shadow:0 30px 80px rgba(0,0,0,.4);padding:30px 30px 26px;text-align:center}',
      '#cmft-card .ic{width:56px;height:56px;border-radius:14px;margin:0 auto 16px;display:flex;align-items:center;justify-content:center;font-size:28px}',
      '#cmft-card h2{margin:0 0 8px;font-size:22px;font-weight:800;letter-spacing:-.01em}',
      '#cmft-card .sub{margin:0 0 18px;font-size:14px;color:var(--cm-fg-muted,#5b6472)}',
      '#cmft-card ul{list-style:none;margin:0 0 22px;padding:0;text-align:left;display:grid;gap:10px}',
      '#cmft-card li{display:flex;align-items:flex-start;gap:10px;font-size:14px;color:var(--cm-fg-strong,#0f1115)}',
      '#cmft-card li i{color:var(--cm-accent,#2da866);font-size:18px;margin-top:1px;flex:0 0 auto}',
      '#cmft-card .cta{display:inline-flex;align-items:center;gap:8px;justify-content:center;width:100%;padding:13px 16px;border:0;border-radius:11px;color:#fff;font-size:15px;font-weight:700;cursor:pointer;text-decoration:none}',
      '#cmft-card .incl{margin-top:12px;font-size:12.5px;color:var(--cm-fg-muted,#5b6472)}',
      '#cmft-back{position:absolute;top:16px;left:18px;z-index:2;display:inline-flex;align-items:center;gap:6px;color:var(--cm-fg-muted,#5b6472);text-decoration:none;font-size:13px;background:var(--cm-bg-elevated,#fff);border:1px solid var(--cm-border,rgba(0,0,0,.1));border-radius:9px;padding:7px 11px}',
      /* mockups */
      '.cmft-tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;max-width:1000px;margin:0 auto 16px}',
      '.cmft-tile{background:var(--cm-bg-elevated,#fff);border:1px solid var(--cm-border,rgba(0,0,0,.08));border-radius:14px;padding:16px}',
      '.cmft-tile .k{font-size:12px;color:var(--cm-fg-muted,#5b6472);text-transform:uppercase;letter-spacing:.05em}',
      '.cmft-tile .v{font-size:26px;font-weight:800;margin-top:6px;color:var(--cm-fg-strong,#0f1115)}',
      '.cmft-tile .spark{height:26px;margin-top:10px;border-radius:6px;background:linear-gradient(90deg,var(--cm-accent,#2da866) 0%,transparent 100%);opacity:.35}',
      '.cmft-panel{background:var(--cm-bg-elevated,#fff);border:1px solid var(--cm-border,rgba(0,0,0,.08));border-radius:14px;padding:16px;max-width:1000px;margin:0 auto}',
      '.cmft-panel-h{font-size:13px;color:var(--cm-fg-muted,#5b6472);margin-bottom:14px;font-weight:600}',
      '.cmft-bars{display:flex;align-items:flex-end;gap:12px;height:180px}',
      '.cmft-bar{flex:1;background:linear-gradient(180deg,var(--cm-accent,#2da866),color-mix(in srgb,var(--cm-accent,#2da866) 55%,transparent));border-radius:7px 7px 0 0;position:relative;min-width:14px}',
      '.cmft-bar span{position:absolute;bottom:-20px;left:0;right:0;text-align:center;font-size:11px;color:var(--cm-fg-muted,#5b6472)}',
      '.cmft-lm{display:grid;grid-template-columns:1fr 1.4fr;gap:16px;max-width:900px;margin:0 auto}',
      '.cmft-gauge{background:var(--cm-bg-elevated,#fff);border:1px solid var(--cm-border,rgba(0,0,0,.08));border-radius:14px;padding:22px;display:flex;flex-direction:column;align-items:center;justify-content:center}',
      '.cmft-gauge .big{font-size:52px;font-weight:800;color:#d4a14a}',
      '.cmft-gauge .lbl{font-size:13px;color:var(--cm-fg-muted,#5b6472);letter-spacing:.08em}',
      '.cmft-gauge .bands{display:flex;gap:6px;margin-top:16px;width:100%}',
      '.cmft-gauge .bands span{height:8px;flex:1;border-radius:4px}',
      '.cmft-gauge .bands span:nth-child(1){background:#2da866}.cmft-gauge .bands span:nth-child(2){background:#d4a14a}.cmft-gauge .bands span:nth-child(3){background:#dc5a5a}',
      '.cmft-line svg{width:100%;height:120px;color:var(--cm-accent,#2da866)}',
      '.cmft-risk-row{display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--cm-border-soft,rgba(0,0,0,.05))}',
      '.cmft-risk-row .dot{width:10px;height:10px;border-radius:50%}',
      '.cmft-risk-row .dot.ok{background:#2da866}.cmft-risk-row .dot.warn{background:#d4a14a}.cmft-risk-row .dot.high{background:#dc5a5a}',
      '.cmft-risk-row .nm{flex:1;font-size:13px;color:var(--cm-fg-strong,#0f1115)}',
      '.cmft-risk-row .acwr{font:600 13px var(--cm-font-mono,monospace);color:var(--cm-fg-muted,#5b6472)}'
    ].join('');
    document.head.appendChild(s);
  }

  // Renderiza el teaser para la key dada. Devuelve true si había teaser.
  window.cmFeatureTeaser = function (key) {
    var cfg = TEASERS[key];
    if (!cfg) return false;
    if (document.getElementById('cmft-overlay')) return true;
    ensureStyle();

    var title = tt('teaser.' + cfg.tkey + '_title', key === 'gps' ? 'Ve la carga real de tu plantel' : 'Anticipá lesiones antes de que pasen');
    var sub   = tt('teaser.' + cfg.tkey + '_sub', key === 'gps'
      ? 'Distancia, sprints, player load y aceleraciones de cada jugador.'
      : 'ACWR, CTL/ATL/TSB y alertas de riesgo para cuidar a tu plantel.');
    var bullets = (key === 'gps'
      ? [tt('teaser.gps_b1', 'Métricas por jugador y por sesión'),
         tt('teaser.gps_b2', 'Comparativa vs. partido y microciclo'),
         tt('teaser.gps_b3', 'Importá desde Catapult, StatSports o CSV')]
      : [tt('teaser.load_b1', 'Riesgo de lesión por ACWR, en tiempo real'),
         tt('teaser.load_b2', 'Cargas aguda/crónica (CTL·ATL·TSB)'),
         tt('teaser.load_b3', 'Alertas para ajustar antes de que se lesionen')]
    ).map(function (b) { return '<li><i class="ti ti-check"></i><span>' + b + '</span></li>'; }).join('');

    var team = activeTeam();
    var href = 'Plan Picker.html' + (team ? ('?team=' + encodeURIComponent(team)) : '');
    var ctaTxt = tt('teaser.cta', 'Desbloqueá con {plan}', { plan: cfg.plan });
    var incl = tt('teaser.included', 'Incluido en el plan {plan} y superiores', { plan: cfg.plan });

    var ov = document.createElement('div');
    ov.id = 'cmft-overlay';
    ov.innerHTML =
      '<a id="cmft-back" href="Hub.html"><i class="ti ti-arrow-left"></i><span>' + tt('teaser.back', 'Volver') + '</span></a>'
      + '<div id="cmft-bg">' + cfg.mock() + '</div>'
      + '<div id="cmft-scrim"></div>'
      + '<div id="cmft-card">'
      + '<div class="ic" style="background:color-mix(in srgb,' + cfg.accent + ' 15%,transparent);color:' + cfg.accent + '"><i class="ti ' + cfg.icon + '"></i></div>'
      + '<h2></h2><p class="sub"></p><ul>' + bullets + '</ul>'
      + '<a class="cta" style="background:' + cfg.accent + '" href="' + href + '"><i class="ti ti-arrow-up"></i><span></span></a>'
      + '<div class="incl"></div>'
      + '</div>';
    ov.querySelector('h2').textContent = title;
    ov.querySelector('.sub').textContent = sub;
    ov.querySelector('.cta span').textContent = ctaTxt;
    ov.querySelector('.incl').textContent = incl;
    document.body.appendChild(ov);
    return true;
  };
})();
