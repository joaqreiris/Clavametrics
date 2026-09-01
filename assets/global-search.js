/* global-search.js — shared global search bar for all pages */
(function () {
  'use strict';

  if (!document.getElementById('gs-styles')) {
    const s = document.createElement('style');
    s.id = 'gs-styles';
    s.textContent = `
      .hub-search{position:relative;width:280px;display:flex;align-items:center;gap:8px;height:34px;padding:0 10px;background:var(--cm-bg-soft);border:1px solid var(--cm-border);border-radius:var(--cm-r-3);color:var(--cm-fg-muted);flex-shrink:0}
      .hub-search:hover{border-color:var(--cm-border-strong)}
      .hub-search input{flex:1;min-width:0;border:0;outline:none;background:transparent;font:var(--cm-body-sm);color:var(--cm-fg)}
      .hub-search input::placeholder{color:var(--cm-fg-faint)}
      .hub-search>.ti{font-size:16px}
      .gs-kbd{display:inline-flex;align-items:center;justify-content:center;height:18px;min-width:18px;padding:0 4px;border:1px solid var(--cm-border);border-radius:3px;font:500 10px/1 var(--cm-font-mono,monospace);color:var(--cm-fg-muted);background:var(--cm-bg);flex-shrink:0}
      .hub-search-results{position:absolute;top:calc(100% + 6px);left:0;min-width:320px;background:var(--cm-surface,var(--cm-bg));border:1px solid var(--cm-border-strong);border-radius:var(--cm-r-4,6px);box-shadow:0 8px 24px rgba(0,0,0,.14);z-index:200;max-height:380px;overflow-y:auto}
      .hub-search-group-label{font:500 10.5px/1 var(--cm-font-sans,sans-serif);letter-spacing:.08em;text-transform:uppercase;color:var(--cm-fg-muted);padding:10px 12px 6px}
      .hub-search-item{display:flex;align-items:center;gap:10px;padding:8px 12px;color:var(--cm-fg);text-decoration:none;font:500 13px/1.2 var(--cm-font-sans,sans-serif);cursor:pointer;transition:background 100ms}
      .hub-search-item:hover,.hub-search-item.is-focused{background:var(--cm-bg-soft)}
      .hub-search-item .ti{font-size:15px;color:var(--cm-fg-muted);flex-shrink:0}
      .hub-search-meta{margin-left:auto;font-size:11px;color:var(--cm-fg-faint);white-space:nowrap;padding-left:8px}
      .hub-search-empty{padding:24px 12px;text-align:center;color:var(--cm-fg-muted);font:13px/1 var(--cm-font-sans,sans-serif)}
      .gs-highlight{animation:gs-flash 1.6s ease-out forwards}
      @keyframes gs-flash{0%,15%{background:color-mix(in srgb,var(--cm-accent,#2d6cdf) 18%,transparent);outline:2px solid var(--cm-accent,#2d6cdf);outline-offset:2px}100%{background:transparent;outline:2px solid transparent}}
      @media(max-width:768px){.hub-search{width:auto}}
      @media(max-width:480px){.hub-search{display:none!important}}
    `;
    document.head.appendChild(s);
  }

  const wrapper = document.querySelector('.hub-search');
  if (!wrapper) return;

  /* push hub-search right, reset any sibling auto-margin */
  wrapper.style.marginLeft = 'auto';
  const sibAct = wrapper.parentElement && wrapper.parentElement.querySelector('.actions,.right');
  if (sibAct) sibAct.style.marginLeft = '0';

  /* ensure search icon */
  if (!wrapper.querySelector('.ti')) {
    wrapper.insertAdjacentHTML('afterbegin', '<i class="ti ti-search"></i>');
  }

  /* ensure input */
  let input = wrapper.querySelector('input');
  if (!input) {
    input = document.createElement('input');
    input.type = 'text';
    const icon = wrapper.querySelector('.ti');
    if (icon) icon.insertAdjacentElement('afterend', input);
    else wrapper.appendChild(input);
  }
  input.placeholder = 'Search players, sessions, microcycles…';
  input.setAttribute('aria-label', 'Global search');

  /* ⌘K kbd hint */
  if (!wrapper.querySelector('.gs-kbd') && !wrapper.querySelector('.cm-kbd')) {
    wrapper.insertAdjacentHTML('beforeend', '<span class="gs-kbd">⌘</span><span class="gs-kbd">K</span>');
  }

  /* dropdown container */
  const drop = document.createElement('div');
  drop.className = 'hub-search-results';
  drop.hidden = true;
  wrapper.appendChild(drop);

  const esc = s => String(s ?? '').replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let timer, clubId;

  /* ⌘K / Ctrl+K */
  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); input.focus(); input.select(); }
    if (e.key === 'Escape') { drop.hidden = true; input.blur(); }
  });

  document.addEventListener('click', e => { if (!wrapper.contains(e.target)) drop.hidden = true; });
  input.addEventListener('focus', () => { if (input.value.trim().length >= 2) drop.hidden = false; });

  input.addEventListener('input', () => {
    clearTimeout(timer);
    const q = input.value.trim();
    if (q.length < 2) { drop.hidden = true; return; }
    timer = setTimeout(() => runSearch(q), 300);
  });

  async function runSearch(q) {
    if (!clubId) clubId = await window.getClubId();
    if (!clubId) return;

    drop.innerHTML = '<div class="hub-search-empty">Searching…</div>';
    drop.hidden = false;

    const like = `%${q}%`;
    const [pRes, sRes, cRes, mRes, eRes, dRes] = await Promise.all([
      window.sb.from('players')
        .select('id,first_name,last_name,number,position')
        .eq('club_id', clubId)
        .is('archived_at', null)
        .or(`first_name.ilike.${like},last_name.ilike.${like}`)
        .limit(5),
      window.sb.from('training_sessions')
        .select('id,title,session_type,session_date')
        .eq('club_id', clubId)
        .ilike('title', like)
        .order('session_date', { ascending: false })
        .limit(5),
      window.sb.from('calendar_events')
        .select('id,title,opponent,date,type')
        .eq('club_id', clubId)
        .eq('type', 'match')
        .or(`opponent.ilike.${like},title.ilike.${like}`)
        .limit(5),
      window.sb.from('microcycles')
        .select('id,name,start_date,end_date')
        .eq('club_id', clubId)
        .ilike('name', like)
        .limit(5),
      window.sb.from('gym_exercises')
        .select('id,name,category,muscle_group')
        .eq('club_id', clubId)
        .ilike('name', like)
        .limit(5),
      window.sb.from('exercises')
        .select('id,name,players_count,field_width,field_height,visible_teams,origin_team_id,owner_teams,created_by')
        .eq('club_id', clubId)
        .ilike('name', like)
        .limit(15)
    ]);

    const players     = pRes.data  || [];
    const sessions    = sRes.data  || [];
    const matches     = cRes.data  || [];
    const microcycles = mRes.data  || [];
    const exercises   = eRes.data  || [];
    // Team policy: field drills only surface for the active team (own + shared with it,
    // más las propias traídas desde otra categoría del usuario vía owner_teams).
    try { await window.cmMyScope(); } catch (_) {}
    const _gsTeam     = window.getActiveTeamId ? window.getActiveTeamId() : null;
    const drills      = (dRes.data || []).filter(ex => window.cmExVisibleForTeam(ex, _gsTeam)).slice(0, 5);

    if (![players, sessions, matches, microcycles, exercises, drills].some(a => a.length)) {
      drop.innerHTML = `<div class="hub-search-empty">No results for &ldquo;${esc(q)}&rdquo;</div>`;
      return;
    }

    let html = '';

    if (players.length) {
      html += '<div class="hub-search-group-label">Players</div>';
      players.forEach(p => {
        const meta = p.number ? `#${p.number}` : (p.position || '—');
        html += `<a class="hub-search-item" href="Squad.html?highlight=${p.id}"><i class="ti ti-user"></i><span>${esc(p.first_name)} ${esc(p.last_name)}</span><span class="hub-search-meta">${esc(meta)}</span></a>`;
      });
    }

    if (sessions.length) {
      html += '<div class="hub-search-group-label">Sessions</div>';
      sessions.forEach(s => {
        html += `<a class="hub-search-item" href="Sessions%20History.html?highlight=${s.id}"><i class="ti ti-soccer-field"></i><span>${esc(s.title)}</span><span class="hub-search-meta">${esc(s.session_date || '')}</span></a>`;
      });
    }

    if (drills.length) {
      html += '<div class="hub-search-group-label">Drills</div>';
      drills.forEach(d => {
        const meta = d.players_count ? `${d.players_count}p` : '';
        html += `<a class="hub-search-item" href="Exercises%20Library.html?highlight=${d.id}"><i class="ti ti-soccer-field"></i><span>${esc(d.name)}</span><span class="hub-search-meta">${esc(meta)}</span></a>`;
      });
    }

    if (matches.length) {
      html += '<div class="hub-search-group-label">Matches</div>';
      matches.forEach(m => {
        const label = m.opponent || m.title || 'Match';
        const date  = (m.date || '').slice(0, 10);
        html += `<a class="hub-search-item" href="Calendar.html?highlight=${m.id}&amp;date=${esc(date)}"><i class="ti ti-trophy"></i><span>${esc(label)}</span><span class="hub-search-meta">${esc(date)}</span></a>`;
      });
    }

    if (microcycles.length) {
      html += '<div class="hub-search-group-label">Microcycles</div>';
      microcycles.forEach(mc => {
        const date = (mc.start_date || '').slice(0, 10);
        html += `<a class="hub-search-item" href="Calendar.html?mc=${mc.id}"><i class="ti ti-calendar-stats"></i><span>${esc(mc.name)}</span><span class="hub-search-meta">${esc(date)}</span></a>`;
      });
    }

    if (exercises.length) {
      html += '<div class="hub-search-group-label">Gym</div>';
      exercises.forEach(ex => {
        const meta = ex.muscle_group || ex.category || '';
        html += `<a class="hub-search-item" href="Gym%20Library.html?highlight=${ex.id}"><i class="ti ti-barbell"></i><span>${esc(ex.name)}</span><span class="hub-search-meta">${esc(meta)}</span></a>`;
      });
    }

    drop.innerHTML = html;
  }
})();
