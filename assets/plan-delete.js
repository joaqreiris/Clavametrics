/* Shared "delete a training plan" flow — used by the Calendar month view and Daily Planning.
 *
 * A plan is treated as a SHEET laid on top of a session: deleting it must NEVER destroy the
 * independent data attached to that session (GPS, RPE, videos). training_sessions cascades to
 * gps_reports / gps_period_reports / rpe / video_sessions, so a raw DELETE would silently wipe
 * imported data. Hence two paths:
 *   · session has NO attached data → delete the training_sessions row (day clears from calendar)
 *   · session HAS attached data    → keep the row, wipe only the plan (exercises, notes, focus,
 *                                    orientation, gps_targets, estimated RPE, published)
 * Always confirms first, spelling out what is removed and what is preserved.
 *
 * API: await window.cmDeletePlan({ sessionId, clubId, dateLabel }) → true if something was deleted.
 */
(function () {
  'use strict';

  function _tt(key, en, vars) {
    var v = (window.CM_I18N && window.CM_I18N.t) ? window.CM_I18N.t(key, vars) : null;
    return (v && v !== key) ? v : (en != null ? en : key);
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[<>&"]/g, function (c) {
      return { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c];
    });
  }

  // head:true → server returns only the count. '*' avoids assuming a column name.
  async function _count(table, sessionId) {
    try {
      var res = await window.sb.from(table).select('*', { count: 'exact', head: true }).eq('session_id', sessionId);
      return res.error ? 0 : (res.count || 0);
    } catch (_) { return 0; }
  }

  /** What is attached to this session. `keeps` = rows that must survive the delete. */
  async function inspectPlan(sessionId) {
    var r = await Promise.all([
      _count('gps_reports', sessionId),
      _count('gps_period_reports', sessionId),
      _count('rpe', sessionId),
      _count('video_sessions', sessionId),
      _count('session_exercises', sessionId),
    ]);
    var o = { gps: r[0], gpsPeriods: r[1], rpe: r[2], videos: r[3], exercises: r[4] };
    o.keeps = o.gps + o.gpsPeriods + o.rpe + o.videos;
    return o;
  }
  window.cmInspectPlan = inspectPlan;

  function _li(icon, text, color) {
    return '<li style="display:flex;align-items:flex-start;gap:8px;padding:3px 0;font:500 12px/1.45 var(--cm-font-sans);color:' + (color || 'var(--cm-fg)') + '">'
      + '<i class="ti ' + icon + '" style="font-size:14px;flex-shrink:0;margin-top:1px"></i><span>' + text + '</span></li>';
  }

  function _confirmModal(info, dateLabel) {
    return new Promise(function (resolve) {
      var ov = document.createElement('div');
      ov.style.cssText = 'position:fixed;inset:0;z-index:1200;background:rgba(0,0,0,.42);display:flex;align-items:center;justify-content:center;padding:20px';

      var removes = [];
      removes.push(_li('ti-list-check', info.exercises
        ? _tt('plan_delete.n_exercises', '{n} exercise|{n} exercises', { n: info.exercises, count: info.exercises })
        : _tt('plan_delete.no_exercises', 'No exercises')));
      removes.push(_li('ti-note', _tt('plan_delete.plan_fields', 'Notes, focus, orientation and GPS targets')));

      var keeps = [];
      if (info.gps || info.gpsPeriods) {
        keeps.push(_li('ti-satellite', _tt('plan_delete.n_gps', '{n} GPS record|{n} GPS records',
          { n: info.gps + info.gpsPeriods, count: info.gps + info.gpsPeriods }), 'var(--cm-success,#16A34A)'));
      }
      if (info.rpe) {
        keeps.push(_li('ti-activity-heartbeat', _tt('plan_delete.n_rpe', '{n} RPE entry|{n} RPE entries',
          { n: info.rpe, count: info.rpe }), 'var(--cm-success,#16A34A)'));
      }
      if (info.videos) {
        keeps.push(_li('ti-video', _tt('plan_delete.n_videos', '{n} video|{n} videos',
          { n: info.videos, count: info.videos }), 'var(--cm-success,#16A34A)'));
      }

      var lead = info.keeps
        ? _tt('plan_delete.lead_partial', 'Only the plan is deleted. This session has data of its own that stays untouched.')
        : _tt('plan_delete.lead_full', 'The plan is deleted and the session disappears from the calendar.');

      ov.innerHTML =
        '<div role="dialog" aria-modal="true" style="width:min(460px,100%);background:var(--cm-surface,#fff);border:1px solid var(--cm-border);border-radius:var(--cm-r-4,14px);box-shadow:var(--cm-shadow-3,0 18px 48px rgba(0,0,0,.22));overflow:hidden">'
        + '<div style="padding:16px 18px 12px;border-bottom:1px solid var(--cm-border-soft)">'
        + '<h3 style="margin:0;font:700 15px/1.25 var(--cm-font-sans);color:var(--cm-fg-strong)">' + esc(_tt('plan_delete.title', 'Delete plan')) + '</h3>'
        + (dateLabel ? '<div style="margin-top:3px;font:500 12px/1.3 var(--cm-font-sans);color:var(--cm-fg-muted)">' + esc(dateLabel) + '</div>' : '')
        + '</div>'
        + '<div style="padding:14px 18px">'
        + '<p style="margin:0 0 12px;font:500 12.5px/1.5 var(--cm-font-sans);color:var(--cm-fg)">' + esc(lead) + '</p>'
        + '<div style="font:600 10px/1 var(--cm-font-mono);letter-spacing:.05em;text-transform:uppercase;color:var(--cm-fg-muted);margin-bottom:5px">'
        + esc(_tt('plan_delete.will_remove', 'Will be removed')) + '</div>'
        + '<ul style="margin:0 0 ' + (keeps.length ? '14px' : '0') + ';padding:0;list-style:none">' + removes.join('') + '</ul>'
        + (keeps.length
          ? '<div style="font:600 10px/1 var(--cm-font-mono);letter-spacing:.05em;text-transform:uppercase;color:var(--cm-fg-muted);margin-bottom:5px">'
            + esc(_tt('plan_delete.will_keep', 'Will be kept')) + '</div>'
            + '<ul style="margin:0 0 8px;padding:0;list-style:none">' + keeps.join('') + '</ul>'
            + '<p style="margin:0;font:500 11.5px/1.45 var(--cm-font-sans);color:var(--cm-fg-muted)">'
            + esc(_tt('plan_delete.session_kept', 'The session stays in the calendar so those records keep their link.')) + '</p>'
          : '')
        + '</div>'
        + '<div style="display:flex;justify-content:flex-end;gap:8px;padding:12px 18px;border-top:1px solid var(--cm-border-soft);background:var(--cm-bg-soft)">'
        + '<button class="cm-btn is-outline is-sm" data-cancel>' + esc(_tt('common.cancel', 'Cancel')) + '</button>'
        + '<button class="cm-btn is-sm" data-ok style="background:var(--cm-danger,#DC2626);border-color:var(--cm-danger,#DC2626);color:#fff">'
        + '<i class="ti ti-trash" style="font-size:13px"></i>' + esc(_tt('plan_delete.cta', 'Delete plan')) + '</button>'
        + '</div></div>';

      function close(val) {
        document.removeEventListener('keydown', onKey);
        ov.remove();
        resolve(val);
      }
      function onKey(e) { if (e.key === 'Escape') close(false); }

      ov.addEventListener('click', function (e) { if (e.target === ov) close(false); });
      ov.querySelector('[data-cancel]').addEventListener('click', function () { close(false); });
      ov.querySelector('[data-ok]').addEventListener('click', function () {
        var b = ov.querySelector('[data-ok]');
        b.disabled = true;
        b.textContent = _tt('plan_delete.deleting', 'Deleting…');
        close(true);
      });
      document.addEventListener('keydown', onKey);
      document.body.appendChild(ov);
    });
  }

  /**
   * Confirm + delete a plan.
   * @param {{sessionId:string, clubId:string, dateLabel?:string, skipConfirm?:boolean}} opts
   * @returns {Promise<boolean>} true when the plan was deleted.
   */
  async function cmDeletePlan(opts) {
    opts = opts || {};
    if (!opts.sessionId || !window.sb) return false;

    var info = await inspectPlan(opts.sessionId);
    if (!opts.skipConfirm) {
      var ok = await _confirmModal(info, opts.dateLabel);
      if (!ok) return false;
    }

    // The plan's exercises are plan content in BOTH paths (a row delete would cascade them
    // anyway) — remove them explicitly so the partial path clears them too.
    var delEx = window.sb.from('session_exercises').delete().eq('session_id', opts.sessionId);
    if (opts.clubId) delEx = delEx.eq('club_id', opts.clubId);
    var exRes = await delEx;
    if (exRes.error) throw new Error(exRes.error.message);

    var res;
    if (info.keeps > 0) {
      // Keep the row so GPS/RPE/videos keep their FK; wipe only the planning fields.
      var upd = window.sb.from('training_sessions').update({
        notes: null, focus: null, orientation: null,
        gps_targets: null, estimated_rpe: null, published: false,
      }).eq('id', opts.sessionId);
      if (opts.clubId) upd = upd.eq('club_id', opts.clubId);
      res = await upd;
    } else {
      var del = window.sb.from('training_sessions').delete().eq('id', opts.sessionId);
      if (opts.clubId) del = del.eq('club_id', opts.clubId);
      res = await del;
    }
    if (res.error) throw new Error(res.error.message);
    return true;
  }

  window.cmDeletePlan = cmDeletePlan;
})();
