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
@media(max-width:768px){
  .hub-shell{grid-template-columns:1fr}
  .hub-side{position:fixed;top:0;left:0;height:100vh;z-index:300;transform:translateX(-100%);transition:transform .25s ease;width:240px;box-shadow:4px 0 24px rgba(0,0,0,.18)}
  .hub-shell.sidebar-open .hub-side{transform:translateX(0)}
  .cm-sidebar-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:299}
  .hub-shell.sidebar-open .cm-sidebar-overlay{display:block}
  .cm-sidebar-toggle{display:flex;position:fixed;top:10px;left:10px;z-index:298;width:36px;height:36px;align-items:center;justify-content:center;background:var(--cm-surface);border:1px solid var(--cm-border);border-radius:8px;cursor:pointer;color:var(--cm-fg);box-shadow:0 1px 4px rgba(0,0,0,.1)}
  .cm-sidebar-toggle .ti{font-size:18px}
  .hub-shell.sidebar-open .cm-sidebar-toggle{left:252px}
}
@media(min-width:769px){
  .cm-sidebar-toggle{display:none}
  .cm-sidebar-overlay{display:none}
}
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
.hub-logout-btn{display:flex;align-items:center;gap:8px;width:100%;padding:7px 10px;border-radius:var(--cm-r-3);border:0;background:transparent;color:var(--cm-side-fg-muted);font:500 13px/1 var(--cm-font-sans);cursor:pointer;margin-top:2px}
.hub-logout-btn:hover{background:var(--cm-side-item-active-bg);color:var(--cm-danger)}
.hub-logout-btn .ti{font-size:15px}
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
      { href: 'Sessions%20Library.html',icon: 'ti-list-tree',         label: 'Exercise library' },
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
          <div class="name" id="sideClubName"></div>
          <div class="club" id="sideTeamLabel"></div>
        </div>
        <button class="switch" title="Switch club"><i class="ti ti-selector"></i></button>
      </div>
      <nav class="hub-nav">${renderNav()}</nav>
      <div class="hub-side-foot">
        <div class="hub-user" id="sideUserBtn">
          <div class="av" id="userInitials">–</div>
          <div class="who">
            <div class="name" id="userName">Loading…</div>
            <div class="role" id="userRole"></div>
          </div>
        </div>
        <button class="hub-logout-btn" id="sideLogoutBtn" aria-label="Sign out">
          <i class="ti ti-logout"></i><span>Sign out</span>
        </button>
      </div>
    </aside>`;
  }

  // ── INJECT ───────────────────────────────────────────────────
  function inject() {
    const root = document.getElementById('hub-side-root');
    if (!root) return;
    root.outerHTML = renderSidebar();

    // Mobile: overlay + hamburger toggle
    if (!document.querySelector('.cm-sidebar-overlay')) {
      const overlay = document.createElement('div');
      overlay.className = 'cm-sidebar-overlay';
      overlay.setAttribute('aria-hidden', 'true');
      document.body.appendChild(overlay);
    }
    if (!document.querySelector('.cm-sidebar-toggle')) {
      const toggle = document.createElement('button');
      toggle.className = 'cm-sidebar-toggle';
      toggle.setAttribute('aria-label', 'Open navigation');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.innerHTML = '<i class="ti ti-menu-2"></i>';
      document.body.appendChild(toggle);
    }

    function openSidebar() {
      document.querySelector('.hub-shell')?.classList.add('sidebar-open');
      const btn = document.querySelector('.cm-sidebar-toggle');
      if (btn) { btn.setAttribute('aria-expanded', 'true'); btn.setAttribute('aria-label', 'Close navigation'); btn.innerHTML = '<i class="ti ti-x"></i>'; }
    }
    function closeSidebar() {
      document.querySelector('.hub-shell')?.classList.remove('sidebar-open');
      const btn = document.querySelector('.cm-sidebar-toggle');
      if (btn) { btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-label', 'Open navigation'); btn.innerHTML = '<i class="ti ti-menu-2"></i>'; }
    }

    document.querySelector('.cm-sidebar-toggle')?.addEventListener('click', () => {
      document.querySelector('.hub-shell')?.classList.contains('sidebar-open') ? closeSidebar() : openSidebar();
    });
    document.querySelector('.cm-sidebar-overlay')?.addEventListener('click', closeSidebar);

    // Close on nav link click (mobile UX)
    document.querySelector('.hub-side')?.addEventListener('click', e => {
      if (e.target.closest('.hub-nav-item') && window.innerWidth <= 768) closeSidebar();
    });

    document.getElementById('sideLogoutBtn')?.addEventListener('click', () => {
      if (typeof window.logout === 'function') window.logout();
    });
  }

  // ── LOAD USER/CLUB DATA ──────────────────────────────────────
  async function loadData() {
    const [profile, club] = await Promise.all([
      typeof window.getProfile === 'function' ? window.getProfile() : Promise.resolve(null),
      typeof window.getClub    === 'function' ? window.getClub()    : Promise.resolve(null),
    ]);

    const nameEl      = document.getElementById('sideClubName');
    const teamLabelEl = document.getElementById('sideTeamLabel');
    const initialsEl  = document.getElementById('userInitials');
    const userNameEl  = document.getElementById('userName');
    const userRoleEl  = document.getElementById('userRole');

    if (nameEl && club?.name)         nameEl.textContent = club.name;
    if (teamLabelEl && profile?.club_role) teamLabelEl.textContent = profile.club_role;
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
