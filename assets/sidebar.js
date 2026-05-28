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
/* Notifications */
.cm-nb{position:relative;display:inline-flex}
.cm-nbadge{position:absolute;top:-4px;right:-4px;min-width:16px;height:16px;padding:0 4px;background:#DC2626;color:#fff;border-radius:8px;font:700 10px/16px monospace;text-align:center;display:none;pointer-events:none;z-index:1}
.cm-np{position:absolute;right:0;top:calc(100% + 8px);width:360px;max-height:480px;background:var(--cm-surface,#fff);border:1px solid var(--cm-border,#e5e7eb);border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.18);z-index:500;display:none;flex-direction:column;overflow:hidden}
.cm-np.is-open{display:flex}
.cm-np-h{display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid var(--cm-border,#e5e7eb);flex-shrink:0}
.cm-np-h .ttl{font:600 13px/1 var(--cm-font-sans,sans-serif);color:var(--cm-fg-strong,#111);flex:1}
.cm-np-h .mark-all{font:500 11px/1 var(--cm-font-sans,sans-serif);color:var(--cm-accent,#6366f1);background:transparent;border:0;cursor:pointer;padding:4px 6px;border-radius:5px}
.cm-np-h .mark-all:hover{background:var(--cm-bg-soft,#f4f4f5)}
.cm-np-list{overflow-y:auto;flex:1}
.cm-np-empty{padding:32px 16px;text-align:center;font:500 13px/1.4 var(--cm-font-sans,sans-serif);color:var(--cm-fg-muted,#6b7280)}
.cm-ni{display:flex;align-items:flex-start;gap:10px;padding:11px 14px;border-bottom:1px solid var(--cm-border-soft,#f3f4f6);cursor:pointer;text-decoration:none;transition:background .1s}
.cm-ni:hover{background:var(--cm-bg-soft,#f4f4f5)}
.cm-ni.unread{background:color-mix(in srgb,var(--cm-accent,#6366f1) 7%,transparent)}
.cm-ni-ico{width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:15px}
.cm-ni-ico.physio{background:rgba(220,38,38,.1);color:#B91C1C}
.cm-ni-ico.task{background:rgba(99,102,241,.1);color:#4f46e5}
.cm-ni-ico.injury{background:rgba(245,158,11,.1);color:#B45309}
.cm-ni-ico.session{background:rgba(34,197,94,.1);color:#15803D}
.cm-ni-ico.def{background:var(--cm-bg-soft,#f4f4f5);color:var(--cm-fg-muted,#6b7280)}
.cm-ni-body{flex:1;min-width:0}
.cm-ni-title{font:600 12.5px/1.3 var(--cm-font-sans,sans-serif);color:var(--cm-fg-strong,#111);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cm-ni-desc{font:500 11.5px/1.4 var(--cm-font-sans,sans-serif);color:var(--cm-fg-muted,#6b7280);margin-top:2px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.cm-ni-time{font:500 10.5px/1 var(--cm-font-mono,monospace);color:var(--cm-fg-faint,#9ca3af);margin-top:4px}
.cm-ni-dot{width:7px;height:7px;border-radius:50%;background:#DC2626;flex-shrink:0;margin-top:3px;align-self:flex-start}
.cm-np-foot{padding:10px 14px;border-top:1px solid var(--cm-border,#e5e7eb);display:flex;justify-content:center;flex-shrink:0}
.cm-np-foot a{font:600 12px/1 var(--cm-font-sans,sans-serif);color:var(--cm-accent,#6366f1);text-decoration:none;padding:6px 12px;border-radius:6px}
.cm-np-foot a:hover{background:var(--cm-bg-soft,#f4f4f5)}
#cm-toast-root{position:fixed;top:68px;right:16px;z-index:600;display:flex;flex-direction:column;gap:8px;pointer-events:none}
.cm-toast{display:flex;align-items:flex-start;gap:10px;padding:12px 14px;background:var(--cm-surface,#fff);border:1px solid var(--cm-border,#e5e7eb);border-radius:10px;box-shadow:0 4px 20px rgba(0,0,0,.15);min-width:280px;max-width:360px;pointer-events:all;animation:cmSI .2s ease}
@keyframes cmSI{from{transform:translateX(16px);opacity:0}to{transform:translateX(0);opacity:1}}
.cm-toast-ico{width:28px;height:28px;border-radius:7px;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:14px}
.cm-toast-body{flex:1;min-width:0}
.cm-toast-ttl{font:600 13px/1.2 var(--cm-font-sans,sans-serif);color:var(--cm-fg-strong,#111)}
.cm-toast-desc{font:500 12px/1.3 var(--cm-font-sans,sans-serif);color:var(--cm-fg-muted,#6b7280);margin-top:2px}
.cm-toast-x{width:22px;height:22px;border:0;background:transparent;color:var(--cm-fg-muted,#6b7280);cursor:pointer;border-radius:5px;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:13px}
.cm-toast-x:hover{background:var(--cm-bg-soft,#f4f4f5)}
/* Chat notifications */
.cm-cb{position:relative;display:inline-flex}
.cm-cbadge{position:absolute;top:-4px;right:-4px;min-width:16px;height:16px;padding:0 4px;background:#DC2626;color:#fff;border-radius:8px;font:700 10px/16px monospace;text-align:center;display:none;pointer-events:none;z-index:1}
.cm-cp{position:absolute;right:0;top:calc(100% + 8px);width:340px;max-height:440px;background:var(--cm-surface,#fff);border:1px solid var(--cm-border,#e5e7eb);border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.18);z-index:500;display:none;flex-direction:column;overflow:hidden}
.cm-cp.is-open{display:flex}
.cm-cp-h{display:flex;align-items:center;padding:12px 14px;border-bottom:1px solid var(--cm-border,#e5e7eb);flex-shrink:0}
.cm-cp-h .ttl{font:600 13px/1 var(--cm-font-sans,sans-serif);color:var(--cm-fg-strong,#111);flex:1}
.cm-cp-sect-lbl{font:500 10px/1 var(--cm-font-mono,monospace);letter-spacing:.08em;text-transform:uppercase;color:var(--cm-fg-muted,#6b7280);padding:10px 14px 4px}
.cm-ci{display:flex;align-items:center;gap:10px;padding:9px 14px;cursor:pointer;text-decoration:none;transition:background .1s;background:transparent;border:0;width:100%;text-align:left}
.cm-ci:hover{background:var(--cm-bg-soft,#f4f4f5)}
.cm-ci-av{width:28px;height:28px;border-radius:50%;background:rgba(99,102,241,.1);color:#4f46e5;display:flex;align-items:center;justify-content:center;font:600 11px/1 var(--cm-font-sans,sans-serif);flex-shrink:0}
.cm-ci-av.grp{border-radius:8px}
.cm-ci-body{flex:1;min-width:0}
.cm-ci-name{font:600 12.5px/1.2 var(--cm-font-sans,sans-serif);color:var(--cm-fg-strong,#111);display:flex;justify-content:space-between;align-items:center;gap:4px}
.cm-ci-name .time{font:400 10.5px/1 var(--cm-font-mono,monospace);color:var(--cm-fg-faint,#9ca3af);flex-shrink:0}
.cm-ci-preview{font:500 11.5px/1.3 var(--cm-font-sans,sans-serif);color:var(--cm-fg-muted,#6b7280);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cm-ci-count{min-width:18px;height:18px;border-radius:999px;background:var(--cm-accent,#6366f1);color:#fff;display:flex;align-items:center;justify-content:center;font:600 10px/1 var(--cm-font-mono,monospace);padding:0 4px;flex-shrink:0}
.cm-cp-empty{padding:28px 16px;text-align:center;font:500 13px/1.4 var(--cm-font-sans,sans-serif);color:var(--cm-fg-muted,#6b7280)}
.cm-cp-foot{padding:10px 14px;border-top:1px solid var(--cm-border,#e5e7eb);display:flex;justify-content:center;flex-shrink:0}
.cm-cp-foot a{font:600 12px/1 var(--cm-font-sans,sans-serif);color:var(--cm-accent,#6366f1);text-decoration:none;padding:6px 12px;border-radius:6px}
.cm-cp-foot a:hover{background:var(--cm-bg-soft,#f4f4f5)}
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
      { href: 'Physio.html',            icon: 'ti-stethoscope',      label: 'Treatments' },
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

  // ── LOGO HELPER ──────────────────────────────────────────────
  const _MARK_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 18V10"/><path d="M12 18V5"/><path d="M19 18v-9"/></svg>`;

  function applyLogoToMark(markEl, logoUrl) {
    if (logoUrl) {
      markEl.style.background = 'transparent';
      const img = document.createElement('img');
      img.src = logoUrl;
      img.alt = '';
      img.style.cssText = 'width:100%;height:100%;object-fit:contain;border-radius:5px';
      img.onerror = () => { markEl.style.background = ''; markEl.innerHTML = _MARK_SVG; };
      markEl.innerHTML = '';
      markEl.appendChild(img);
    } else {
      markEl.style.background = '';
      markEl.innerHTML = _MARK_SVG;
    }
  }

  document.addEventListener('clublogochanged', e => {
    const markEl = document.querySelector('.hub-brand .mark');
    if (markEl) applyLogoToMark(markEl, e.detail.logo_url);
  });

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
    const markEl = document.querySelector('.hub-brand .mark');
    if (markEl) applyLogoToMark(markEl, club?.logo_url);
    if (profile) {
      const full     = profile.full_name || '';
      const initials = full.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '–';
      if (initialsEl) initialsEl.textContent = initials;
      if (userNameEl) userNameEl.textContent = full || '–';
      if (userRoleEl) userRoleEl.textContent = [profile.role, profile.club_role].filter(Boolean).join(' · ') || 'Staff';
    }
  }

  // ── NOTIFICATIONS ────────────────────────────────────────────
  let _notifData = [];

  function _notifIcon(type) {
    const map = { physio: ['physio','ti-stethoscope'], task: ['task','ti-checkbox'], injury: ['injury','ti-bandage'], session: ['session','ti-soccer-field'] };
    const [cls, icon] = map[type] || ['def','ti-bell'];
    return `<div class="cm-ni-ico ${cls}"><i class="ti ${icon}"></i></div>`;
  }

  function _relTime(iso) {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d === 1) return 'Yesterday';
    return `${d}d ago`;
  }

  function _updateNotifBadge() {
    const unread = _notifData.filter(n => !n.read).length;
    const badge = document.getElementById('cm-nbadge');
    if (!badge) return;
    badge.textContent = unread > 99 ? '99+' : unread;
    badge.style.display = unread > 0 ? 'block' : 'none';
  }

  function _renderNotifList() {
    const list = document.getElementById('cm-np-list');
    if (!list) return;
    if (!_notifData.length) {
      list.innerHTML = '<div class="cm-np-empty">No notifications yet</div>';
      return;
    }
    list.innerHTML = _notifData.map(n => `
      <a class="cm-ni${n.read ? '' : ' unread'}" data-nid="${n.id}" href="${n.link || '#'}">
        ${_notifIcon(n.type)}
        <div class="cm-ni-body">
          <div class="cm-ni-title">${n.title}</div>
          ${n.body ? `<div class="cm-ni-desc">${n.body}</div>` : ''}
          <div class="cm-ni-time">${_relTime(n.created_at)}</div>
        </div>
        ${n.read ? '' : '<div class="cm-ni-dot"></div>'}
      </a>`).join('');
  }

  function _closeNotifPanel() {
    document.getElementById('cm-np')?.classList.remove('is-open');
  }

  function _showNotifToast(notif) {
    const root = document.getElementById('cm-toast-root');
    if (!root) return;
    const types = { physio: ['physio','ti-stethoscope'], task: ['task','ti-checkbox'], injury: ['injury','ti-bandage'], session: ['session','ti-soccer-field'] };
    const [cls, icon] = types[notif.type] || ['def','ti-bell'];
    const toast = document.createElement('div');
    toast.className = 'cm-toast';
    toast.innerHTML = `
      <div class="cm-toast-ico cm-ni-ico ${cls}"><i class="ti ${icon}"></i></div>
      <div class="cm-toast-body">
        <div class="cm-toast-ttl">${notif.title}</div>
        ${notif.body ? `<div class="cm-toast-desc">${notif.body}</div>` : ''}
      </div>
      <button class="cm-toast-x" aria-label="Dismiss"><i class="ti ti-x"></i></button>`;
    toast.querySelector('.cm-toast-x').addEventListener('click', () => toast.remove());
    root.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
  }

  async function _initNotifications() {
    // Wait up to 4 s for window.sb to be initialised
    let attempts = 0;
    while (!window.sb && attempts < 20) { await new Promise(r => setTimeout(r, 200)); attempts++; }
    if (!window.sb) return;

    const { data: { user } } = await window.sb.auth.getUser();
    if (!user) return;

    // Toast root
    if (!document.getElementById('cm-toast-root')) {
      const tr = document.createElement('div');
      tr.id = 'cm-toast-root';
      document.body.appendChild(tr);
    }

    // Find bell button in header
    const bellBtn = [...document.querySelectorAll('.cm-icon-btn')].find(b => b.querySelector('.ti-bell'));
    if (!bellBtn) return;

    // Wrap bell in .cm-nb to allow absolute-positioned badge + panel
    const wrap = document.createElement('div');
    wrap.className = 'cm-nb';
    wrap.style.cssText = 'position:relative;display:inline-flex';
    bellBtn.parentNode.insertBefore(wrap, bellBtn);
    wrap.appendChild(bellBtn);

    // Badge
    const badge = document.createElement('span');
    badge.id = 'cm-nbadge';
    badge.className = 'cm-nbadge';
    wrap.appendChild(badge);

    // Panel
    const panel = document.createElement('div');
    panel.id = 'cm-np';
    panel.className = 'cm-np';
    panel.innerHTML = `
      <div class="cm-np-h">
        <span class="ttl">Notifications</span>
        <button class="mark-all" id="cm-mark-all">Mark all read</button>
      </div>
      <div class="cm-np-list" id="cm-np-list"></div>
      <div class="cm-np-foot"><a href="#">View all</a></div>`;
    wrap.appendChild(panel);

    // Load last 30 notifications
    const { data: notifs } = await window.sb
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30);
    _notifData = notifs || [];
    _renderNotifList();
    _updateNotifBadge();

    // Bell click → toggle panel
    bellBtn.addEventListener('click', e => {
      e.stopPropagation();
      panel.classList.toggle('is-open');
    });

    // Click outside → close
    document.addEventListener('click', e => {
      if (!wrap.contains(e.target)) _closeNotifPanel();
    });

    // Notification item click → mark read, then navigate
    panel.addEventListener('click', async e => {
      const item = e.target.closest('.cm-ni[data-nid]');
      if (!item) return;
      const nid = item.dataset.nid;
      const notif = _notifData.find(n => n.id === nid);
      if (notif && !notif.read) {
        notif.read = true;
        _renderNotifList();
        _updateNotifBadge();
        await window.sb.from('notifications').update({ read: true }).eq('id', nid);
      }
      if (notif?.link && notif.link !== '#') {
        e.preventDefault();
        window.location.href = notif.link;
      }
    });

    // Mark all read
    document.getElementById('cm-mark-all')?.addEventListener('click', async () => {
      const unreadIds = _notifData.filter(n => !n.read).map(n => n.id);
      if (!unreadIds.length) return;
      _notifData.forEach(n => { n.read = true; });
      _renderNotifList();
      _updateNotifBadge();
      await window.sb.from('notifications').update({ read: true }).in('id', unreadIds);
    });

    // Realtime — new notifications pushed to this user
    window.sb.channel(`cm-notifs-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, payload => {
        _notifData.unshift(payload.new);
        _renderNotifList();
        _updateNotifBadge();
        _showNotifToast(payload.new);
      })
      .subscribe();
  }

  // ── CHAT NOTIFICATIONS ────────────────────────────────────────
  let _chatUnread = {};

  function _escHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function _updateChatBadge() {
    const badge = document.getElementById('cm-cbadge');
    if (!badge) return;
    const total = Object.values(_chatUnread).reduce((s, v) => s + v.count, 0);
    badge.textContent = total > 9 ? '9+' : total;
    badge.style.display = total > 0 ? 'block' : 'none';
  }

  function _renderChatPanel() {
    const list = document.getElementById('cm-cp-list');
    if (!list) return;
    const entries = Object.entries(_chatUnread).sort((a, b) => (b[1].lastAt || '') > (a[1].lastAt || '') ? 1 : -1);
    if (!entries.length) { list.innerHTML = '<div class="cm-cp-empty">No unread messages</div>'; return; }
    const dmEntries = entries.filter(([k]) => k !== 'group');
    const grpEntry  = entries.find(([k]) => k === 'group');
    let html = '';
    if (dmEntries.length) {
      html += `<div class="cm-cp-sect-lbl">Direct messages</div>`;
      for (const [, d] of dmEntries) {
        const ini = (d.senderName || '?').split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
        html += `<button class="cm-ci" data-chat-nav="1">
          <div class="cm-ci-av">${_escHtml(ini)}</div>
          <div class="cm-ci-body">
            <div class="cm-ci-name"><span>${_escHtml(d.senderName || 'Unknown')}</span><span class="time">${_relTime(d.lastAt)}</span></div>
            <div class="cm-ci-preview">${_escHtml((d.lastMsg || '').slice(0,40))}</div>
          </div>
          <div class="cm-ci-count">${d.count > 9 ? '9+' : d.count}</div>
        </button>`;
      }
    }
    if (grpEntry) {
      const d = grpEntry[1];
      html += `<div class="cm-cp-sect-lbl">Team channel</div>`;
      html += `<button class="cm-ci" data-chat-nav="1">
        <div class="cm-ci-av grp"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div>
        <div class="cm-ci-body">
          <div class="cm-ci-name"><span># team</span><span class="time">${_relTime(d.lastAt)}</span></div>
          <div class="cm-ci-preview">${d.senderName ? _escHtml(d.senderName)+': ' : ''}${_escHtml((d.lastMsg||'').slice(0,40))}</div>
        </div>
        <div class="cm-ci-count">${d.count > 9 ? '9+' : d.count}</div>
      </button>`;
    }
    list.innerHTML = html;
  }

  function _showChatToast(msg, senderName) {
    const root = document.getElementById('cm-toast-root');
    if (!root) return;
    const ini = (senderName || '?').split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
    const isGroup = !msg.recipient_id;
    const t = document.createElement('div');
    t.className = 'cm-toast';
    t.style.cursor = 'pointer';
    t.innerHTML = `
      <div class="cm-toast-ico" style="background:rgba(99,102,241,.12);color:#4f46e5;border-radius:50%;font:600 11px/1 var(--cm-font-sans,sans-serif)">${_escHtml(ini)}</div>
      <div class="cm-toast-body">
        <div class="cm-toast-ttl">${_escHtml(senderName || 'Message')}${isGroup ? ' · #team' : ''}</div>
        <div class="cm-toast-desc">${_escHtml((msg.content || '').slice(0,60))}</div>
      </div>
      <button class="cm-toast-x" aria-label="Dismiss"><i class="ti ti-x"></i></button>`;
    t.querySelector('.cm-toast-x').addEventListener('click', e => { e.stopPropagation(); t.remove(); });
    t.addEventListener('click', () => { t.remove(); window.location.href = 'Chat%20%26%20Tasks.html'; });
    root.appendChild(t);
    setTimeout(() => t.remove(), 4000);
  }

  async function _initChatNotif() {
    let attempts = 0;
    while (!window.sb && attempts < 20) { await new Promise(r => setTimeout(r, 200)); attempts++; }
    if (!window.sb) return;
    const { data: { user } } = await window.sb.auth.getUser();
    if (!user) return;
    const { data: profile } = await window.sb.from('profiles').select('club_id').eq('id', user.id).single();
    const clubId = profile?.club_id;
    if (!clubId) return;

    // Inject chat button before the bell
    const bellBtn = [...document.querySelectorAll('.cm-icon-btn')].find(b => b.querySelector('.ti-bell'));
    if (!bellBtn) return;
    const chatBtn = document.createElement('button');
    chatBtn.className = 'cm-icon-btn';
    chatBtn.title = 'Messages';
    chatBtn.setAttribute('aria-label', 'Messages');
    chatBtn.innerHTML = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
    const wrap = document.createElement('div');
    wrap.className = 'cm-cb';
    bellBtn.parentNode.insertBefore(wrap, bellBtn);
    wrap.appendChild(chatBtn);
    const badge = document.createElement('span');
    badge.id = 'cm-cbadge';
    badge.className = 'cm-cbadge';
    wrap.appendChild(badge);
    const panel = document.createElement('div');
    panel.id = 'cm-cp';
    panel.className = 'cm-cp';
    panel.innerHTML = `
      <div class="cm-cp-h"><span class="ttl">Messages</span></div>
      <div id="cm-cp-list" style="overflow-y:auto;flex:1;max-height:360px"></div>
      <div class="cm-cp-foot"><a href="Chat%20%26%20Tasks.html">Open Chat</a></div>`;
    wrap.appendChild(panel);

    // Expose mark-read for Chat & Tasks to call
    window.cmChatMarkRead = key => {
      delete _chatUnread[key];
      _updateChatBadge();
      _renderChatPanel();
    };

    // Initial unread counts
    const [{ data: reads }, { data: recentMsgs }] = await Promise.all([
      window.sb.from('channel_reads').select('channel_key,last_read_at').eq('user_id', user.id).eq('club_id', clubId),
      window.sb.from('messages').select('id,sender_id,recipient_id,content,created_at,sender_name')
        .eq('club_id', clubId).neq('sender_id', user.id)
        .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString())
        .order('created_at', { ascending: false }).limit(200)
    ]);
    const readMap = {};
    (reads || []).forEach(r => { readMap[r.channel_key] = r.last_read_at; });
    for (const msg of (recentMsgs || [])) {
      const isGroup = !msg.recipient_id;
      if (!isGroup && msg.recipient_id !== user.id) continue;
      const key = isGroup ? 'group' : msg.sender_id;
      const lr = readMap[key];
      if (lr && msg.created_at <= lr) continue;
      if (!_chatUnread[key]) _chatUnread[key] = { count: 0, lastMsg: '', lastAt: '', senderName: '' };
      _chatUnread[key].count += 1;
      if (!_chatUnread[key].lastAt || msg.created_at > _chatUnread[key].lastAt) {
        _chatUnread[key].lastMsg    = msg.content || '';
        _chatUnread[key].lastAt     = msg.created_at;
        _chatUnread[key].senderName = msg.sender_name || '';
      }
    }
    _renderChatPanel();
    _updateChatBadge();

    // Realtime
    window.sb.channel(`cm-chat-notif-${clubId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `club_id=eq.${clubId}` }, payload => {
        const msg = payload.new;
        if (!msg || msg.sender_id === user.id) return;
        const isGroup = !msg.recipient_id;
        if (!isGroup && msg.recipient_id !== user.id) return;
        const key = isGroup ? 'group' : msg.sender_id;
        if (!_chatUnread[key]) _chatUnread[key] = { count: 0, lastMsg: '', lastAt: '', senderName: '' };
        _chatUnread[key].count += 1;
        _chatUnread[key].lastMsg    = msg.content || '';
        _chatUnread[key].lastAt     = msg.created_at;
        _chatUnread[key].senderName = msg.sender_name || '';
        _updateChatBadge();
        _renderChatPanel();
        _showChatToast(msg, msg.sender_name || 'Unknown');
      })
      .subscribe();

    chatBtn.addEventListener('click', e => {
      e.stopPropagation();
      panel.classList.toggle('is-open');
      document.getElementById('cm-np')?.classList.remove('is-open');
    });
    document.addEventListener('click', e => {
      if (!wrap.contains(e.target)) panel.classList.remove('is-open');
    });
    panel.addEventListener('click', e => {
      if (e.target.closest('[data-chat-nav]')) window.location.href = 'Chat%20%26%20Tasks.html';
    });
  }

  // ── BOOT ─────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { inject(); loadData(); _initNotifications(); _initChatNotif(); });
  } else {
    inject();
    loadData();
    _initNotifications();
    _initChatNotif();
  }
})();
