// ClavaMetrics — Shared sidebar component
// Requires: supabase-init.js loaded before this script
// Usage: <div id="hub-side-root"></div> inside .hub-shell

(function () {
  // ── CSS ──────────────────────────────────────────────────────
  if (!document.getElementById('cm-sidebar-css')) {
    const s = document.createElement('style');
    s.id = 'cm-sidebar-css';
    s.textContent = `
.hub-shell{display:grid;grid-template-columns:240px 1fr;min-height:100vh}
.hub-side{background:var(--cm-side-bg);color:var(--cm-side-fg);border-right:1px solid var(--cm-side-border);display:flex;flex-direction:column;position:sticky;top:0;height:100vh;overflow-y:auto}
.hub-main{display:flex;flex-direction:column;min-width:0;background:var(--cm-bg)}
.hub-brand{display:flex;align-items:center;gap:10px;padding:16px 16px 14px;border-bottom:1px solid var(--cm-side-border)}
.hub-brand .mark{width:30px;height:30px;border-radius:7px;background:var(--cm-side-accent);color:var(--cm-side-bg);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.hub-brand .mark svg{width:18px;height:18px}
.hub-brand .body{flex:1;min-width:0}
.hub-brand .name{font:600 14px/1.1 var(--cm-font-sans);letter-spacing:-0.01em;color:var(--cm-side-fg)}
.hub-brand .club{font:500 11.5px/1.2 var(--cm-font-mono);color:var(--cm-side-fg-muted);margin-top:2px}
.hub-brand .switch{width:24px;height:24px;border-radius:6px;border:1px solid var(--cm-side-border);background:transparent;color:var(--cm-side-fg-muted);display:flex;align-items:center;justify-content:center;cursor:pointer}
.hub-brand .switch:hover{background:var(--cm-side-item-active-bg);color:var(--cm-side-fg)}
.hub-brand .switch .ti{font-size:14px}
.hub-nav{padding:8px 10px;flex:1}
.hub-nav-group+.hub-nav-group{margin-top:6px}
.hub-nav-label{font:500 10.5px/1 var(--cm-font-sans);letter-spacing:0.08em;text-transform:uppercase;color:var(--cm-side-fg-muted);padding:10px 10px 6px}
.hub-nav-item{display:flex;align-items:center;gap:10px;padding:6.5px 10px;border-radius:var(--cm-r-3);color:var(--cm-side-fg-muted);text-decoration:none;font:500 13.5px/1 var(--cm-font-sans);cursor:pointer;transition:background var(--cm-dur-1),color var(--cm-dur-1)}
.hub-nav-item:hover{background:var(--cm-side-item-active-bg);color:var(--cm-side-fg)}
.hub-nav-item .ti{font-size:17px;flex-shrink:0;opacity:0.95}
.hub-nav-item .count{margin-left:auto;font:500 11.5px/1 var(--cm-font-mono);color:var(--cm-side-fg-muted)}
.hub-nav-item.is-active{background:var(--cm-side-item-active-bg);color:var(--cm-side-item-active-fg)}
.hub-nav-item.is-active .count{color:var(--cm-side-item-active-fg);opacity:0.8}
.hub-side-foot{border-top:1px solid var(--cm-side-border);padding:10px}
.hub-user{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:var(--cm-r-3);cursor:pointer}
.hub-user:hover{background:var(--cm-side-item-active-bg)}
.hub-user .av{width:28px;height:28px;border-radius:50%;background:var(--cm-side-accent);color:var(--cm-side-bg);display:flex;align-items:center;justify-content:center;font:600 11px/1 var(--cm-font-sans);flex-shrink:0}
.hub-user .who{flex:1;min-width:0}
.hub-user .who .name{font:600 13px/1.2 var(--cm-font-sans);color:var(--cm-side-fg);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hub-user .who .role{font:500 11px/1.2 var(--cm-font-mono);color:var(--cm-side-fg-muted);margin-top:2px}
.hub-user .ti{font-size:14px;color:var(--cm-side-fg-muted)}
    `;
    document.head.appendChild(s);
  }

  // ── NAV DEFINITION ───────────────────────────────────────────
  const NAV_GROUPS = [
    { label: 'Overview', items: [
      { href: 'Hub.html',               icon: 'ti-home',             label: 'Staff Hub' },
      { href: 'Calendar.html',          icon: 'ti-calendar-stats',   label: 'Calendar' },
      { href: 'Chat%20%26%20Tasks.html',icon: 'ti-message-circle',   label: 'Chat &amp; tasks' },
    ]},
    { label: 'Technical', items: [
      { href: 'Planner.html',           icon: 'ti-clipboard-list',   label: 'Planner' },
      { href: 'Sessions%20Library.html',icon: 'ti-list-tree',         label: 'Sessions library' },
      { href: 'Daily%20Planning.html',  icon: 'ti-soccer-field',     label: 'Daily planning' },
      { href: 'Sessions%20History.html',icon: 'ti-history',           label: 'Sessions history' },
      { href: 'Squad.html',             icon: 'ti-users-group',      label: 'Squad' },
      { href: 'Availability.html',      icon: 'ti-user-check',       label: 'Availability' },
      { href: 'Evaluations.html',       icon: 'ti-chart-dots',       label: 'Evaluations' },
      { href: 'Match%20Reports.html',   icon: 'ti-report-analytics', label: 'Match reports' },
    ]},
    { label: 'Performance', items: [
      { href: 'Wellness.html',          icon: 'ti-heartbeat',        label: 'Wellness' },
      { href: 'RPE.html',               icon: 'ti-activity',         label: 'RPE' },
      { href: 'Load%20Monitor.html',    icon: 'ti-chart-line',       label: 'Load monitor' },
      { href: 'GPS%20Analysis.html',    icon: 'ti-radar-2',          label: 'GPS analysis' },
      { href: 'Gym%20Planner.html',     icon: 'ti-barbell',          label: 'Gym planner' },
      { href: 'Gym%20Library.html',     icon: 'ti-books',            label: 'Gym library' },
      { href: 'Nutrition.html',         icon: 'ti-apple',            label: 'Nutrition' },
    ]},
    { label: 'Medical', items: [
      { href: 'Injuries.html',          icon: 'ti-bandage',          label: 'Injuries' },
      { href: 'Physio.html',            icon: 'ti-stethoscope',      label: 'Physio' },
    ]},
    { label: 'Workspace', items: [
      { href: '#', icon: 'ti-settings', label: 'Settings', extra: 'data-open-settings' },
      { href: 'Admin.html',             icon: 'ti-user-shield',      label: 'Admin' },
    ]},
  ];

  // ── ACTIVE PAGE DETECTION ────────────────────────────────────
  function currentPage() {
    return decodeURIComponent(window.location.pathname.split('/').pop());
  }

  function isActive(href) {
    const page = currentPage();
    const target = decodeURIComponent(href);
    return page === target || (page === '' && target === 'Hub.html');
  }

  // ── RENDER ───────────────────────────────────────────────────
  function renderNav() {
    return NAV_GROUPS.map(g => `
      <div class="hub-nav-group">
        <div class="hub-nav-label">${g.label}</div>
        ${g.items.map(item => {
          const active = isActive(item.href) ? ' is-active' : '';
          const extra  = item.extra ? ` ${item.extra}` : '';
          return `<a class="hub-nav-item${active}" href="${item.href}"${extra}><i class="ti ${item.icon}"></i><span>${item.label}</span></a>`;
        }).join('')}
      </div>`).join('');
  }

  function renderSidebar() {
    return `
    <aside class="hub-side">
      <div class="hub-brand">
        <div class="mark">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 18V10"/><path d="M12 18V5"/><path d="M19 18v-9"/>
          </svg>
        </div>
        <div class="body">
          <div class="name" id="sideClubName">ClavaMetrics</div>
          <div class="club">First team · 2025/26</div>
        </div>
        <button class="switch" title="Switch club"><i class="ti ti-selector"></i></button>
      </div>
      <nav class="hub-nav">${renderNav()}</nav>
      <div class="hub-side-foot">
        <div class="hub-user" id="sideUserBtn" role="button" tabindex="0" aria-label="User menu">
          <div class="av" id="userInitials">–</div>
          <div class="who">
            <div class="name" id="userName">Loading…</div>
            <div class="role" id="userRole"></div>
          </div>
          <i class="ti ti-logout" id="sideLogoutIcon" title="Sign out"></i>
        </div>
      </div>
    </aside>`;
  }

  // ── INJECT ───────────────────────────────────────────────────
  function inject() {
    const root = document.getElementById('hub-side-root');
    if (!root) return;
    root.outerHTML = renderSidebar();

    document.getElementById('sideUserBtn')?.addEventListener('click', () => {
      if (typeof window.logout === 'function') window.logout();
    });
  }

  // ── LOAD USER/CLUB DATA ──────────────────────────────────────
  async function loadData() {
    const [profile, club] = await Promise.all([
      typeof window.getProfile === 'function' ? window.getProfile() : Promise.resolve(null),
      typeof window.getClub    === 'function' ? window.getClub()    : Promise.resolve(null),
    ]);

    const nameEl     = document.getElementById('sideClubName');
    const initialsEl = document.getElementById('userInitials');
    const userNameEl = document.getElementById('userName');
    const userRoleEl = document.getElementById('userRole');

    if (nameEl && club?.name)         nameEl.textContent = club.name;
    if (profile) {
      const full     = profile.full_name || '';
      const initials = full.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '–';
      if (initialsEl) initialsEl.textContent = initials;
      if (userNameEl) userNameEl.textContent = full || '–';
      if (userRoleEl) userRoleEl.textContent = [profile.role, profile.club_role].filter(Boolean).join(' · ') || 'Staff';
    }
  }

  // ── BOOT ─────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { inject(); loadData(); });
  } else {
    inject();
    loadData();
  }
})();
