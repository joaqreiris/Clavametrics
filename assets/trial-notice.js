/* ─────────────────────────────────────────────────────────────────────────
   trial-notice.js — Aviso de vencimiento de la prueba de 15 días

   Se carga en TODA página autenticada (inyectado desde supabase-init.js).
   Lee clubs.trial_ends_at y, según los días que falten, muestra una ventana
   emergente que difumina el fondo con un CTA para elegir plan.

   Reglas (acordadas con el owner):
   - Avisos a los 5, 3 y 1 día: cada umbral se muestra UNA vez (por cruce, no
     se pierde si el usuario no entra justo ese día). El mensaje muestra los
     días reales que quedan.
   - Prueba vencida (0 días o menos): se puede CERRAR pero REAPARECE una vez
     por día hasta que elija plan.
   - No aparece si el club ya paga (billing_status = 'active') o si el club no
     tiene prueba (trial_ends_at NULL, ej. clubs viejos).

   No requiere backend extra: los datos salen de clubs; la memoria de "ya
   avisado" vive en localStorage por club.
   ──────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  if (window.__cmTrialNoticeRan) return;
  window.__cmTrialNoticeRan = true;

  // No molestar dentro del propio Plan Picker (ya está eligiendo plan).
  const PAGE = (location.pathname.split('/').pop() || '').toLowerCase();
  if (decodeURIComponent(PAGE) === 'plan picker.html') return;

  const DAY_MS = 86400000;
  const THRESHOLDS = [5, 3, 1];   // días de aviso previo

  // i18n helper (mismo contrato que tt() en las páginas)
  function tt(key, fallback, vars) {
    const v = (window.CM_I18N && CM_I18N.t) ? CM_I18N.t(key, vars) : null;
    let out = (v && v !== key) ? v : (fallback != null ? fallback : key);
    if (vars) for (const k in vars) out = out.replace('{' + k + '}', vars[k]);
    return out;
  }

  function ymd() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (_) {} }

  // Espera a que exista el cliente Supabase + el helper de club.
  function ready() {
    return new Promise((resolve) => {
      let tries = 0;
      (function poll() {
        if (window.sb && typeof window.getClubId === 'function') return resolve(true);
        if (tries++ > 100) return resolve(false);   // ~10s máx
        setTimeout(poll, 100);
      })();
    });
  }

  async function main() {
    if (!(await ready())) return;

    let clubId;
    try { clubId = await window.getClubId(); } catch (_) { clubId = null; }
    if (!clubId) return;

    // ── Aviso de PAGO FALLIDO (past_due) — prioridad sobre el de prueba ──
    // Corre siempre (incluso en clubs que ya pagan, que no tienen trial). Una vez
    // por día por club. CTA abre la página de Paddle para actualizar la tarjeta.
    try {
      const { data: pd } = await window.sb.from('subscriptions')
        .select('team_id, current_period_end, plans(name)')
        .eq('club_id', clubId).eq('status', 'past_due')
        .order('current_period_end', { ascending: false }).limit(1).maybeSingle();
      if (pd) {
        const key = 'cm_pastdue_' + clubId + '_' + ymd();
        if (!lsGet(key)) {
          lsSet(key, '1');
          const graceDays = Math.ceil((new Date(pd.current_period_end).getTime() + 7 * DAY_MS - Date.now()) / DAY_MS);
          showPastDue({ teamId: pd.team_id, planName: (pd.plans && pd.plans.name) || '', graceDays });
        }
        return;   // no encimar el aviso de prueba
      }
    } catch (_) {}

    let club;
    try {
      const { data } = await window.sb.from('clubs')
        .select('trial_ends_at, billing_status')
        .eq('id', clubId).single();
      club = data;
    } catch (_) { return; }

    if (!club || !club.trial_ends_at) return;          // club sin prueba
    if (club.billing_status === 'active') return;      // ya paga → no molestar

    const end = new Date(club.trial_ends_at).getTime();
    if (isNaN(end)) return;
    const daysLeft = Math.ceil((end - Date.now()) / DAY_MS);

    // ── Prueba vencida → aviso diario ──
    if (daysLeft <= 0) {
      const key = 'cm_trial_expired_' + clubId + '_' + ymd();
      if (lsGet(key)) return;
      lsSet(key, '1');
      showModal({ expired: true });
      return;
    }

    // ── Aviso previo por umbral (5/3/1), cada uno una vez ──
    const warnedKey = 'cm_trial_warned_' + clubId;
    let warned;
    try { warned = JSON.parse(lsGet(warnedKey) || '[]'); } catch (_) { warned = []; }
    if (!Array.isArray(warned)) warned = [];

    // umbral aplicable = el más chico T tal que daysLeft <= T
    const applicable = THRESHOLDS.filter(t => daysLeft <= t).sort((a, b) => a - b)[0];
    if (applicable == null) return;                    // faltan más de 5 días
    if (warned.includes(applicable)) return;           // ya avisado ese umbral

    // marcamos este umbral y los mayores (ya son irrelevantes)
    THRESHOLDS.forEach(t => { if (t >= applicable && !warned.includes(t)) warned.push(t); });
    lsSet(warnedKey, JSON.stringify(warned));
    showModal({ expired: false, daysLeft });
  }

  // Inyecta el CSS compartido del modal (una sola vez).
  function ensureStyle() {
    if (document.getElementById('cm-trial-style')) return;
    const style = document.createElement('style');
    style.id = 'cm-trial-style';
    style.textContent = `
      #cm-trial-overlay{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;
        background:rgba(10,12,16,.45);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);
        padding:24px;animation:cmTrialFade .2s ease-out;}
      @keyframes cmTrialFade{from{opacity:0}to{opacity:1}}
      #cm-trial-card{width:100%;max-width:420px;background:var(--cm-bg-elevated,var(--cm-surface,#fff));
        color:var(--cm-fg-strong,#0f1115);border:1px solid var(--cm-border,rgba(0,0,0,.08));
        border-radius:16px;box-shadow:0 24px 64px rgba(0,0,0,.28);padding:28px 26px 24px;text-align:center;
        animation:cmTrialPop .22s cubic-bezier(.2,.8,.3,1);}
      @keyframes cmTrialPop{from{transform:translateY(8px) scale(.98);opacity:0}to{transform:none;opacity:1}}
      #cm-trial-card .cm-trial-ico{width:56px;height:56px;border-radius:50%;margin:0 auto 14px;display:flex;
        align-items:center;justify-content:center;font-size:26px;
        background:rgba(var(--cm-accent-rgb,45,168,102),.12);color:var(--cm-accent,#2da866);}
      #cm-trial-card h3{margin:0 0 8px;font-size:19px;font-weight:700;}
      #cm-trial-card p{margin:0 0 22px;font-size:14px;line-height:1.5;color:var(--cm-fg-muted,#5b6472);}
      #cm-trial-card .cm-trial-cta{display:inline-flex;align-items:center;gap:8px;justify-content:center;width:100%;
        padding:12px 16px;border:0;border-radius:10px;background:var(--cm-accent,#2da866);color:#fff;
        font-size:14px;font-weight:600;cursor:pointer;text-decoration:none;}
      #cm-trial-card .cm-trial-cta:hover{filter:brightness(1.05);}
      #cm-trial-card .cm-trial-later{margin-top:12px;background:none;border:0;color:var(--cm-fg-faint,#8a93a0);
        font-size:13px;cursor:pointer;}
      #cm-trial-card .cm-trial-later:hover{color:var(--cm-fg-muted,#5b6472);text-decoration:underline;}
    `;
    document.head.appendChild(style);
  }

  function showModal({ expired, daysLeft }) {
    if (document.getElementById('cm-trial-overlay')) return;
    ensureStyle();

    const title = expired
      ? tt('trial.expired_title', 'Tu prueba terminó')
      : tt('trial.warn_title', 'Tu prueba está por vencer');
    const msg = expired
      ? tt('trial.expired_msg', 'Tu prueba de 15 días venció. Elegí un plan para seguir con todas las funciones.')
      : (daysLeft === 1
          ? tt('trial.warn_1day', 'Te queda 1 día de prueba con todas las funciones.')
          : tt('trial.warn_days', 'Te quedan {days} días de prueba con todas las funciones.', { days: daysLeft }));

    const overlay = document.createElement('div');
    overlay.id = 'cm-trial-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML = `
      <div id="cm-trial-card">
        <div class="cm-trial-ico"><i class="ti ${expired ? 'ti-lock' : 'ti-clock-exclamation'}"></i></div>
        <h3 data-cm-trial-title></h3>
        <p data-cm-trial-msg></p>
        <a class="cm-trial-cta" href="Plan Picker.html">
          <i class="ti ti-arrow-right"></i><span data-cm-trial-cta></span>
        </a>
        <div><button type="button" class="cm-trial-later" data-cm-trial-later></button></div>
      </div>`;
    // textContent (evita inyección desde traducciones)
    overlay.querySelector('[data-cm-trial-title]').textContent = title;
    overlay.querySelector('[data-cm-trial-msg]').textContent = msg;
    overlay.querySelector('[data-cm-trial-cta]').textContent = tt('trial.cta', 'Elegir plan');
    overlay.querySelector('[data-cm-trial-later]').textContent = tt('trial.later', 'Más tarde');

    function close() {
      overlay.remove();
      const st = document.getElementById('cm-trial-style');
      if (st) st.remove();
    }
    overlay.querySelector('.cm-trial-later').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
    });

    document.body.appendChild(overlay);
  }

  // ── Modal de pago fallido (reusa el estilo/overlay del de prueba) ──
  function showPastDue({ teamId, planName, graceDays }) {
    if (document.getElementById('cm-trial-overlay')) return;
    ensureStyle();
    const expired = graceDays <= 0;
    const title = tt('pastdue.title', 'No pudimos procesar tu pago');
    const msg = expired
      ? tt('pastdue.msg_expired', 'Tu plan {plan} quedó en pausa por un pago fallido. Actualizá tu tarjeta para reactivarlo.', { plan: planName })
      : (graceDays === 1
          ? tt('pastdue.msg_1day', 'No pudimos cobrar tu tarjeta. Te queda 1 día para actualizarla y no perder tu plan {plan}.', { plan: planName })
          : tt('pastdue.msg_days', 'No pudimos cobrar tu tarjeta. Te quedan {days} días para actualizarla y no perder tu plan {plan}.', { days: graceDays, plan: planName }));

    const overlay = document.createElement('div');
    overlay.id = 'cm-trial-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML = `
      <div id="cm-trial-card">
        <div class="cm-trial-ico" style="background:rgba(220,90,90,.12);color:#dc5a5a"><i class="ti ti-credit-card-off"></i></div>
        <h3 data-cm-title></h3>
        <p data-cm-msg></p>
        <a class="cm-trial-cta" href="Billing.html"><i class="ti ti-credit-card"></i><span data-cm-cta></span></a>
        <div><button type="button" class="cm-trial-later" data-cm-later></button></div>
      </div>`;
    overlay.querySelector('[data-cm-title]').textContent = title;
    overlay.querySelector('[data-cm-msg]').textContent = msg;
    overlay.querySelector('[data-cm-cta]').textContent = tt('pastdue.cta', 'Actualizar pago');
    overlay.querySelector('[data-cm-later]').textContent = tt('trial.later', 'Más tarde');

    function close() {
      overlay.remove();
      const st = document.getElementById('cm-trial-style');
      if (st) st.remove();
    }
    overlay.querySelector('.cm-trial-later').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
    });
    // CTA: abrir la página de Paddle para actualizar el pago; fallback a Billing.
    overlay.querySelector('.cm-trial-cta').addEventListener('click', async (e) => {
      e.preventDefault();
      const cta = overlay.querySelector('.cm-trial-cta'); cta.style.pointerEvents = 'none';
      try {
        const { data: r, error } = await window.sb.functions.invoke('paddle-change-plan', { body: { team_id: teamId, action: 'manage' } });
        if (!error && r && r.update_payment_method) { window.open(r.update_payment_method, '_blank', 'noopener'); close(); return; }
      } catch (_) {}
      window.location.href = 'Billing.html';   // fallback
    });

    document.body.appendChild(overlay);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
  } else {
    main();
  }
})();
