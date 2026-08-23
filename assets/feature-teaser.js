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

  // Mockup Drill Designer: pizarra táctica (cancha + jugadores + flechas).
  function drillMock() {
    return '<div class="cmft-panel cmft-drill"><div class="cmft-panel-h">Session · Rondo 4v2</div>'
      + '<div class="cmft-pitch"><svg viewBox="0 0 400 250" preserveAspectRatio="xMidYMid meet">'
      + '<rect x="6" y="6" width="388" height="238" rx="10" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="2"/>'
      + '<line x1="200" y1="6" x2="200" y2="244" stroke="rgba(255,255,255,.4)" stroke-width="2"/>'
      + '<circle cx="200" cy="125" r="40" fill="none" stroke="rgba(255,255,255,.4)" stroke-width="2"/>'
      + '<circle cx="90" cy="70" r="11" fill="#2da866"/><circle cx="110" cy="185" r="11" fill="#2da866"/>'
      + '<circle cx="300" cy="80" r="11" fill="#2da866"/><circle cx="310" cy="175" r="11" fill="#2da866"/>'
      + '<circle cx="200" cy="125" r="11" fill="#d4a14a"/><circle cx="240" cy="60" r="11" fill="#dc5a5a"/>'
      + '<path d="M120 80 Q170 60 195 118" fill="none" stroke="#fff" stroke-width="2.5" stroke-dasharray="6 5" marker-end="url(#ah)"/>'
      + '<path d="M210 130 Q270 150 300 90" fill="none" stroke="#fff" stroke-width="2.5" stroke-dasharray="6 5"/>'
      + '<defs><marker id="ah" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 z" fill="#fff"/></marker></defs>'
      + '</svg></div></div>';
  }

  // Mockup Match Reports: marcador + barras de stats + mapa de tiros.
  function matchMock() {
    var stats = [['Possession', '58%', 58], ['Shots', '14', 70], ['xG', '1.8', 60], ['Passes', '486', 82]]
      .map(function (s) { return '<div class="cmft-stat"><span class="k">' + s[0] + '</span><span class="v">' + s[1] + '</span><div class="tr"><i style="width:' + s[2] + '%"></i></div></div>'; }).join('');
    var shots = [[60, 40], [90, 80], [120, 55], [70, 120], [140, 95], [100, 150]]
      .map(function (p, i) { return '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + (i === 1 ? 9 : 6) + '" fill="' + (i === 1 ? '#2da866' : 'rgba(45,168,102,.55)') + '"/>'; }).join('');
    return '<div class="cmft-match">'
      + '<div class="cmft-panel cmft-score"><div class="cmft-panel-h">Full time</div><div class="sc">RC Celta <b>2</b> — <b>1</b> Rival</div><div class="mt">La Liga · MD 24</div></div>'
      + '<div class="cmft-panel"><div class="cmft-panel-h">Shot map</div><div class="cmft-shotmap"><svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid meet"><rect x="4" y="4" width="192" height="192" rx="8" fill="none" stroke="var(--cm-border,rgba(0,0,0,.15))" stroke-width="1.5"/>' + shots + '</svg></div></div>'
      + '<div class="cmft-panel"><div class="cmft-panel-h">Team stats</div>' + stats + '</div>'
      + '</div>';
  }

  var TEASERS = {
    'gps': {
      plan: 'Basic', icon: 'ti-radar-2', accent: '#2da866', mock: gpsMock, tkey: 'gps',
      fb: { title: 'Ve la carga real de tu plantel', sub: 'Distancia, sprints, player load y aceleraciones de cada jugador.',
            b: ['Métricas por jugador y por sesión', 'Comparativa vs. partido y microciclo', 'Importá desde Catapult, StatSports o CSV'] }
    },
    'load-monitor': {
      plan: 'Professional', icon: 'ti-heartbeat', accent: '#d4a14a', mock: loadMock, tkey: 'load',
      fb: { title: 'Anticipá lesiones antes de que pasen', sub: 'ACWR, CTL/ATL/TSB y alertas de riesgo para cuidar a tu plantel.',
            b: ['Riesgo de lesión por ACWR, en tiempo real', 'Cargas aguda/crónica (CTL·ATL·TSB)', 'Alertas para ajustar antes de que se lesionen'] }
    },
    'planner': {
      plan: 'Basic', icon: 'ti-clipboard-list', accent: '#2da866', mock: drillMock, tkey: 'drill',
      fb: { title: 'Diseñá tus jugadas en la pizarra', sub: 'Dibujá ejercicios y jugadas con jugadores, movimientos y anotaciones.',
            b: ['Pizarra táctica con jugadores y flechas', 'Biblioteca de ejercicios reutilizables', 'Compartí las sesiones con tu cuerpo técnico'] }
    },
    'match-reports': {
      plan: 'Professional', icon: 'ti-report-analytics', accent: '#d4a14a', mock: matchMock, tkey: 'match',
      fb: { title: 'Informes de partido que hablan', sub: 'Resultado, tiros, estadísticas por jugador y mapa de juego.',
            b: ['Estadísticas por jugador y por equipo', 'Mapa de tiros y eventos clave', 'Exportá y compartí el informe'] }
    }
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
      '.cmft-risk-row .acwr{font:600 13px var(--cm-font-mono,monospace);color:var(--cm-fg-muted,#5b6472)}',
      /* drill designer */
      '.cmft-drill{max-width:680px;margin:0 auto}',
      '.cmft-pitch{background:linear-gradient(135deg,#1f7a44,#2da866);border-radius:12px;padding:10px}',
      '.cmft-pitch svg{width:100%;height:auto;display:block}',
      /* match reports */
      '.cmft-match{display:grid;grid-template-columns:1fr 1fr 1.1fr;gap:16px;max-width:1000px;margin:0 auto}',
      '.cmft-score .sc{font-size:26px;font-weight:800;color:var(--cm-fg-strong,#0f1115);margin-top:6px}',
      '.cmft-score .sc b{color:var(--cm-accent,#2da866)}',
      '.cmft-score .mt{font-size:12px;color:var(--cm-fg-muted,#5b6472);margin-top:6px}',
      '.cmft-shotmap svg{width:100%;height:auto;display:block}',
      '.cmft-stat{margin-bottom:12px}',
      '.cmft-stat .k{font-size:12px;color:var(--cm-fg-muted,#5b6472)}',
      '.cmft-stat .v{float:right;font:700 13px var(--cm-font-mono,monospace);color:var(--cm-fg-strong,#0f1115)}',
      '.cmft-stat .tr{height:7px;border-radius:4px;background:var(--cm-border-soft,rgba(0,0,0,.08));margin-top:6px;overflow:hidden}',
      '.cmft-stat .tr i{display:block;height:100%;background:var(--cm-accent,#2da866);border-radius:4px}'
    ].join('');
    document.head.appendChild(s);
  }

  // Renderiza el teaser para la key dada. Devuelve true si había teaser.
  window.cmFeatureTeaser = function (key) {
    var cfg = TEASERS[key];
    if (!cfg) return false;
    if (document.getElementById('cmft-overlay')) return true;
    ensureStyle();

    var fb = cfg.fb || { title: '', sub: '', b: ['', '', ''] };
    var title = tt('teaser.' + cfg.tkey + '_title', fb.title);
    var sub   = tt('teaser.' + cfg.tkey + '_sub', fb.sub);
    var bullets = [1, 2, 3].map(function (i) {
      return '<li><i class="ti ti-check"></i><span>' + tt('teaser.' + cfg.tkey + '_b' + i, fb.b[i - 1]) + '</span></li>';
    }).join('');

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
