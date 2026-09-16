/* Suscripción desde dentro del producto.
 *
 * El checkout ya existía, pero solo en el último paso del asistente de alta: el club
 * que le daba a "Empezar la prueba" no volvía a ver un botón de comprar en ninguna
 * parte. Quince días después el trial vencía y el único camino era ir a buscarlo.
 * Este módulo lleva ese mismo checkout a donde el club está: el panel de Admin.
 *
 * El precio es POR CATEGORÍA, así que el modal no puede ser un botón: hay que elegir
 * qué plan lleva cada una. La sugerencia inicial sale del tamaño real del plantel —
 * cosa que el asistente no podía hacer, porque ahí todavía no había jugadores.
 *
 * Uso:  CM_SUBSCRIBE.open()           → abre el modal
 *       CM_SUBSCRIBE.trialInfo()      → { enPrueba, dias, finaliza } | null
 */
(function () {
  'use strict';

  const PADDLE_TOKEN_SANDBOX = 'test_effd5adff10614f5ee3b57a539b';
  const PADDLE_TOKEN_LIVE    = 'live_396e5136a2baa76cc348ef38a05';   // token de cliente (público)
  const PADDLE_JS            = 'https://cdn.paddle.com/paddle/v2/paddle.js';

  // Por debajo de este plantel, una categoría no paga. Es la misma regla que muestra
  // el asistente ("las que están bajo 15 jugadores quedan gratis").
  const LIBRE_HASTA = 15;

  let _env = 'sandbox';
  let _plans = [];
  let _priceIds = {};
  let _cargando = null;

  const t = (k, fb, vars) => {
    let out = fb;
    try {
      const v = (window.CM_I18N && window.CM_I18N.t) ? window.CM_I18N.t(k, vars) : null;
      if (v && v !== k) out = v;
    } catch (_e) { /* fallback */ }
    if (vars) for (const n of Object.keys(vars)) out = String(out).split('{' + n + '}').join(vars[n]);
    return out;
  };
  const esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const money = n => '$' + Math.round(Number(n) || 0).toLocaleString('en-US');

  function cargarPaddle() {
    if (window.Paddle) return Promise.resolve(window.Paddle);
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = PADDLE_JS;
      s.onload = () => resolve(window.Paddle);
      s.onerror = () => reject(new Error('paddle'));
      document.head.appendChild(s);
    });
  }

  // Planes, precios y entorno. Una sola vez por carga de página.
  async function cargarDatos() {
    if (_cargando) return _cargando;
    _cargando = (async () => {
      try {
        const { data } = await window.sb.rpc('paddle_env');
        if (data === 'production') _env = 'production';
      } catch (_e) { /* sandbox por defecto */ }

      try {
        await cargarPaddle();
        window.Paddle.Environment.set(_env);
        window.Paddle.Initialize({ token: _env === 'production' ? PADDLE_TOKEN_LIVE : PADDLE_TOKEN_SANDBOX });
      } catch (_e) { /* el modal avisa al intentar cobrar */ }

      const { data: plans } = await window.sb.from('plans')
        .select('slug, name, price_monthly, price_yearly, max_players, sort_order, is_active,' +
                'provider_price_monthly_id, provider_price_yearly_id,' +
                'provider_price_monthly_id_live, provider_price_yearly_id_live')
        .order('sort_order');
      _plans = (plans || []).filter(p => p.is_active !== false);
      _plans.forEach(p => {
        _priceIds[p.slug] = _env === 'production'
          ? { monthly: p.provider_price_monthly_id_live, yearly: p.provider_price_yearly_id_live }
          : { monthly: p.provider_price_monthly_id,      yearly: p.provider_price_yearly_id };
      });
    })();
    return _cargando;
  }

  const planPorSlug = slug => _plans.find(p => p.slug === slug) || null;
  const slugLibre   = () => (_plans.find(p => Number(p.price_monthly) === 0) || { slug: 'initiation' }).slug;

  /* Estado del trial del club. Devuelve null si no hay club o no está de prueba.
     Una suscripción propia gana siempre: un club que ya contrató no está de prueba
     aunque la fecha siga en el futuro. */
  async function trialInfo() {
    if (!window.sb || !window.getClub) return null;
    try {
      const club = await window.getClub();
      if (!club || !club.trial_ends_at) return null;
      const { count } = await window.sb.from('subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('club_id', club.id).in('status', ['active', 'trialing', 'past_due']);
      if (count) return null;
      const fin = new Date(club.trial_ends_at);
      if (isNaN(fin.getTime()) || fin <= new Date()) return { enPrueba: false, dias: 0, finaliza: fin };
      return { enPrueba: true, dias: Math.max(0, Math.ceil((fin - new Date()) / 86400000)), finaliza: fin };
    } catch (_e) { return null; }
  }

  // Categorías con su plantel, para sugerir plan por tamaño.
  async function cargarCategorias(clubId) {
    const teams = (window.getTeams ? await window.getTeams(clubId) : []) || [];
    const { data: players } = await window.sb.from('players').select('team_id').eq('club_id', clubId);
    const cuenta = {};
    (players || []).forEach(p => { if (p.team_id) cuenta[p.team_id] = (cuenta[p.team_id] || 0) + 1; });
    return teams.map(t2 => ({ ...t2, jugadores: cuenta[t2.id] || 0 }));
  }

  // Plan sugerido: las categorías chicas no pagan; las grandes, el intermedio de los
  // de pago — no el más caro, que es lo que haría un formulario que quiere vender.
  function sugerido(team) {
    if (!_plans.length) return slugLibre();
    if (team.jugadores < LIBRE_HASTA) return slugLibre();
    const pagos = _plans.filter(p => Number(p.price_monthly) > 0);
    return (pagos[Math.min(1, pagos.length - 1)] || pagos[0] || { slug: slugLibre() }).slug;
  }

  function inyectarCss() {
    if (document.getElementById('cm-sub-css')) return;
    const st = document.createElement('style');
    st.id = 'cm-sub-css';
    st.textContent = [
      '.cm-sub-ov{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9998;display:grid;place-items:center;padding:20px}',
      '.cm-sub{background:var(--cm-surface,#fff);border:1px solid var(--cm-border);border-radius:16px;',
      '  width:min(560px,100%);max-height:88vh;overflow:auto;box-shadow:0 24px 64px rgba(0,0,0,.28)}',
      '.cm-sub-h{padding:20px 22px 0}',
      '.cm-sub-t{font:700 18px/1.25 var(--cm-font-sans);color:var(--cm-fg-strong)}',
      '.cm-sub-s{font:var(--cm-body-sm);color:var(--cm-fg-muted);margin-top:5px;line-height:1.5}',
      '.cm-sub-cycle{display:inline-flex;gap:2px;margin:16px 22px 0;padding:3px;border:1px solid var(--cm-border);border-radius:99px}',
      '.cm-sub-cycle button{border:0;background:none;cursor:pointer;padding:6px 14px;border-radius:99px;',
      '  font:600 12px/1 var(--cm-font-sans);color:var(--cm-fg-muted)}',
      '.cm-sub-cycle button.is-on{background:var(--cm-accent,#111);color:var(--cm-accent-fg,#fff)}',
      '.cm-sub-save{font:600 10.5px/1 var(--cm-font-sans);color:var(--cm-success,#16a34a);margin-left:6px}',
      '.cm-sub-rows{padding:14px 22px 0;display:flex;flex-direction:column;gap:8px}',
      '.cm-sub-row{display:grid;grid-template-columns:1fr auto auto;align-items:center;gap:10px}',
      '.cm-sub-name{min-width:0;font:600 13px/1.3 var(--cm-font-sans);color:var(--cm-fg-strong);',
      '  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.cm-sub-n{display:block;font:500 11px/1.3 var(--cm-font-sans);color:var(--cm-fg-faint)}',
      '.cm-sub-amt{min-width:74px;text-align:right;font:600 13px/1 var(--cm-font-mono);color:var(--cm-fg-strong)}',
      '.cm-sub-amt.is-free{color:var(--cm-fg-faint);font-weight:500}',
      '.cm-sub-tot{display:flex;align-items:center;justify-content:space-between;gap:12px;',
      '  margin:16px 22px 0;padding:14px 0 0;border-top:1px solid var(--cm-border)}',
      '.cm-sub-tot-l{font:600 13px/1.3 var(--cm-font-sans);color:var(--cm-fg-strong)}',
      '.cm-sub-tot-v{font:700 20px/1 var(--cm-font-sans);color:var(--cm-fg-strong)}',
      '.cm-sub-note{padding:12px 22px 0;font:var(--cm-body-sm);color:var(--cm-fg-muted);line-height:1.5}',
      '.cm-sub-f{display:flex;gap:8px;justify-content:flex-end;padding:18px 22px 20px}',
      '.cm-sub-err{margin:12px 22px 0;padding:9px 12px;border-radius:8px;font:var(--cm-body-sm);',
      '  background:rgba(239,68,68,.1);color:var(--cm-danger,#dc2626)}',
    ].join('');
    document.head.appendChild(st);
  }

  async function open() {
    if (!window.sb || !window.getClubId) return;
    inyectarCss();
    const clubId = await window.getClubId();
    if (!clubId) return;

    const ov = document.createElement('div');
    ov.className = 'cm-sub-ov';
    ov.innerHTML = `<div class="cm-sub" role="dialog" aria-modal="true">
      <div class="cm-sub-h">
        <div class="cm-sub-t">${esc(t('subscribe.title', 'Subscribe your club'))}</div>
        <div class="cm-sub-s">${esc(t('subscribe.loading', 'Loading plans…'))}</div>
      </div></div>`;
    document.body.appendChild(ov);
    const cerrar = () => ov.remove();
    ov.addEventListener('click', e => { if (e.target === ov) cerrar(); });

    await cargarDatos();
    const cats = await cargarCategorias(clubId);
    const trial = await trialInfo();

    if (!_plans.length || !cats.length) {
      ov.querySelector('.cm-sub-s').textContent =
        t('subscribe.unavailable', "Plans aren't available right now. Try again in a moment.");
      return;
    }

    const picks = {};
    cats.forEach(c => { picks[c.id] = sugerido(c); });
    let ciclo = 'monthly';

    function totales() {
      let mensual = 0, anual = 0;
      cats.forEach(c => {
        const p = planPorSlug(picks[c.id]);
        if (!p) return;
        mensual += Number(p.price_monthly) || 0;
        anual   += Number(p.price_yearly)  || 0;
      });
      return { mensual, anual };
    }

    function pintar() {
      const { mensual, anual } = totales();
      const ahorro = mensual * 12 - anual;
      const filas = cats.map(c => {
        const slug = picks[c.id];
        const p = planPorSlug(slug);
        const monto = ciclo === 'annual' ? Number(p && p.price_yearly) : Number(p && p.price_monthly);
        const opts = _plans.map(pl => {
          const pr = ciclo === 'annual' ? Number(pl.price_yearly) : Number(pl.price_monthly);
          return `<option value="${esc(pl.slug)}"${pl.slug === slug ? ' selected' : ''}>` +
            esc(pl.name + (pr > 0 ? ' — ' + money(pr) : ' — ' + t('subscribe.free', 'free'))) + '</option>';
        }).join('');
        return `<div class="cm-sub-row">
          <div class="cm-sub-name">${esc(c.name)}
            <span class="cm-sub-n">${esc(t('subscribe.n_players', '{n} players', { n: c.jugadores }))}</span></div>
          <select class="cm-select" data-team="${esc(c.id)}"
            style="padding:5px 8px;border:1px solid var(--cm-border);border-radius:7px;background:var(--cm-surface);color:var(--cm-fg);font:500 12px/1.3 var(--cm-font-sans)">${opts}</select>
          <div class="cm-sub-amt${monto > 0 ? '' : ' is-free'}">${monto > 0 ? esc(money(monto)) : esc(t('subscribe.free', 'free'))}</div>
        </div>`;
      }).join('');

      const total = ciclo === 'annual' ? anual : mensual;
      const sub = trial && trial.enPrueba
        ? t('subscribe.sub_trial', 'Your trial has {n} days left. Subscribing charges the first period today and ends the trial.', { n: trial.dias })
        : t('subscribe.sub', 'One plan per category. Categories under {n} players stay free.', { n: LIBRE_HASTA });

      ov.querySelector('.cm-sub').innerHTML = `
        <div class="cm-sub-h">
          <div class="cm-sub-t">${esc(t('subscribe.title', 'Subscribe your club'))}</div>
          <div class="cm-sub-s">${esc(sub)}</div>
        </div>
        <div class="cm-sub-cycle">
          <button data-cycle="monthly" class="${ciclo === 'monthly' ? 'is-on' : ''}">${esc(t('subscribe.monthly', 'Monthly'))}</button>
          <button data-cycle="annual" class="${ciclo === 'annual' ? 'is-on' : ''}">${esc(t('subscribe.annual', 'Annual'))}${
            ahorro > 0 ? `<span class="cm-sub-save">${esc(t('subscribe.save', 'save {amount}', { amount: money(ahorro) }))}</span>` : ''}</button>
        </div>
        <div class="cm-sub-rows">${filas}</div>
        <div class="cm-sub-tot">
          <div class="cm-sub-tot-l">${esc(ciclo === 'annual' ? t('subscribe.total_year', 'Total per year') : t('subscribe.total_month', 'Total per month'))}</div>
          <div class="cm-sub-tot-v">${esc(money(total))}</div>
        </div>
        <div class="cm-sub-note">${esc(t('subscribe.note', 'You can change or cancel any category later from Billing.'))}</div>
        <div class="cm-sub-err" id="cmSubErr" hidden></div>
        <div class="cm-sub-f">
          <button class="cm-btn is-outline is-sm" id="cmSubCancel">${esc(t('common.cancel', 'Cancel'))}</button>
          <button class="cm-btn is-primary is-sm" id="cmSubGo"${total > 0 ? '' : ' disabled'}>
            <i class="ti ti-credit-card" style="font-size:15px"></i>
            <span>${esc(t('subscribe.cta', 'Subscribe'))}</span></button>
        </div>`;

      ov.querySelectorAll('[data-cycle]').forEach(b =>
        b.addEventListener('click', () => { ciclo = b.dataset.cycle; pintar(); }));
      ov.querySelectorAll('select[data-team]').forEach(s =>
        s.addEventListener('change', () => { picks[s.dataset.team] = s.value; pintar(); }));
      ov.querySelector('#cmSubCancel').addEventListener('click', cerrar);
      ov.querySelector('#cmSubGo').addEventListener('click', comprar);
    }

    async function comprar() {
      const err = ov.querySelector('#cmSubErr');
      const mostrarErr = m => { err.textContent = m; err.hidden = false; };
      if (!window.Paddle) {
        return mostrarErr(t('subscribe.no_checkout', "Checkout isn't available right now. Try again in a moment."));
      }
      const key = ciclo === 'annual' ? 'yearly' : 'monthly';
      const qty = new Map();
      const pagas = cats.filter(c => Number((planPorSlug(picks[c.id]) || {}).price_monthly) > 0);
      if (!pagas.length) return mostrarErr(t('subscribe.nothing_paid', 'Every category is on a free plan — nothing to charge.'));
      for (const c of pagas) {
        const pid = (_priceIds[picks[c.id]] || {})[key];
        if (!pid) return mostrarErr(t('subscribe.no_checkout', "Checkout isn't available right now. Try again in a moment."));
        qty.set(pid, (qty.get(pid) || 0) + 1);
      }
      // El reparto incluye las categorías gratis: forman parte del club y así el
      // webhook las conoce desde el arranque.
      let teams = cats.map(c => ({ team_id: c.id, plan_slug: picks[c.id] }));
      if (JSON.stringify(teams).length > 4000) teams = pagas.map(c => ({ team_id: c.id, plan_slug: picks[c.id] }));

      const { data: { user } } = await window.sb.auth.getUser();
      const top = pagas.slice().sort((a, b) =>
        Number(planPorSlug(picks[b.id]).price_monthly) - Number(planPorSlug(picks[a.id]).price_monthly))[0];
      try {
        window.Paddle.Checkout.open({
          items: [...qty.entries()].map(([priceId, quantity]) => ({ priceId, quantity })),
          customer: user && user.email ? { email: user.email } : undefined,
          customData: { club_id: clubId, cycle: ciclo, teams },
          settings: {
            displayMode: 'overlay',
            theme: (document.documentElement.getAttribute('data-theme') === 'dark') ? 'dark' : 'light',
            successUrl: window.location.origin + '/Admin.html?welcome=' + encodeURIComponent(picks[top.id]),
          },
        });
        cerrar();
      } catch (_e) {
        mostrarErr(t('subscribe.no_checkout', "Checkout isn't available right now. Try again in a moment."));
      }
    }

    pintar();
  }

  window.CM_SUBSCRIBE = { open, trialInfo };
})();
