/* ============================================================
   ClavaMetrics — Morning triage board — shared behaviors
   Generic wiring shared by the Wellness + Session RPE screens:
   band classification, card expand, segmented tabs, share modal,
   copy/WhatsApp, toast. Screen-specific data and rendering live
   in each HTML file. No Supabase — framework-free.
   ============================================================ */
(function () {
  'use strict';

  const Triage = {};

  /* ── Severity bands ──────────────────────────────────────── */
  // Hooper index 4–28, HIGHER = WORSE. green <12, amber 12–17, red ≥18.
  Triage.bandHooper = function (v) {
    if (v >= 18) return { sev: 'red',   label: 'Alert' };
    if (v >= 12) return { sev: 'amber', label: 'Watch' };
    return { sev: 'green', label: 'Good' };
  };
  // RPE 1–10. ≤4 green, 5–7 amber, ≥8 red.
  Triage.bandRpe = function (v) {
    if (v >= 8) return { sev: 'red',   label: 'High' };
    if (v >= 5) return { sev: 'amber', label: 'Moderate' };
    return { sev: 'green', label: 'Easy' };
  };
  // sub-item 1–7 (higher = worse for Hooper items)
  Triage.subSev = function (v) {
    if (v >= 5) return 'bad';
    if (v >= 4) return 'warn';
    return 'ok';
  };

  /* ── Small builders ──────────────────────────────────────── */
  // 7-segment mini bar column; `v` of 7 lit, height ramps.
  Triage.miniBars = function (v, sev) {
    let out = '';
    for (let i = 1; i <= 7; i++) {
      const on = i <= v ? ' on' : '';
      const h = 8 + i * 2; // 10 → 22px
      out += '<i class="' + on.trim() + '" style="height:' + h + 'px"></i>';
    }
    return '<span class="bars">' + out + '</span>';
  };
  Triage.escape = function (s) {
    return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  };

  /* ── Toast ───────────────────────────────────────────────── */
  let toastEl, toastTimer;
  Triage.toast = function (msg, icon) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'tr-toast';
      document.body.appendChild(toastEl);
    }
    toastEl.innerHTML = '<i class="ti ' + (icon || 'ti-check') + '"></i>' + Triage.escape(msg);
    // reflow then show
    void toastEl.offsetWidth;
    toastEl.classList.add('is-open');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-open'), 2200);
  };

  Triage.copy = function (text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    Triage.toast('Link copied to clipboard', 'ti-clipboard-check');
  };

  Triage.whatsapp = function (message) {
    const url = 'https://wa.me/?text=' + encodeURIComponent(message);
    window.open(url, '_blank', 'noopener');
    Triage.toast('Opening WhatsApp…', 'ti-brand-whatsapp');
  };

  /* ── Tokenized link generator ────────────────────────────── */
  Triage.makeToken = function () {
    const c = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let t = '';
    for (let i = 0; i < 10; i++) t += c[Math.floor(Math.random() * c.length)];
    return t;
  };

  /* ── Generic wiring (runs after DOM ready) ───────────────── */
  function wire() {
    // Card expand — delegate on document
    document.addEventListener('click', function (e) {
      const head = e.target.closest('.pc-head');
      if (head && !e.target.closest('a, button:not(.pc-head), .cm-btn, select')) {
        head.closest('.pc').classList.toggle('is-open');
      }
    });

    // Card-layout toggle (numeric ↔ gauge) — persisted, shared across monitors
    const LAYOUT_KEY = 'cm_card_layout';
    function readLayout() {
      try { return localStorage.getItem(LAYOUT_KEY) === 'gauge' ? 'gauge' : 'numeric'; }
      catch (e) { return 'numeric'; }
    }
    function applyLayout(value) {
      document.querySelectorAll('[data-layout-toggle]').forEach(group => {
        const list = document.querySelector(group.getAttribute('data-layout-toggle'));
        if (list) list.classList.toggle('layout-gauge', value === 'gauge');
        group.querySelectorAll('button').forEach(b => b.classList.toggle('is-active', b.dataset.layout === value));
      });
    }
    document.querySelectorAll('[data-layout-toggle]').forEach(group => {
      group.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => {
          const value = btn.dataset.layout === 'gauge' ? 'gauge' : 'numeric';
          try { localStorage.setItem(LAYOUT_KEY, value); } catch (e) {}
          applyLayout(value);
        });
      });
    });
    applyLayout(readLayout());

    // Segmented tabs → dispatch tr:seg + toggle target sections
    document.querySelectorAll('[data-seg]').forEach(seg => {
      seg.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => {
          seg.querySelectorAll('button').forEach(b => b.classList.remove('is-active'));
          btn.classList.add('is-active');
          const val = btn.dataset.tab;
          document.dispatchEvent(new CustomEvent('tr:seg', { detail: { group: seg.dataset.seg, value: val } }));
        });
      });
    });

    // Modal open/close
    document.querySelectorAll('[data-modal-open]').forEach(btn => {
      btn.addEventListener('click', () => {
        const m = document.getElementById(btn.dataset.modalOpen);
        if (m) m.classList.add('is-open');
      });
    });
    document.addEventListener('click', function (e) {
      const closer = e.target.closest('[data-modal-close]');
      if (closer) { const ov = closer.closest('.tr-overlay'); if (ov) ov.classList.remove('is-open'); }
      if (e.target.classList && e.target.classList.contains('tr-overlay')) e.target.classList.remove('is-open');
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') document.querySelectorAll('.tr-overlay.is-open').forEach(o => o.classList.remove('is-open'));
    });

    // Copy buttons
    document.querySelectorAll('[data-copy]').forEach(btn => {
      btn.addEventListener('click', () => {
        const sel = btn.getAttribute('data-copy');
        let text = sel;
        if (sel.startsWith('#')) {
          const t = document.querySelector(sel);
          const editable = t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT');
          text = t ? (editable ? t.value : t.textContent).trim() : '';
        }
        Triage.copy(text);
      });
    });

    // WhatsApp buttons (delegated so dynamically-rendered cards work)
    document.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-wa]');
      if (btn) Triage.whatsapp(btn.getAttribute('data-wa'));
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire);
  else wire();

  window.Triage = Triage;
})();
