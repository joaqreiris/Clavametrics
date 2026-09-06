/* =============================================================
   gp-tabs.js — Fase 3: dashboard tab management.

   Responsibilities:
     • Links the 5 predefined .gp-sec buttons to their DB rows
       (adds data-dashboard-id + kebab menu).
     • Renders extra custom dashboards as new .gp-sec buttons
       + empty .gp-view[data-view="db-{id}"] containers.
     • Adds the "+" new-dashboard button.
     • Rename (inline), Duplicate, Delete for every dashboard.
     • Card drag-to-reorder within a grid (updates position in DB).

   Depends on: gp-persist.js (window.loadDashboards, etc.)
   ============================================================= */
(function () {
  'use strict';

  // Map report_type → data-view key used in the existing HTML
  const REPORT_TYPE_TO_VIEW = {
    ind: 'ind', grp: 'grp', mind: 'mind', mgrp: 'mgrp', mc: 'mc',
  };
  // Icon per report_type (matches existing HTML icons)
  const VIEW_ICON = {
    ind:  'ti-user', grp: 'ti-users-group', mind: 'ti-ball-football',
    mgrp: 'ti-activity-heartbeat', mc: 'ti-arrows-diff',
  };

  let _clubId  = null;
  let _userId  = null;
  let _userRole = null;
  let _initStarted = false;   // 'admin' | 'coach' | 'physio' | ...
  let _dashboards = [];   // loaded from DB
  let _menuEl  = null;
  let _menuBkEl = null;
  let _menuOwner = null;
  let _teams = [];              // [{id,name}] club teams (for the share picker + badges)
  let _teamNameById = {};       // team_id -> name
  let _myTeamIds = [];          // teams the current user belongs to (member_teams)

  // ── Helpers ──────────────────────────────────────────────────

  function esc(s) {
    return String(s == null ? '' : s).replace(/[<>&"']/g, c =>
      ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c])
    );
  }

  const tt = (k, f, v) => { const t = (window.CM_I18N && CM_I18N.t) ? CM_I18N.t(k, v) : null; return (t && t !== k) ? t : f; };

  // Visibility badge for a custom dashboard tab: personal (you) · team (name) · club (default).
  function visBadge(d) {
    if (d.is_shared && d.team_id) {
      const nm = _teamNameById[d.team_id] || tt('gps_analysis.dash_team', 'Team');
      return `<span class="gpt-badge team" title="${esc(nm)}"><i class="ti ti-users-group"></i>${esc(nm)}</span>`;
    }
    if (d.is_shared) return `<span class="gpt-badge club" title="${esc(tt('gps_analysis.dash_club', 'Whole club'))}"><i class="ti ti-building-community"></i></span>`;
    return `<span class="gpt-badge personal" title="${esc(tt('gps_analysis.dash_personal', 'Personal'))}"><i class="ti ti-user"></i></span>`;
  }

  // Mirror of the SQL role_bucket(): owner/admin→admin, physio/…→medical,
  // sc_coach/fitness_coach→sc, coach/assistant_coach/gk_coach→coach.
  function roleBucket(r) {
    switch ((r || '').toLowerCase()) {
      case 'owner': case 'admin': return 'admin';
      case 'medical': case 'physio': case 'doctor': case 'nutritionist': return 'medical';
      case 'sc_coach': case 'fitness_coach': return 'sc';
      case 'coach': case 'assistant_coach': case 'gk_coach': return 'coach';
      case 'analyst': return 'analyst';
      default: return 'staff';
    }
  }

  // Mirrors can_edit_dashboard() so the UI shows the right affordances (RLS is the real gate).
  function canManage(dash) {
    if (!dash) return false;
    if (roleBucket(_userRole) === 'admin') return true;                 // admin/owner
    if (dash.owner_id === _userId || dash.created_by === _userId) return true;   // owner/creator
    // shared boards (club-wide default OR a team) → editable by S&C/Fitness/coaches;
    // a team board additionally requires membership in that team.
    if (dash.is_shared && ['sc', 'coach'].includes(roleBucket(_userRole))
        && (!dash.team_id || _myTeamIds.includes(String(dash.team_id)))) return true;
    return false;
  }

  function showPermissionError() {
    const toast = document.getElementById('gpbToast');
    if (!toast) return;
    document.getElementById('gpbToastTitle').textContent = 'Permission denied';
    document.getElementById('gpbToastSub').textContent   = 'Only admins and coaches can modify shared dashboards.';
    document.getElementById('gpbToastAct').textContent   = 'OK';
    toast.classList.add('is-on');
    setTimeout(() => toast.classList.remove('is-on'), 4000);
  }

  function waitForClubId(maxMs = 12000) {
    return new Promise((resolve, reject) => {
      const t0 = Date.now();
      (function check() {
        if (window._gpClubId) return resolve(window._gpClubId);
        if (Date.now() - t0 > maxMs) return reject(new Error('gpt: timeout'));
        setTimeout(check, 300);
      })();
    });
  }

  // ── Tab switching (piggybacks on existing #sections listener) ─

  function switchToView(viewKey) {
    const btn = document.querySelector(`#sections .gp-sec[data-view="${viewKey}"]`);
    if (btn) {
      btn.click(); // fires the existing listener in GPS Analysis.html
    } else {
      // custom view: manually activate
      document.querySelectorAll('#sections .gp-sec').forEach(b => b.classList.remove('is-on'));
      const newBtn = document.querySelector(`#sections .gp-sec[data-view="${viewKey}"]`);
      if (newBtn) newBtn.classList.add('is-on');
      document.querySelectorAll('.gp-view').forEach(v =>
        v.classList.toggle('is-on', v.dataset.view === viewKey)
      );
      const dashBar = document.querySelector('.gp-dash-bar');
      if (dashBar) dashBar.dataset.view = viewKey;
    }
  }

  // ── Enhance predefined tabs with data-dashboard-id + kebab ──

  function enhancePredefinedTabs(dashboards) {
    const sectionsEl = document.getElementById('sections');
    if (!sectionsEl) return;

    dashboards.forEach(d => {
      const viewKey = REPORT_TYPE_TO_VIEW[d.report_type];
      if (!viewKey) return; // custom dashboard handled separately

      const btn = sectionsEl.querySelector(`.gp-sec[data-view="${viewKey}"]`);
      if (!btn || btn.dataset.dashboardId) return; // already processed

      btn.dataset.dashboardId = d.id;

      // Add kebab button (appended to .row, not wrapping anything)
      const row = btn.querySelector('.row');
      if (row) {
        const kb = document.createElement('button');
        kb.className = 'gpt-kb';
        kb.title = 'Dashboard options';
        kb.innerHTML = '<i class="ti ti-dots"></i>';
        kb.addEventListener('click', e => { e.stopPropagation(); openMenu(kb, d); });
        row.appendChild(kb);
      }

      // Mount builder cards for this predefined view (source='builder' only; catalog cards are in HTML)
      const viewEl = document.querySelector(`.gp-view[data-view="${viewKey}"]`);
      const grid   = viewEl?.querySelector('.gp-grid');
      if (grid && !grid.dataset.gptBuilderMounted) {
        const builderCards = (d.cards || []).filter(c => c.source === 'builder');
        builderCards.forEach(card => { const el = _buildCardElement(card); if (el) grid.appendChild(el); });
        if (builderCards.length) {
          grid.dataset.gptBuilderMounted = '1';
          wireCardDrag(grid, d.id);
          setTimeout(() => {
            grid.querySelectorAll('.gp-c[data-card-id]').forEach(el => {
              if (window.GpBuilder?.resolveAndRenderCard && el.__config) {
                window.GpBuilder.resolveAndRenderCard(el, el.__config);
              }
            });
          }, 800);
        }
      }
    });
  }

  // ── Render custom dashboards (no predefined report_type match) ─

  function renderCustomTabs(dashboards) {
    const sectionsEl = document.getElementById('sections');
    const pageEl     = document.querySelector('.gp-page');
    if (!sectionsEl || !pageEl) return;

    // remove old custom tabs/views first (re-render on reload)
    sectionsEl.querySelectorAll('.gp-sec[data-custom]').forEach(b => b.remove());
    document.querySelectorAll('.gp-view[data-custom]').forEach(v => v.remove());

    const customDashes = dashboards.filter(d => !REPORT_TYPE_TO_VIEW[d.report_type]);
    customDashes.forEach(d => {
      const viewKey = `db-${d.id}`;

      // Tab button
      const btn = document.createElement('button');
      btn.className = 'gp-sec';
      btn.dataset.view = viewKey;
      btn.dataset.dashboardId = d.id;
      btn.dataset.custom = '1';
      btn.innerHTML = `
        <div class="row">
          <i class="ti ti-layout-dashboard"></i>
          <span class="gpt-tab-label">${esc(d.name)}</span>
          ${visBadge(d)}
          <button class="gpt-kb" title="Dashboard options"><i class="ti ti-dots"></i></button>
        </div>
        <div class="sub">${(d._cardCount ?? d.cards?.length ?? 0)} card${(d._cardCount ?? d.cards?.length ?? 0) !== 1 ? 's' : ''}</div>`;

      btn.addEventListener('click', e => {
        if (e.target.closest('.gpt-kb')) return;
        switchToView(viewKey);
      });
      btn.querySelector('.gpt-kb')?.addEventListener('click', e => {
        e.stopPropagation();
        openMenu(btn.querySelector('.gpt-kb'), d);
      });
      sectionsEl.insertBefore(btn, sectionsEl.querySelector('.gpt-addtab'));

      // Empty view placeholder
      const view = document.createElement('div');
      view.className = 'gp-view';
      view.dataset.view = viewKey;
      view.dataset.custom = '1';
      view.innerHTML = `
        <div class="gp-grid">
          <div class="gpt-empty-view" data-size="full" style="grid-column:span 12">
            <div class="ic"><i class="ti ti-layout-dashboard"></i></div>
            <div class="t">${esc(d.name)}</div>
            <div class="d">This dashboard is empty. Use <b>Chart builder</b> to add cards.</div>
          </div>
        </div>`;
      // inject before the last existing .gp-view or at end of .gp-page
      const lastView = pageEl.querySelector('.gp-view:last-of-type');
      if (lastView) lastView.after(view);
      else pageEl.appendChild(view);

      // mount any saved builder cards into this view's grid
      if (typeof window.loadCardsForView === 'function' && window.sb) {
        // custom dashboards use dashboard_id directly (not report_type)
        _mountCardsForDashboard(d, view.querySelector('.gp-grid'));
      }
    });
  }

  async function _mountCardsForDashboard(dash, grid) {
    if (!grid) return;
    try {
      const { data: cards } = await window.sb
        .from('dashboard_cards')
        .select('id, config, size, position, source')
        .eq('dashboard_id', dash.id)
        .order('position', { ascending: true });

      if (cards?.length) {
        for (const card of cards) {
          const el = _buildCardElement(card);
          if (el) grid.appendChild(el);   // null = card de catálogo que ya no está disponible
        }
        wireCardDrag(grid, dash.id);

        setTimeout(() => {
          grid.querySelectorAll('.gp-c[data-card-id]').forEach(el => {
            if (window.GpBuilder?.resolveAndRenderCard && el.__config) {
              window.GpBuilder.resolveAndRenderCard(el, el.__config);
            }
          });
        }, 800);
      }
      syncEmptyState(grid);   // single source of truth: placeholder + tab count
    } catch (e) { console.warn('gpt _mountCardsForDashboard:', e); }
  }

  // ── Empty-state + tab count: single source of truth ───────────
  // Counts the real (non-draft) builder cards in a custom dashboard's grid, then
  // shows/hides the "empty" placeholder and updates the tab's "N cards" label.
  // Call after mounting, saving, or deleting a card. Accepts any element inside
  // the view (a card, the grid, or the .gp-view itself).
  function syncEmptyState(ref) {
    const view = ref && ref.closest
      ? (ref.classList?.contains('gp-view') ? ref : ref.closest('.gp-view'))
      : null;
    if (!view) return;
    const viewKey = view.dataset.view || '';
    if (!viewKey.startsWith('db-')) return;   // only custom dashboards carry the placeholder
    const grid = view.querySelector('.gp-grid');
    if (!grid) return;

    const count = grid.querySelectorAll('.gp-c:not(.is-draft)').length;
    const ph    = grid.querySelector('.gpt-empty-view');
    if (count > 0) {
      ph?.closest('[data-size]')?.remove();
    } else if (!ph) {
      const dash = _dashboards.find(d => `db-${d.id}` === viewKey);
      const name = esc(dash?.name || 'Dashboard');
      grid.insertAdjacentHTML('beforeend',
        `<div class="gpt-empty-view" data-size="full" style="grid-column:span 12">
           <div class="ic"><i class="ti ti-layout-dashboard"></i></div>
           <div class="t">${name}</div>
           <div class="d">This dashboard is empty. Use <b>Chart builder</b> to add cards.</div>
         </div>`);
    }

    const sub = document.querySelector(`.gp-sec[data-view="${viewKey}"] .sub`);
    if (sub) sub.textContent = `${count} card${count !== 1 ? 's' : ''}`;

    const dash = _dashboards.find(d => `db-${d.id}` === viewKey);
    if (dash) dash._cardCount = count;   // keep tab re-renders consistent
  }
  window.gptSyncEmptyState = syncEmptyState;

  // ── "+" add-dashboard button ──────────────────────────────────

  function renderAddTabButton() {
    const sectionsEl = document.getElementById('sections');
    if (!sectionsEl || sectionsEl.querySelector('.gpt-addtab')) return;

    const btn = document.createElement('button');
    btn.className = 'gpt-addtab';
    btn.innerHTML = '<i class="ti ti-plus"></i>New';
    btn.title = 'Create a new dashboard';
    btn.addEventListener('click', createDashboardFlow);
    sectionsEl.appendChild(btn);
  }

  function createDashboardFlow() {
    if (!_clubId || !window.createDashboard || !window.sb) return;
    openCreateDashboardModal();
  }

  async function _doCreateDashboard(name, shared, teamId) {
    try {
      const d = await window.createDashboard(name || tt('gps_analysis.dash_new', 'New dashboard'), _clubId, _userId, window.sb, { shared, teamId });
      _dashboards.push({ ...d, created_by: _userId, owner_id: _userId, is_shared: shared, team_id: shared ? teamId : null, cards: [] });
      reRender();
      const viewKey = `db-${d.id}`;
      switchToView(viewKey);
    } catch (e) { console.warn('gpt createDashboard:', e); showPermissionError(); }
  }

  // Teams the user may share TO: admins → all club teams; everyone else → their own memberships.
  function _shareableTeams() {
    if (roleBucket(_userRole) === 'admin') return _teams.slice();
    return _teams.filter(t => _myTeamIds.includes(String(t.id)));
  }

  function openCreateDashboardModal() {
    document.getElementById('gptCreateBk')?.remove();
    const teams = _shareableTeams();
    const activeTeam = String(window._gpTeamId || '');
    const defTeam = teams.find(t => String(t.id) === activeTeam)?.id || teams[0]?.id || '';
    const bk = document.createElement('div');
    bk.id = 'gptCreateBk';
    bk.className = 'gpt-create-bk';
    bk.innerHTML = `
      <div class="gpt-create" role="dialog" aria-modal="true">
        <div class="gpt-create-h">${esc(tt('gps_analysis.dash_create_title', 'New dashboard'))}</div>
        <label class="gpt-create-lbl">${esc(tt('gps_analysis.dash_name', 'Name'))}</label>
        <input id="gptDashName" class="gpt-create-in" type="text" value="${esc(tt('gps_analysis.dash_new', 'New dashboard'))}" autocomplete="off">
        <label class="gpt-create-lbl">${esc(tt('gps_analysis.dash_visibility', 'Visibility'))}</label>
        <div class="gpt-vis" id="gptVis">
          <button type="button" class="gpt-vis-opt is-on" data-vis="personal">
            <i class="ti ti-user"></i><span>${esc(tt('gps_analysis.dash_personal', 'Personal'))}</span>
            <small>${esc(tt('gps_analysis.dash_personal_hint', 'Only you'))}</small>
          </button>
          <button type="button" class="gpt-vis-opt${teams.length ? '' : ' is-disabled'}" data-vis="team"${teams.length ? '' : ' disabled'}>
            <i class="ti ti-users-group"></i><span>${esc(tt('gps_analysis.dash_team', 'Team'))}</span>
            <small>${esc(teams.length ? tt('gps_analysis.dash_team_hint', "The team's staff") : tt('gps_analysis.dash_no_teams', 'No teams'))}</small>
          </button>
        </div>
        <div class="gpt-create-team" id="gptTeamWrap" style="display:none">
          <label class="gpt-create-lbl">${esc(tt('gps_analysis.dash_which_team', 'Which team'))}</label>
          <select id="gptTeamSel" class="gpt-create-in">${teams.map(t => `<option value="${esc(t.id)}"${String(t.id) === String(defTeam) ? ' selected' : ''}>${esc(t.name)}</option>`).join('')}</select>
        </div>
        <div class="gpt-create-f">
          <button type="button" class="gpt-create-btn ghost" id="gptCancel">${esc(tt('common.cancel', 'Cancel'))}</button>
          <button type="button" class="gpt-create-btn primary" id="gptCreate">${esc(tt('gps_analysis.dash_create', 'Create'))}</button>
        </div>
      </div>`;
    document.body.appendChild(bk);
    if (window.CM_I18N) CM_I18N.applyTo(bk);

    let vis = 'personal';
    const teamWrap = bk.querySelector('#gptTeamWrap');
    bk.querySelectorAll('.gpt-vis-opt').forEach(b => b.addEventListener('click', () => {
      if (b.classList.contains('is-disabled')) return;
      vis = b.dataset.vis;
      bk.querySelectorAll('.gpt-vis-opt').forEach(o => o.classList.toggle('is-on', o === b));
      teamWrap.style.display = vis === 'team' ? '' : 'none';
    }));
    const close = () => bk.remove();
    bk.addEventListener('mousedown', e => { if (e.target === bk) close(); });
    bk.querySelector('#gptCancel').addEventListener('click', close);
    bk.querySelector('#gptCreate').addEventListener('click', () => {
      const name = bk.querySelector('#gptDashName').value.trim();
      const shared = vis === 'team';
      const teamId = shared ? (bk.querySelector('#gptTeamSel')?.value || null) : null;
      close();
      _doCreateDashboard(name, shared, teamId);
    });
    const nameEl = bk.querySelector('#gptDashName');
    nameEl.focus(); nameEl.select();
    nameEl.addEventListener('keydown', e => { if (e.key === 'Enter') bk.querySelector('#gptCreate').click(); if (e.key === 'Escape') close(); });
  }

  // ── Kebab dropdown ────────────────────────────────────────────

  function ensureMenuEl() {
    if (_menuEl) return;
    _menuEl = document.createElement('div');
    _menuEl.className = 'gpt-menu';
    document.body.appendChild(_menuEl);

    _menuBkEl = document.createElement('div');
    _menuBkEl.className = 'gpt-menu-bk';
    _menuBkEl.addEventListener('click', closeMenu);
    document.body.appendChild(_menuBkEl);
  }

  function openMenu(trigger, dash) {
    ensureMenuEl();
    if (_menuOwner === trigger) { closeMenu(); return; }
    closeMenu();

    // CUALQUIER dashboard se puede borrar, también los cinco que vienen de fábrica: el club
    // decide qué quiere ver. La única guarda es no quedarse sin ninguno, y el permiso de siempre.
    // (ensureDefaultDashboards ya no re-siembra los que falten, así que el borrado persiste.)
    const canDelete    = _dashboards.length > 1 && canManage(dash);
    const canRename    = canManage(dash);

    _menuEl.classList.remove('gpt-icon-menu');   // in case it was left in icon-picker mode
    _menuEl.innerHTML = `
      ${canRename ? '<button class="gpt-menu-item" data-act="rename"><i class="ti ti-pencil"></i>Rename</button>' : ''}
      <button class="gpt-menu-item" data-act="icon"><i class="ti ti-mood-smile"></i>${tt('gps_analysis.dash_change_icon', 'Change icon')}</button>
      <button class="gpt-menu-item" data-act="duplicate"><i class="ti ti-copy"></i>Duplicate</button>
      ${canDelete ? '<div class="gpt-menu-div"></div><button class="gpt-menu-item danger" data-act="delete"><i class="ti ti-trash"></i>Delete dashboard</button>' : ''}
    `;
    _menuEl.querySelectorAll('[data-act]').forEach(b => {
      b.addEventListener('click', () => {
        const act = b.dataset.act;
        if (act === 'icon') { openIconPicker(trigger, dash); return; }   // keeps the popover open
        closeMenu();
        if (act === 'rename')    startRenameFromDash(dash);
        else if (act === 'duplicate') duplicateFlow(dash);
        else if (act === 'delete')    deleteFlow(dash);
      });
    });

    _menuBkEl.classList.add('is-on');
    _menuEl.style.visibility = 'hidden';
    _menuEl.classList.add('is-open');
    const r = trigger.getBoundingClientRect();
    let left = r.left, top = r.bottom + 4;
    if (left + 180 > innerWidth - 12) left = innerWidth - 184;
    if (top + 120 > innerHeight - 12) top = r.top - 120;
    _menuEl.style.left = left + 'px';
    _menuEl.style.top  = top  + 'px';
    _menuEl.style.visibility = '';
    _menuOwner = trigger;
  }

  function closeMenu() {
    if (_menuEl) _menuEl.classList.remove('is-open');
    if (_menuBkEl) _menuBkEl.classList.remove('is-on');
    _menuOwner = null;
  }

  // ── Rename ────────────────────────────────────────────────────

  function startRenameFromDash(dash) {
    const viewKey = REPORT_TYPE_TO_VIEW[dash.report_type] || `db-${dash.id}`;
    const btn = document.querySelector(`#sections .gp-sec[data-view="${viewKey}"]`);
    if (btn) startRename(btn, dash);
  }

  function startRename(btn, dash) {
    const labelEl = btn.querySelector('.gpt-tab-label') || btn.querySelector('.row');
    if (!labelEl) return;

    const originalHTML = labelEl.innerHTML;
    const currentName = dash.name;

    labelEl.innerHTML = `<input class="gpt-rename" type="text" value="${esc(currentName)}" maxlength="60">`;
    const input = labelEl.querySelector('input');
    input.focus();
    input.select();

    let committed = false;
    const commit = async () => {
      if (committed) return;
      committed = true;
      const newName = input.value.trim();
      if (newName && newName !== currentName) {
        dash.name = newName;
        try { await window.renameDashboard(dash.id, newName, window.sb); }
        catch (e) { console.warn('gpt renameDashboard:', e); }
      }
      reRender();
    };

    input.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); commit(); }
      if (e.key === 'Escape') { committed = true; reRender(); }
    });
    input.addEventListener('blur', commit);
    input.addEventListener('click', e => e.stopPropagation());
  }

  // ── Duplicate ─────────────────────────────────────────────────

  async function duplicateFlow(dash) {
    if (!window.duplicateDashboard || !window.sb) return;
    try {
      const newDash = await window.duplicateDashboard(dash.id, _clubId, _userId, window.sb);
      _dashboards.push({ ...newDash, report_type: null, cards: [], created_by: _userId });
      reRender();
      switchToView(`db-${newDash.id}`);
    } catch (e) {
      console.warn('gpt duplicateFlow:', e);
      showPermissionError();
    }
  }

  // ── Delete ────────────────────────────────────────────────────

  async function deleteFlow(dash) {
    if (!window.deleteDashboard || !window.sb) return;
    if (_dashboards.length <= 1) return;
    if (!canManage(dash)) { showPermissionError(); return; }
    // Borrar un dashboard se lleva sus cards y no se puede deshacer: se pregunta, con el nombre
    // delante, porque ahora también alcanza a los de fábrica.
    const _msg = tt('gps_analysis.dash_delete_confirm',
      'Delete this dashboard? Its cards go with it and this cannot be undone.');
    if (typeof window.confirm === 'function' && !window.confirm(`${dash.name || ''}\n\n${_msg}`)) return;

    const idx = _dashboards.indexOf(dash);
    _dashboards.splice(idx, 1);

    const fallback = _dashboards[Math.max(0, idx - 1)];
    const fallbackView = REPORT_TYPE_TO_VIEW[fallback?.report_type] || `db-${fallback?.id}`;
    switchToView(fallbackView);
    reRender();

    try { await window.deleteDashboard(dash.id, window.sb); }
    catch (e) {
      console.warn('gpt deleteDashboard:', e);
      // rollback local state on server error
      _dashboards.splice(idx, 0, dash);
      reRender();
      showPermissionError();
    }
  }

  // ── Pending-save tracker (beforeunload guard) ────────────────

  const _pendingSaves = new Set();

  function trackSave(promise) {
    _pendingSaves.add(promise);
    promise.finally(() => _pendingSaves.delete(promise));
  }

  window.addEventListener('beforeunload', e => {
    if (_pendingSaves.size > 0) {
      e.preventDefault();
      e.returnValue = 'Card order is still saving. Are you sure you want to leave?';
    }
  });

  // ── Card drag-to-reorder ──────────────────────────────────────

  // Native HTML5 drag-to-reorder REMOVED. It coexisted with gp-canvas.js's pointer
  // free-canvas move on the SAME card, required draggable="true" (which fired a
  // native dragstart even during a pointer move) and added .gpt-dragging (opacity:.45)
  // whose native dragend never ran when the pointer-drag handled the drop → the card
  // stayed faded. Card moves are 100% pointer-based now (gp-canvas.js).
  function wireCardDrag() { /* no-op: see comment above */ }

  function wireAllGridDrags() {
    // Native drag-to-reorder removed (moves are pointer-based, gp-canvas.js). No
    // longer set draggable="true" on cards — that attribute is what fired the native
    // dragstart and left .gpt-dragging (opacity:.45) stuck. Nothing to wire here.
  }

  // ── Card element builder (for custom dashboards) ──────────────

  /**
   * Card de CATÁLOGO adoptada por un dashboard propio (config.schema = 'gp.static/v1').
   * No se construye nada: la card ya existe una sola vez en el HTML de la página, con su lógica
   * atada a su id, así que se la trae hasta este grid. La fila de dashboard_cards sólo guarda
   * cuál es y dónde va; `rowId` la ata a esa fila para poder moverla o borrarla después.
   * Devuelve null si el elemento no está (otro dashboard se la llevó primero).
   */
  function _adoptStaticCard(card) {
    const staticId = card.config?.staticId;
    if (!staticId) return null;
    const el = document.getElementById(staticId)
      || document.querySelector(`.gp-c[data-card-id="${String(staticId).replace(/^card-/, '')}"]`)
      || window.gpCardStash?.get?.(staticId) || null;
    if (!el) return null;
    window.gpCardStash?.delete?.(staticId);
    el.dataset.rowId = card.id;
    const cv = card.config?.style?.canvas;
    if (cv && ['x', 'y', 'w', 'h'].every(k => Number.isFinite(cv[k])) && window.gpCanvas?.applyCoords) {
      window.gpCanvas.applyCoords(el, { x: cv.x, y: cv.y, w: cv.w, h: cv.h });
    }
    return el;
  }

  function _buildCardElement(card) {
    if (card.config?.schema === 'gp.static/v1') return _adoptStaticCard(card);
    const config = card.config || {};
    const el = document.createElement('div');
    el.className = 'gp-c';
    el.dataset.size     = card.size || config.style?.size || 'md';
    el.dataset.card     = 'chart';
    el.dataset.cardId   = card.id;
    el.__config         = config;
    // No draggable="true": moves are pointer-based (gp-canvas.js); the native
    // dragstart left .gpt-dragging (opacity:.45) stuck.
    // Width: prefer a saved span, else derive from the size bucket.
    const _span = config.style?.span
      || (window.gpSpanFromSize ? window.gpSpanFromSize(el.dataset.size, false) : null);
    if (_span) el.dataset.span = String(_span);
    // Free-canvas coordinates persisted GLOBALLY with the card (config.style.canvas). Seeding the
    // dataset + CSS vars here makes gp-canvas freeze this exact placement instead of auto-flowing,
    // so a custom dashboard reproduces its arrangement on reload, on duplicate (config is copied),
    // and for every user who opens a shared club dashboard.
    const _cv = config.style?.canvas;
    if (_cv && ['x','y','w','h'].every(k => Number.isFinite(_cv[k]))) {
      el.dataset.x = _cv.x; el.dataset.y = _cv.y; el.dataset.w = _cv.w; el.dataset.h = _cv.h;
      el.style.setProperty('--gp-x', _cv.x); el.style.setProperty('--gp-y', _cv.y);
      el.style.setProperty('--gp-w', _cv.w); el.style.setProperty('--gp-h', _cv.h);
    }
    el.style.setProperty('--cm-accent', config.style?.color || '#15803D');
    const title = esc(config.title || config.viz || '');
    // Make the comparison explicit on the header when set, so raw-value cards (comparison
    // null) are never confused with % cards. mc shows the generic label here (the builder
    // draft shows the precise MC name).
    const _CMP_LBL = { role:'vs role baseline', match:'vs match peak', md:'vs same MD code', mc:'vs microcycle' };
    const _cmpBadge = config.comparison?.baseline ? ` · ${_CMP_LBL[config.comparison.baseline] || 'vs baseline'}` : '';
    el.innerHTML = `
      <div class="gp-c-h">
        <span class="ttl">${title}</span>
        <span class="sub">${esc(config.viz || '')} · ${esc(config.scope?.level || '')}${_cmpBadge}</span>
        <div class="right">
          <button data-edit title="Edit card"><i class="ti ti-pencil"></i></button>
          <button data-del title="Remove"><i class="ti ti-x"></i></button>
        </div>
      </div>
      <div class="gp-c-b" style="min-height:120px;align-items:center;justify-content:center">
        <div class="cb2-state load" style="min-height:100px"><div class="cb2-spin"></div><div class="t">Loading…</div></div>
      </div>`;

    // size is changed by dragging the corner handle (gp-resize.js seeds it
    // via the MutationObserver on the grid once this element is attached)

    // Title/subtitle format (Paso 3a/3b). Constants-based scaling means it's safe even though `el`
    // is still detached from the DOM. For KPI (viz='kpi') the header here is a no-op (its .l/.sb
    // aren't rendered yet + this header gets stripped) — mountKpiCard formats the KPI body instead.
    window.gpApplyHeaderFormat?.(el, config.style, config.viz);

    el.querySelector('[data-edit]')?.addEventListener('click', () => {
      if (window.GpBuilder?.openForEdit) window.GpBuilder.openForEdit(el);
    });

    el.querySelector('[data-del]')?.addEventListener('click', () => {
      if (!window.confirm(window.tt ? window.tt('gp.card.deleteConfirm', 'Delete this card? This cannot be undone.') : 'Delete this card? This cannot be undone.')) return;
      const host = el.closest('.gp-view');
      el.remove();
      syncEmptyState(host);
      if (window.deleteDashboardCard && card.id) {
        window.deleteDashboardCard(card.id, window.sb).catch(e => console.warn('gpt deleteDashboardCard:', e));
      }
    });

    return el;
  }

  // ── Personal tab order (per-user, localStorage) ───────────────
  // Reordering tabs is a personal navigation preference: it's saved locally per user+club and
  // never touches the DB or other users' view. Tabs not in the saved list (newly created) fall
  // to the end; the "+ New" button (.gpt-addtab) always stays last.

  function _tabOrderKey() { return `cm_gp_taborder_${_userId || '?'}_${_clubId || '?'}`; }
  function _loadTabOrder() {
    try { const v = JSON.parse(localStorage.getItem(_tabOrderKey()) || '[]'); return Array.isArray(v) ? v : []; }
    catch (_) { return []; }
  }
  function _persistCurrentTabOrder() {
    const sectionsEl = document.getElementById('sections');
    if (!sectionsEl) return;
    const order = [...sectionsEl.querySelectorAll('.gp-sec[data-view]')].map(t => t.dataset.view).filter(Boolean);
    try { localStorage.setItem(_tabOrderKey(), JSON.stringify(order)); } catch (_) {}
  }
  function applyTabOrder() {
    const sectionsEl = document.getElementById('sections');
    if (!sectionsEl) return;
    const order = _loadTabOrder();
    if (!order.length) return;
    const addtab = sectionsEl.querySelector('.gpt-addtab') || null;
    const byView = new Map([...sectionsEl.querySelectorAll('.gp-sec[data-view]')].map(t => [t.dataset.view, t]));
    order.forEach(v => { const t = byView.get(v); if (t) { sectionsEl.insertBefore(t, addtab); byView.delete(v); } });
    byView.forEach(t => sectionsEl.insertBefore(t, addtab));   // uncovered (new) tabs → end
    if (addtab) sectionsEl.appendChild(addtab);
  }

  // Drag-to-reorder. HTML5 DnD is safe here — tabs live outside any gp-canvas grid, so the
  // pointer free-canvas engine (which suppresses native dragstart only inside .gp-grid.is-canvas)
  // never interferes. Click-to-switch still fires normally when there's no drag.
  let _tabDrag = null;
  function wireTabDrag() {
    const sectionsEl = document.getElementById('sections');
    if (!sectionsEl) return;
    sectionsEl.querySelectorAll('.gp-sec[data-view]').forEach(tab => {
      if (tab.dataset.gptDragWired) return;
      tab.dataset.gptDragWired = '1';
      tab.setAttribute('draggable', 'true');
      tab.addEventListener('dragstart', e => {
        _tabDrag = tab; tab.classList.add('gpt-tab-dragging');
        try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', tab.dataset.view || ''); } catch (_) {}
      });
      tab.addEventListener('dragend', () => {
        tab.classList.remove('gpt-tab-dragging');
        if (_tabDrag) { _persistCurrentTabOrder(); _tabDrag = null; }
      });
      tab.addEventListener('dragover', e => {
        if (!_tabDrag || _tabDrag === tab) return;
        e.preventDefault();
        const r = tab.getBoundingClientRect();
        const after = e.clientX > r.left + r.width / 2;
        sectionsEl.insertBefore(_tabDrag, after ? tab.nextSibling : tab);
      });
    });
  }

  // ── Personal tab icons (per-user, localStorage) ───────────────
  // Same rationale as the order: a tab's icon is a personal preference, saved locally per
  // user+club and applied over the tab's default icon (predefined or custom). No DB, no
  // permissions — uniform for the 5 fixed tabs and custom dashboards alike.
  const TAB_ICONS = [
    'ti-user', 'ti-users-group', 'ti-ball-football', 'ti-activity-heartbeat', 'ti-arrows-diff', 'ti-layout-dashboard',
    'ti-chart-bar', 'ti-chart-line', 'ti-route', 'ti-run', 'ti-gauge', 'ti-brand-speedtest',
    'ti-bolt', 'ti-flame', 'ti-heart', 'ti-target', 'ti-clock', 'ti-stopwatch',
    'ti-calendar', 'ti-clipboard-data', 'ti-table', 'ti-map-pin', 'ti-shield-check', 'ti-star',
  ];
  function _tabIconsKey() { return `cm_gp_tabicons_${_userId || '?'}_${_clubId || '?'}`; }
  function _loadTabIcons() {
    try { const v = JSON.parse(localStorage.getItem(_tabIconsKey()) || '{}'); return (v && typeof v === 'object') ? v : {}; }
    catch (_) { return {}; }
  }
  function _saveTabIcon(viewKey, icon) {
    const all = _loadTabIcons();
    if (icon) all[viewKey] = icon; else delete all[viewKey];
    try { localStorage.setItem(_tabIconsKey(), JSON.stringify(all)); } catch (_) {}
  }
  function applyTabIcons() {
    const sectionsEl = document.getElementById('sections');
    if (!sectionsEl) return;
    const icons = _loadTabIcons();
    sectionsEl.querySelectorAll('.gp-sec[data-view]').forEach(tab => {
      const ic = icons[tab.dataset.view];
      if (!ic) return;
      const iEl = tab.querySelector('.row > i.ti');   // the tab's own icon (not the kebab's ti-dots)
      if (iEl) iEl.className = 'ti ' + ic;
    });
  }
  function openIconPicker(trigger, dash) {
    ensureMenuEl();
    closeMenu();
    const viewKey = REPORT_TYPE_TO_VIEW[dash.report_type] || `db-${dash.id}`;
    const cur = _loadTabIcons()[viewKey] || '';
    _menuEl.classList.add('gpt-icon-menu');
    _menuEl.innerHTML = `<div class="gpt-icon-grid">${
      TAB_ICONS.map(ic => `<button class="gpt-icon-opt${ic === cur ? ' is-on' : ''}" data-icon="${esc(ic)}" title="${esc(ic.replace('ti-', ''))}"><i class="ti ${ic}"></i></button>`).join('')
    }</div>`;
    _menuEl.querySelectorAll('[data-icon]').forEach(b => b.addEventListener('click', () => {
      _saveTabIcon(viewKey, b.dataset.icon); applyTabIcons(); closeMenu();
    }));
    _menuBkEl.classList.add('is-on');
    _menuEl.style.visibility = 'hidden';
    _menuEl.classList.add('is-open');
    const r = trigger.getBoundingClientRect();
    let left = r.left, top = r.bottom + 4;
    if (left + 240 > innerWidth - 12) left = innerWidth - 244;
    if (top + 180 > innerHeight - 12) top = Math.max(12, r.top - 180);
    _menuEl.style.left = left + 'px';
    _menuEl.style.top  = top  + 'px';
    _menuEl.style.visibility = '';
    _menuOwner = trigger;
  }

  // ── Re-render all tab decorations ─────────────────────────────

  function reRender() {
    enhancePredefinedTabs(_dashboards);
    renderCustomTabs(_dashboards);
    renderAddTabButton();
    applyTabOrder();
    applyTabIcons();
    wireTabDrag();
    wireAllGridDrags();
  }

  // ── Init ──────────────────────────────────────────────────────

  async function init() {
    if (_initStarted) return;
    _initStarted = true;
    if (!window.sb) { _initStarted = false; setTimeout(init, 400); return; }
    try {
      _clubId = await waitForClubId();
      _userId = window._gpUserId || null;

      if (!window.loadDashboards) return; // gp-persist.js not loaded

      // fetch user role for RBAC checks
      if (_userId) {
        const { data: profile } = await window.sb
          .from('profiles').select('role').eq('id', _userId).maybeSingle();
        _userRole = profile?.role || null;
      }

      // Teams (for the share picker + tab badges) and my memberships (for the picker/affordances).
      try {
        _teams = (typeof window.getTeams === 'function') ? (await window.getTeams(_clubId)) || [] : [];
        _teamNameById = {}; _teams.forEach(t => { _teamNameById[t.id] = t.name; });
      } catch (_) { _teams = []; }
      try { _myTeamIds = ((await window.sb.rpc('my_team_ids')).data || []).map(String); } catch (_) { _myTeamIds = []; }

      _dashboards = await window.loadDashboards(_clubId, window.sb);

      reRender();

      // also wire drags on predefined views (builder cards added later)
      // Re-wire after GPS Analysis finishes mounting builder cards
      setTimeout(wireAllGridDrags, 2000);

    } catch (e) {
      console.warn('[gp-tabs] init failed:', e);
    }
  }

  document.addEventListener('DOMContentLoaded', () => init());
  if (document.readyState !== 'loading') init();

})();
