// ClavaMetrics — Shared sidebar component
// Requires: supabase-init.js loaded before this script
// Usage: <div id="hub-side-root"></div> inside .hub-shell

(function () {
  // Desktop collapse state — applied to <html> synchronously (script runs in <head>,
  // before .hub-shell exists / first paint) so there's no expanded→collapsed flash.
  try { if (localStorage.getItem('cm_sidebar_collapsed') === '1') document.documentElement.classList.add('cm-rail'); } catch (_) {}

  // ── i18n runtime ─────────────────────────────────────────────
  // Load the shared i18n runtime once, on every app page that has a sidebar,
  // so nav + chrome translate without touching each page's <head>.
  if (!window.CM_I18N && !document.querySelector('script[src*="assets/i18n.js"]')) {
    var _sbScript = document.currentScript;
    var _i18nSrc = (_sbScript && _sbScript.src)
      ? _sbScript.src.replace(/sidebar\.js(\?.*)?$/, 'i18n.js')
      : 'assets/i18n.js';
    var _i18nEl = document.createElement('script');
    _i18nEl.src = _i18nSrc; _i18nEl.defer = true;
    document.head.appendChild(_i18nEl);
  }
  function _applyI18n(root) {
    if (window.CM_I18N) window.CM_I18N.applyTo(root || document);
  }
  // Translated string for text built in JS (data-i18n only works on rendered elements).
  function _ttx(k, fb) {
    try { const v = (window.CM_I18N && window.CM_I18N.t) ? window.CM_I18N.t(k) : null; return (v && v !== k) ? v : fb; }
    catch (_e) { return fb; }
  }

  // ── CSS ──────────────────────────────────────────────────────
  if (!document.getElementById('cm-sidebar-css')) {
    const s = document.createElement('style');
    s.id = 'cm-sidebar-css';
    s.textContent = `
.hub-shell{display:grid;grid-template-columns:240px 1fr;min-height:100vh;transition:grid-template-columns .2s ease}
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
.cm-team-chip{display:flex;align-items:center;gap:5px;margin-top:5px;position:relative;background:var(--cm-side-item-active-bg);border:1px solid var(--cm-side-border);border-radius:6px;padding:0 7px;height:26px;transition:border-color .15s,background .15s}
.cm-team-chip:hover{border-color:var(--cm-side-accent)}
.cm-team-chip > .ti:first-child{font-size:13px;color:var(--cm-side-fg-muted);flex-shrink:0}
.cm-team-chip select{flex:1;min-width:0;appearance:none;-webkit-appearance:none;background:transparent;border:none;outline:none;color:var(--cm-side-fg);font:600 12px/1 var(--cm-font-sans);cursor:pointer;padding:0;text-overflow:ellipsis}
.cm-team-chip select option{background:var(--cm-side-bg);color:var(--cm-side-fg)}
.cm-team-chip-caret{font-size:12px;color:var(--cm-side-fg-muted);flex-shrink:0;pointer-events:none}
.hub-nav{padding:8px 10px;flex:1}
.hub-nav-group+.hub-nav-group{margin-top:6px}
.hub-nav-label{font:500 10.5px/1 var(--cm-font-sans);letter-spacing:0.08em;text-transform:uppercase;color:var(--cm-side-fg-muted);padding:10px 10px 6px}
.hub-nav-item{display:flex;align-items:center;gap:10px;padding:6.5px 10px;border-radius:var(--cm-r-3);color:var(--cm-side-fg-muted);text-decoration:none;font:500 13.5px/1 var(--cm-font-sans);cursor:pointer;transition:background var(--cm-dur-1),color var(--cm-dur-1)}
.hub-nav-item:hover{background:var(--cm-side-item-active-bg);color:var(--cm-side-fg)}
.hub-nav-item .ti{font-size:17px;flex-shrink:0;opacity:0.95}
.hub-nav-item .count{margin-left:auto;font:500 11.5px/1 var(--cm-font-mono);color:var(--cm-side-fg-muted)}
.hub-nav-item.is-active{background:var(--cm-side-item-active-bg);color:var(--cm-side-item-active-fg)}
.hub-nav-item.is-active .count{color:var(--cm-side-item-active-fg);opacity:0.8}
.hub-nav-item.is-locked{opacity:.55}
.hub-nav-lock{margin-left:auto;font-size:14px;opacity:.85}
/* Drag-to-reorder affordance (desktop expanded only) */
.hub-nav-item{position:relative}
.hub-nav-grip{position:absolute;left:10px;top:50%;transform:translateY(-50%);display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity var(--cm-dur-1);pointer-events:none;color:var(--cm-side-fg-muted)}
.hub-nav-grip .ti{opacity:1}
.hub-nav-item[draggable="true"]:hover{cursor:grab}
.hub-nav-item[draggable="true"]:hover>.ti:first-child{opacity:0}
.hub-nav-item[draggable="true"]:hover .hub-nav-grip{opacity:.7}
.hub-nav-item.is-dragging{opacity:.4}
.hub-nav-drop-line{height:2px;margin:2px 8px;border-radius:2px;background:var(--cm-accent,var(--cm-side-item-active-fg));opacity:.85;pointer-events:none}
html.cm-rail .hub-nav-grip{display:none}
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
.cm-ni-ico.birthday{background:rgba(236,72,153,.1);color:#be185d}
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
/* Hilo inline: responder una conversación desde el panel sin salir de la página */
.cm-ct-h{display:flex;align-items:center;gap:8px;padding:9px 12px;border-bottom:1px solid var(--cm-border,#e5e7eb);flex-shrink:0}
.cm-ct-back{width:26px;height:26px;border:0;background:transparent;color:var(--cm-fg-muted,#6b7280);cursor:pointer;border-radius:6px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.cm-ct-back:hover{background:var(--cm-bg-soft,#f4f4f5)}
.cm-ct-av-slot{display:inline-flex;flex-shrink:0}
.cm-ct-name{flex:1;min-width:0;font:600 12.5px/1.2 var(--cm-font-sans,sans-serif);color:var(--cm-fg-strong,#111);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cm-ct-open{width:26px;height:26px;color:var(--cm-fg-muted,#6b7280);border-radius:6px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.cm-ct-open:hover{background:var(--cm-bg-soft,#f4f4f5);color:var(--cm-accent,#6366f1)}
.cm-ct-msgs{overflow-y:auto;flex:1;min-height:140px;max-height:280px;padding:10px 12px;display:flex;flex-direction:column;gap:2px;background:var(--cm-bg-soft,#fafafa)}
.cm-ct-who{font:600 10px/1.2 var(--cm-font-sans,sans-serif);color:var(--cm-fg-muted,#6b7280);margin:6px 0 0 4px}
.cm-ct-bub{max-width:82%;padding:6px 10px;border-radius:12px;font:500 12px/1.45 var(--cm-font-sans,sans-serif);white-space:pre-wrap;word-break:break-word;margin-top:4px}
.cm-ct-bub.them{align-self:flex-start;background:var(--cm-surface,#fff);border:1px solid var(--cm-border,#e5e7eb);color:var(--cm-fg-strong,#111);border-bottom-left-radius:4px}
.cm-ct-bub.me{align-self:flex-end;background:var(--cm-accent,#6366f1);color:#fff;border-bottom-right-radius:4px}
.cm-ct-empty{margin:auto;font:500 12px/1.4 var(--cm-font-sans,sans-serif);color:var(--cm-fg-muted,#6b7280);text-align:center;padding:20px 10px}
.cm-ct-comp{display:flex;align-items:flex-end;gap:8px;padding:10px 12px;border-top:1px solid var(--cm-border,#e5e7eb);flex-shrink:0}
.cm-ct-inp{flex:1;min-width:0;resize:none;border:1px solid var(--cm-border,#e5e7eb);border-radius:10px;padding:7px 10px;font:500 12.5px/1.4 var(--cm-font-sans,sans-serif);color:var(--cm-fg-strong,#111);background:var(--cm-surface,#fff);max-height:90px;outline:none}
.cm-ct-inp:focus{border-color:var(--cm-accent,#6366f1)}
.cm-ct-send{width:32px;height:32px;border:0;border-radius:9px;background:var(--cm-accent,#6366f1);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.cm-ct-send:hover{filter:brightness(1.08)}
.cm-ct-send:disabled{opacity:.55;cursor:default}
/* Desktop collapse toggle button (in .hub-brand) */
.hub-brand .cm-collapse-btn{width:24px;height:24px;border-radius:6px;border:1px solid var(--cm-side-border);background:transparent;color:var(--cm-side-fg-muted);display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0}
.hub-brand .cm-collapse-btn:hover{background:var(--cm-side-item-active-bg);color:var(--cm-side-fg)}
.hub-brand .cm-collapse-btn .ti{font-size:16px}
@media(max-width:768px){.hub-brand .cm-collapse-btn{display:none}}
/* Collapsed icon rail — desktop only; mobile off-canvas is untouched */
@media(min-width:769px){
  html.cm-rail .hub-shell{grid-template-columns:64px 1fr}
  html.cm-rail .hub-brand{flex-direction:column;gap:10px;padding:14px 0}
  html.cm-rail .hub-brand .body,
  html.cm-rail .hub-nav-label,
  html.cm-rail .hub-nav-txt,
  html.cm-rail .hub-nav-item .count,
  html.cm-rail .hub-user .who,
  html.cm-rail .hub-logout-btn span{display:none}
  html.cm-rail .hub-nav{padding:8px 8px}
  html.cm-rail .hub-nav-item{justify-content:center;padding:8px 0;gap:0}
  html.cm-rail .hub-nav-item .ti{font-size:18px}
  html.cm-rail .hub-user{justify-content:center;padding:8px 0;gap:0}
  html.cm-rail .hub-logout-btn{justify-content:center;padding:7px 0;gap:0}
}
/* Live presence — who's online in this club right now */
.cm-presence{align-items:center;margin-right:2px}
.cm-presence-stack{display:inline-flex;align-items:center}
.cm-pb{width:30px;height:30px;border-radius:50%;margin-left:-8px;border:2px solid;display:flex;align-items:center;justify-content:center;font:600 11px/1 var(--cm-font-sans,sans-serif);color:#fff;overflow:hidden;position:relative;cursor:default;box-shadow:0 0 0 1px var(--cm-surface,#fff);transition:transform .12s ease,box-shadow .16s ease}
.cm-pb:first-child{margin-left:0}
.cm-pb:hover{transform:translateY(-2px);z-index:3}
.cm-pb img{width:100%;height:100%;object-fit:cover;border-radius:50%;display:block}
.cm-pb.more{background:var(--cm-bg-soft,#f4f4f5);border-color:var(--cm-surface,#fff);color:var(--cm-fg-muted,#6b7280);font-size:10px}
/* (A) join/leave animation */
@keyframes cmPbIn{from{transform:scale(.4);opacity:0}to{transform:scale(1);opacity:1}}
.cm-pb.entering{animation:cmPbIn .18s cubic-bezier(.2,.8,.2,1)}
.cm-pb.leaving{animation:cmPbIn .16s ease reverse forwards;pointer-events:none;z-index:0}
/* (B) same-page emphasis: a bolder ring in the person's colour */
.cm-pb.is-here{box-shadow:0 0 0 2px var(--cm-surface,#fff),0 0 0 4px var(--pb,#2563EB)}
/* (E) custom tooltip */
.cm-pt{position:fixed;z-index:700;pointer-events:none;display:none;align-items:center;gap:8px;max-width:240px;padding:7px 10px;background:var(--cm-surface,#fff);color:var(--cm-fg-strong,#111);border:1px solid var(--cm-border,#e5e7eb);border-radius:9px;box-shadow:0 6px 24px rgba(0,0,0,.2);opacity:0;transform:translateY(-3px);transition:opacity .12s ease,transform .12s ease}
.cm-pt.on{display:flex;opacity:1;transform:translateY(0)}
.cm-pt-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.cm-pt-txt{min-width:0}
.cm-pt-name{font:600 12.5px/1.2 var(--cm-font-sans,sans-serif);display:block}
.cm-pt-meta{font:500 11px/1.3 var(--cm-font-sans,sans-serif);color:var(--cm-fg-muted,#6b7280);display:block;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:220px}
@media(prefers-reduced-motion:reduce){.cm-pb,.cm-pb.entering,.cm-pb.leaving{animation:none;transition:none}.cm-pt{transition:none}}
    `;
    document.head.appendChild(s);
  }

  // ── NAV DEFINITION ───────────────────────────────────────────
  const NAV_GROUPS = [
    { label: 'Overview', items: [
      { href: 'Hub.html',               icon: 'ti-home',             label: 'Staff Hub',        i18n: 'shell.nav.hub' },
      { href: 'Calendar.html',          icon: 'ti-calendar-stats',   label: 'Calendar',         i18n: 'shell.nav.calendar' },
      { href: 'Club%20Overview.html',   icon: 'ti-layout-dashboard', label: 'Club overview',    i18n: 'shell.nav.club-overview', directionOnly: true, key: 'club-overview', planOnly: true },
      { href: 'Annual%20Planner.html',  icon: 'ti-timeline',         label: 'Annual planner',   key: 'annual-planner' },
      { href: 'Chat%20%26%20Tasks.html',icon: 'ti-message-circle',   label: 'Chat &amp; tasks', i18n: 'shell.nav.chat-tasks', key: 'chat-tasks', planOnly: true },
    ]},
    { label: 'Technical', items: [
      { href: 'Planner.html',           icon: 'ti-clipboard-list',   label: 'Drill Designer',   key: 'planner' },
      { href: 'Exercises%20Library.html',icon: 'ti-list-tree',         label: 'Exercises Library', key: 'sessions-lib' },
      { href: 'Daily%20Planning.html',  icon: 'ti-soccer-field',     label: 'Daily planning',   key: 'daily-planning' },
      { href: 'Tactical%20Planning.html', icon: 'ti-target',         label: 'Tactical planning', key: 'tactical-planning', buckets: ['admin','coach','sc','direction'] },
      { href: 'Sessions%20History.html',icon: 'ti-history',           label: 'Sessions history', key: 'sessions-history' },
      { href: 'Video%20Room.html',      icon: 'ti-video',            label: 'Video room',       key: 'video-room' },
      { href: 'Squad.html',             icon: 'ti-users-group',      label: 'Squad',            key: 'squad' },
      { href: 'Lineup.html',            icon: 'ti-clipboard-check',  label: 'Lineup', count: 'XI', key: 'lineup' },
      { href: 'Availability.html',      icon: 'ti-user-check',       label: 'Availability',     key: 'availability' },
      { href: 'Match%20Reports.html',   icon: 'ti-report-analytics', label: 'Match reports',    key: 'match-reports' },
    ]},
    { label: 'Performance', items: [
      { href: 'Evaluations.html',       icon: 'ti-chart-dots',       label: 'Evaluations',      key: 'evaluations' },
      { href: 'Wellness.html',          icon: 'ti-heartbeat',        label: 'Wellness',         key: 'wellness' },
      { href: 'RPE.html',               icon: 'ti-activity',         label: 'RPE',              key: 'rpe' },
      { href: 'Load%20Monitor.html',    icon: 'ti-chart-line',       label: 'Load monitor',     key: 'load-monitor' },
      { href: 'Load%20Planner.html',    icon: 'ti-chart-histogram',  label: 'Load planner',     key: 'load-planner' },
      { href: 'GPS%20Analysis.html',    icon: 'ti-radar-2',          label: 'GPS analysis',     key: 'gps' },
      { href: 'Gym%20Planner.html',      icon: 'ti-barbell',          label: 'Gym planner',      key: 'gym-planner' },
      { href: 'Individual%20Planner.html', icon: 'ti-user-cog',       label: 'Individual S&C',   key: 'individual-sc' },
      { href: 'Top-Up.html',            icon: 'ti-run',              label: 'Top-Up',           key: 'top-up', i18n: 'topup.nav' },
      { href: 'Gym%20Library.html',      icon: 'ti-books',            label: 'Gym library',      key: 'gym-library' },
    ]},
    { label: 'Medical', items: [
      { href: 'Clinical%20Records.html',    icon: 'ti-clipboard-heart',      label: 'Clinical records',    key: 'clinical' },
      { href: 'Injuries.html',              icon: 'ti-bandage',              label: 'Injuries',            key: 'injuries' },
      { href: 'Physio.html',                icon: 'ti-stethoscope',          label: 'Treatments',          key: 'treatments' },
      { href: 'Rehab & Preventives.html',   icon: 'ti-activity-heartbeat',   label: 'Rehab & preventives', key: 'rehab' },
      { href: 'Nutrition.html',         icon: 'ti-apple',            label: 'Nutrition',        key: 'nutrition' },
    ]},
    { label: 'Workspace', items: [
      { href: '#',           icon: 'ti-settings',    label: 'Settings', extra: 'data-open-settings', i18n: 'shell.nav.settings' },
      { href: 'Admin.html',  icon: 'ti-user-shield', label: 'Admin',   adminOnly: true, i18n: 'shell.nav.admin' },
      { href: 'Billing.html',icon: 'ti-credit-card', label: 'Billing', adminOnly: true, i18n: 'shell.nav.billing' },
      { href: 'Platform.html', icon: 'ti-shield-lock', label: 'Platform Admin', platformOnly: true, i18n: 'shell.nav.platform-admin' },
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

  // ── NAV ORDER (drag-to-reorder persistence) ──────────────────
  const NAV_ORDER_KEY = 'cm_nav_order';
  function _navOrder() {
    try { return JSON.parse(localStorage.getItem(NAV_ORDER_KEY) || '{}') || {}; }
    catch (_) { return {}; }
  }
  // Reorder a group's items by a saved [href,...]: saved items first (in that order),
  // then any item not in the saved list keeps its original relative order and is appended.
  // Never drops items; item objects (and all their attributes) are only reordered.
  function _orderItems(items, saved) {
    if (!Array.isArray(saved) || !saved.length) return items;
    const byHref = new Map(items.map(it => [it.href, it]));
    const used = new Set();
    const out = [];
    saved.forEach(href => { const it = byHref.get(href); if (it && !used.has(href)) { out.push(it); used.add(href); } });
    items.forEach(it => { if (!used.has(it.href)) out.push(it); });
    return out;
  }

  // ── SPORT OVERRIDES ──────────────────────────────────────────
  // The nav is written in football. A pack (assets/sport-packs.js) may hide the items its
  // sport has no use for, swap an icon, or point an item at a different i18n key — so a
  // basketball club reads "Game reports" and never sees the Top-Up calculator, whose whole
  // model is % of Vmax with 19.8/25.2 km/h fallbacks that nobody reaches on a 28 m court.
  function _sportNav() {
    try { return (window.CMSport && window.CMSport.at('nav', null)) || { hidden: [], icons: {}, i18n: {} }; }
    catch (_e) { return { hidden: [], icons: {}, i18n: {} }; }
  }

  // ── RENDER ───────────────────────────────────────────────────
  function renderNav() {
    const savedAll = _navOrder();
    const sportNav = _sportNav();
    const hidden = new Set(sportNav.hidden || []);
    return NAV_GROUPS.map(g => `
      <div class="hub-nav-group" data-group-key="${g.label}">
        <div class="hub-nav-label" data-i18n="shell.group.${g.label.toLowerCase()}">${g.label}</div>
        ${_orderItems(g.items, savedAll[g.label]).filter(item => !(item.key && hidden.has(item.key))).map(item => {
          const active = isActive(item.href) ? ' is-active' : '';
          const extra  = item.extra ? ` ${item.extra}` : '';
          const adm    = item.adminOnly ? ' data-admin-only' : '';
          const dir    = item.directionOnly ? ' data-direction-only' : '';   // solo dirección + admin/owner
          const mod    = item.key ? ` data-mod="${item.key}"` : '';
          const plt    = item.platformOnly ? ' data-platform-only' : '';
          const po     = item.planOnly ? ' data-plan-only' : '';   // gatea por plan, NO por RBAC
          const bks    = item.buckets ? ` data-buckets="${item.buckets.join(',')}"` : '';   // visible solo para estos buckets de rol
          const baseKey = item.i18n || (item.key ? 'shell.nav.' + item.key : '');
          // The sport may point this entry at different wording ("Game reports").
          const i18nKey = (baseKey && window.CMSport) ? window.CMSport.i18nKey(baseKey) : baseKey;
          const i18n   = i18nKey ? ` data-i18n="${i18nKey}"` : '';
          const icon   = (item.key && sportNav.icons && sportNav.icons[item.key]) || item.icon;
          return `<a class="hub-nav-item${active}" href="${item.href}" data-nav-href="${item.href}"${extra}${adm}${dir}${mod}${plt}${po}${bks} title="${item.label}"><i class="ti ${icon}"></i><span class="hub-nav-txt"${i18n}>${item.label}</span><span class="hub-nav-grip"><i class="ti ti-grip-vertical"></i></span></a>`;
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
          <div class="cm-team-chip">
            <i class="ti ti-users-group"></i>
            <select id="cmGlobalTeam"><option value="">…</option></select>
            <i class="ti ti-chevron-down cm-team-chip-caret"></i>
          </div>
        </div>
        <button class="cm-collapse-btn" id="cmCollapseBtn" title="Collapse sidebar" aria-label="Collapse sidebar"><i class="ti ti-layout-sidebar-left-collapse"></i></button>
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
          <i class="ti ti-logout"></i><span data-i18n="shell.signout">Sign out</span>
        </button>
      </div>
    </aside>`;
  }

  // ── DRAG-TO-REORDER (desktop expanded sidebar only) ──────────
  function _dndEnabled() {
    if (document.documentElement.classList.contains('cm-rail')) return false;      // collapsed rail
    if (window.innerWidth <= 768) return false;                                    // mobile width
    if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return false; // touch
    return true;
  }

  // Read the current DOM order per group (via the stable data-nav-href, which loadData()
  // never mutates) and persist { groupLabel: [href,...] }.
  function _persistNavOrder(nav) {
    const order = {};
    nav.querySelectorAll('.hub-nav-group').forEach(group => {
      const key = group.getAttribute('data-group-key');
      if (!key) return;
      order[key] = [...group.querySelectorAll('.hub-nav-item')]
        .map(a => a.getAttribute('data-nav-href'))
        .filter(Boolean);
    });
    try { localStorage.setItem(NAV_ORDER_KEY, JSON.stringify(order)); } catch (_) {}
  }

  function _initNavDnD() {
    const nav = document.querySelector('.hub-side .hub-nav');
    if (!nav) return;

    function applyDraggable() {
      const on = _dndEnabled();
      nav.querySelectorAll('.hub-nav-item').forEach(a => { a.draggable = on; });
    }
    applyDraggable();
    window.addEventListener('resize', applyDraggable);
    document.getElementById('cmCollapseBtn')?.addEventListener('click', () => setTimeout(applyDraggable, 0));

    let dragEl = null, dragGroup = null, line = null;
    const clearLine = () => { if (line && line.parentNode) line.parentNode.removeChild(line); };

    nav.addEventListener('dragstart', e => {
      const item = e.target.closest('.hub-nav-item');
      if (!item || !_dndEnabled()) return;
      dragEl = item;
      dragGroup = item.closest('.hub-nav-group');
      item.classList.add('is-dragging');
      if (!line) { line = document.createElement('div'); line.className = 'hub-nav-drop-line'; }
      try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', item.getAttribute('data-nav-href') || ''); } catch (_) {}
    });

    nav.addEventListener('dragover', e => {
      if (!dragEl) return;
      const group = e.target.closest('.hub-nav-group');
      if (!group || group !== dragGroup) { clearLine(); return; } // different group → revert (no drop)
      e.preventDefault();
      try { e.dataTransfer.dropEffect = 'move'; } catch (_) {}
      const over = e.target.closest('.hub-nav-item');
      if (over === dragEl) return;
      if (!over) { const first = group.querySelector('.hub-nav-item'); if (first) first.before(line); else group.appendChild(line); return; }
      const rect = over.getBoundingClientRect();
      if (e.clientY > rect.top + rect.height / 2) over.after(line); else over.before(line);
    });

    nav.addEventListener('drop', e => {
      if (!dragEl) return;
      const group = e.target.closest('.hub-nav-group');
      if (!group || group !== dragGroup) { clearLine(); return; } // ignore cross-group drops
      e.preventDefault();
      if (line && line.parentNode === group) group.insertBefore(dragEl, line);
      clearLine();
      _persistNavOrder(nav);
    });

    nav.addEventListener('dragend', () => {
      if (dragEl) dragEl.classList.remove('is-dragging');
      clearLine();
      dragEl = null; dragGroup = null;
    });
  }

  // ── INJECT ───────────────────────────────────────────────────
  async function _initGlobalTeamSwitcher(profile, club) {
    const sel = document.getElementById('cmGlobalTeam');
    if (!sel || typeof window.getTeams !== 'function') return;
    const clubId = club?.id || (window.getClubId && await window.getClubId());
    if (!clubId) return;
    const bucket = (profile?.role || profile?.club_role || '').toLowerCase();
    let full = bucket === 'admin' || bucket === 'owner';
    if (!full && window.isSuperAdmin) { try { full = await window.isSuperAdmin(); } catch {} }
    let teams = await window.getTeams(clubId);
    if (!full) { let mine=[]; try{mine=(await window.sb.rpc('my_team_ids')).data||[];}catch{} const s=new Set(mine); teams=teams.filter(t=>s.has(t.id)); }
    if (!teams.length) { const chip = sel.closest('.cm-team-chip'); if (chip) chip.style.display = 'none'; return; }
    const saved = sessionStorage.getItem('cal_active_team') || localStorage.getItem('cal_active_team');
    const active = (saved && teams.some(t => t.id === saved)) ? saved : teams[0].id;
    // Persistir en ambos (sessionStorage para la sesión, localStorage para que sobreviva)
    sessionStorage.setItem('cal_active_team', active);
    localStorage.setItem('cal_active_team', active);
    sel.innerHTML = teams.map(t => `<option value="${t.id}" ${t.id===active?'selected':''}>${t.name}</option>`).join('');
    sel.addEventListener('change', () => {
      const v = sel.value;
      sessionStorage.setItem('cal_active_team', v);
      localStorage.setItem('cal_active_team', v);
      location.reload();
    });
  }

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

    // Desktop collapse/expand (icon rail) — state on <html>, persisted in localStorage
    const collapseBtn = document.getElementById('cmCollapseBtn');
    function _syncCollapseBtn() {
      if (!collapseBtn) return;
      const on = document.documentElement.classList.contains('cm-rail');
      collapseBtn.innerHTML = `<i class="ti ti-layout-sidebar-left-${on ? 'expand' : 'collapse'}"></i>`;
      collapseBtn.title = on ? 'Expand sidebar' : 'Collapse sidebar';
      collapseBtn.setAttribute('aria-label', collapseBtn.title);
    }
    _syncCollapseBtn();
    collapseBtn?.addEventListener('click', () => {
      const on = document.documentElement.classList.toggle('cm-rail');
      try { localStorage.setItem('cm_sidebar_collapsed', on ? '1' : '0'); } catch (_) {}
      _syncCollapseBtn();
    });

    // Drag-to-reorder nav items (desktop expanded sidebar only)
    _initNavDnD();

    // Translate the freshly rendered sidebar (no-op until the i18n runtime is ready;
    // the cm:langchanged listener re-applies once it boots / on language switch).
    _applyI18n(document.querySelector('.hub-side'));
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

  // Pinta nombre y escudo con lo último que se supo del club (cache que deja
  // getClub() y que boot-brand.js levanta en el <head>). loadData() espera a la
  // red, así que sin esto el sidebar se queda con el nombre vacío y un cuadrado
  // en lugar del escudo durante todo ese viaje de ida y vuelta.
  function _paintCachedBrand() {
    var c = window.__cmBrandBoot;
    if (!c) return;
    var nameEl = document.getElementById('sideClubName');
    if (nameEl && !nameEl.textContent && c.name) nameEl.textContent = c.name;
    var markEl = document.querySelector('.hub-brand .mark');
    if (markEl && c.logo_url) applyLogoToMark(markEl, c.logo_url);
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
    // Selector global de categoría
    try { await _initGlobalTeamSwitcher(profile, club); } catch (e) { console.warn('team switcher:', e); }
    if (teamLabelEl && profile?.club_role) teamLabelEl.textContent = profile.club_role;
    const markEl = document.querySelector('.hub-brand .mark');
    if (markEl) applyLogoToMark(markEl, club?.logo_url);
    if (profile) {
      // Shared display helpers: real name (never the raw email) + photo when available.
      // Keep the sidebar's own .av styling (dark theme) — inject an <img> or the initials.
      const dispName = (window.cmDisplayName ? window.cmDisplayName(profile) : (profile.full_name || '')) || '–';
      const avUrl    = window.cmAvatarUrl ? window.cmAvatarUrl(profile) : null;
      if (initialsEl) {
        if (avUrl) initialsEl.innerHTML = `<img src="${String(avUrl).replace(/"/g, '&quot;')}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
        else initialsEl.textContent = window.cmInitials ? window.cmInitials(dispName) : (dispName[0] || '–');
      }
      if (userNameEl) userNameEl.textContent = dispName;
      if (userRoleEl) userRoleEl.textContent = [profile.job_title || profile.role, profile.club_role].filter(Boolean).join(' · ') || 'Staff';
    }

    const _role = (profile?.role || '').toLowerCase();
    if (_role !== 'admin' && _role !== 'owner') {
      document.querySelectorAll('[data-admin-only]').forEach(el => el.remove());
      const _mods = (typeof window.getMyModules === 'function')
        ? await window.getMyModules() : { all: true, keys: new Set() };
      if (!_mods.all) {
        document.querySelectorAll('[data-mod]').forEach(el => {
          if (el.hasAttribute('data-plan-only')) return;   // gate por plan, no por RBAC
          if (!_mods.keys.has(el.dataset.mod)) el.remove();
        });
      }
    }
    // Club overview: visible solo para dirección (director/head of performance/…),
    // admin/owner y super-admin. Gating propio (NO usa data-mod para no fail-open a todos).
    try {
      const _buckets = window.cmRoleBuckets ? window.cmRoleBuckets(profile) : new Set([_role]);
      let _isSuperDir = false;
      try { _isSuperDir = (typeof window.isSuperAdmin === 'function') ? await window.isSuperAdmin() : false; } catch (_) {}
      if (!_isSuperDir && !_buckets.has('admin') && !_buckets.has('direction')) {
        document.querySelectorAll('[data-direction-only]').forEach(el => el.remove());
      }
    } catch (_) {}
    // Gating por bucket de rol (data-buckets="a,b,…"): el ítem se quita si NINGÚN rol
    // del miembro (role + club_role) cae en la lista. Igual que Club overview: gating
    // propio, NO usa data-mod para no fail-open. Super admin siempre lo ve.
    try {
      const _bk2 = window.cmRoleBuckets ? window.cmRoleBuckets(profile) : new Set();
      let _isSuperBk = false;
      try { _isSuperBk = (typeof window.isSuperAdmin === 'function') ? await window.isSuperAdmin() : false; } catch (_) {}
      if (!_isSuperBk) {
        document.querySelectorAll('[data-buckets]').forEach(el => {
          const ok = el.dataset.buckets.split(',').some(b => _bk2.has(b.trim()));
          if (!ok) el.remove();
        });
      }
    } catch (_) {}
    // Gating de plan: NO se quita el ítem; candado + CTA de upgrade (esconder no convierte).
    if (typeof window.planAllows === 'function') {
      const items = [...document.querySelectorAll('.hub-nav-item[data-mod]')];
      const checks = await Promise.all(items.map(async el => ({ el, ok: await window.planAllows(el.dataset.mod) })));
      // Features con "teaser difuminado" (feature-teaser.js): el candado mantiene el
      // href a SU página; al entrar, guardModule() muestra el preview con CTA (convierte
      // más que patear al Plan Picker pelado). El resto sí va directo al Plan Picker.
      const TEASER_KEYS = new Set(['gps', 'load-monitor', 'planner', 'match-reports', 'nutrition', 'video-room']);
      checks.forEach(({ el, ok }) => {
        if (ok) return;
        el.classList.add('is-locked');
        if (!TEASER_KEYS.has(el.dataset.mod)) el.setAttribute('href', 'Plan Picker.html');
        const t = el.getAttribute('title') || '';
        if (!t.includes('Upgrade')) el.setAttribute('title', t + ' — Upgrade to unlock');
        if (!el.querySelector('.hub-nav-lock')) {
          const lk = document.createElement('i');
          lk.className = 'ti ti-lock hub-nav-lock';
          el.appendChild(lk);
        }
      });
    }
    // Platform Admin: solo platform admins (cross-club). NO para admin de club.
    if (typeof window.isSuperAdmin === 'function') {
      let _isPA = false;
      try { _isPA = await window.isSuperAdmin(); } catch (e) {}
      if (!_isPA) document.querySelectorAll('[data-platform-only]').forEach(el => el.remove());
    }
    // Ocultar grupos que quedaron sin items
    document.querySelectorAll('.hub-nav-group').forEach(g => {
      if (!g.querySelector('.hub-nav-item')) g.style.display = 'none';
    });
  }

  // ── NOTIFICATIONS ────────────────────────────────────────────
  let _notifData = [];
  // Per-user, per-type team filter: { type: [teamId,…] }. Absent/non-array for a
  // type ⇒ show all teams. Notifications without a team_id (club-level) always show.
  let _notifTeamFilter = {};

  function _passesTeamFilter(n) {
    if (!n || !n.team_id) return true;
    const allowed = _notifTeamFilter && _notifTeamFilter[n.type];
    if (!Array.isArray(allowed)) return true;
    return allowed.includes(n.team_id);
  }
  function _visibleNotifs() { return _notifData.filter(_passesTeamFilter); }

  function _notifIcon(type) {
    const map = { physio: ['physio','ti-stethoscope'], task: ['task','ti-checkbox'], task_assigned: ['task','ti-checkbox'], task_completed: ['task','ti-checkbox'], injury: ['injury','ti-bandage'], session: ['session','ti-soccer-field'], player_birthday: ['birthday','ti-cake'], staff_birthday: ['birthday','ti-cake'] };
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
    const unread = _visibleNotifs().filter(n => !n.read).length;
    const badge = document.getElementById('cm-nbadge');
    if (!badge) return;
    badge.textContent = unread > 99 ? '99+' : unread;
    badge.style.display = unread > 0 ? 'block' : 'none';
  }

  function _renderNotifList() {
    const list = document.getElementById('cm-np-list');
    if (!list) return;
    const visible = _visibleNotifs();
    if (!visible.length) {
      list.innerHTML = '<div class="cm-np-empty" data-i18n="shell.nonotif">No notifications yet</div>';
      _applyI18n(list);
      return;
    }
    list.innerHTML = visible.map(n => `
      <a class="cm-ni${n.read ? '' : ' unread'}" data-nid="${_escHtml(n.id)}" href="${_escHtml(_safeLink(n.link))}">
        ${_notifIcon(n.type)}
        <div class="cm-ni-body">
          <div class="cm-ni-title">${_escHtml(n.title)}</div>
          ${n.body ? `<div class="cm-ni-desc">${_escHtml(n.body)}</div>` : ''}
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
        <div class="cm-toast-ttl">${_escHtml(notif.title)}</div>
        ${notif.body ? `<div class="cm-toast-desc">${_escHtml(notif.body)}</div>` : ''}
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
        <span class="ttl" data-i18n="shell.notifications">Notifications</span>
        <button class="mark-all" id="cm-mark-all" data-i18n="shell.markallread">Mark all read</button>
      </div>
      <div class="cm-np-list" id="cm-np-list"></div>
      <div class="cm-np-foot"><a href="#" data-i18n="shell.viewall">View all</a></div>`;
    wrap.appendChild(panel);
    _applyI18n(panel);

    // Load this user's per-type team filter (stored alongside notif prefs).
    try {
      const { data: prof } = await window.sb
        .from('profiles').select('notification_settings').eq('id', user.id).single();
      _notifTeamFilter = (prof && prof.notification_settings && prof.notification_settings.teamFilter) || {};
    } catch (_) { _notifTeamFilter = {}; }
    // Live-refresh when the user edits the filter in the settings drawer.
    document.addEventListener('cm:notiffilterchanged', e => {
      _notifTeamFilter = (e && e.detail) || {};
      _renderNotifList();
      _updateNotifBadge();
    });

    // Load last 40 notifications — bail silently if table doesn't exist.
    // Fetch a bit extra so the team filter still leaves a full-ish list.
    const { data: notifs, error: notifErr } = await window.sb
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(40);
    if (notifErr) return;
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
      const safe = _safeLink(notif?.link);
      if (safe && safe !== '#') {
        e.preventDefault();
        window.location.href = safe;
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
    // Limpiar canal viejo si existe (evita duplicados que saturan realtime)
    try { window.sb.getChannels().filter(c => c.topic.includes('cm-notif')).forEach(c => window.sb.removeChannel(c)); } catch(_){}
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
        if (_passesTeamFilter(payload.new)) _showNotifToast(payload.new);
      })
      .subscribe();
  }

  // ── CHAT NOTIFICATIONS ────────────────────────────────────────
  let _chatUnread = {};
  let _chatRecent = {};
  let _chatProfiles = {};   // profile id → profile row, so the panel can show real names + photos
  let _chatGroups = {};     // custom chat group id → { name }, so 'cg:<id>' convs show the group name

  // Icono de canal/grupo (hash-bubble), reutilizado en todas las conversaciones no-DM.
  const _HASH_AV = '<div class="cm-ci-av grp"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div>';

  // Resolve a conversation peer by their profile id (DM keys ARE the sender's profile id).
  // Falls back to the message's stored sender_name (pre-onboarding email handle) when unknown.
  function _chatName(id, fallbackName) {
    const p = (id && _chatProfiles[id]) || null;
    if (p && window.cmDisplayName) { const n = window.cmDisplayName(p); if (n) return n; }
    return fallbackName || 'Unknown';
  }
  function _chatAvHtml(id, fallbackName) {
    const p = (id && _chatProfiles[id]) || null;
    const url = (p && window.cmAvatarUrl) ? window.cmAvatarUrl(p) : null;
    if (url) return `<div class="cm-ci-av" style="overflow:hidden"><img src="${_escHtml(url)}" alt="" style="width:100%;height:100%;object-fit:cover"></div>`;
    const nm = _chatName(id, fallbackName);
    const ini = window.cmInitials ? window.cmInitials(nm) : (nm || '?').slice(0, 2).toUpperCase();
    return `<div class="cm-ci-av">${_escHtml(ini)}</div>`;
  }

  // Nombre + avatar de una conversación según su tipo. Los 4 tipos espejan a Chat & Tasks:
  // canal club ('club'), canal equipo ('group'), grupo custom ('cg:<id>') y DM (profile id).
  function _convDisplay(key, kind, fallback) {
    if (kind === 'club') return { name: '# club', av: _HASH_AV };
    if (kind === 'team') return { name: '# team', av: _HASH_AV };
    if (kind === 'cg')   { const g = _chatGroups[String(key).slice(3)]; return { name: '# ' + (g ? g.name : 'group'), av: _HASH_AV }; }
    return { name: _chatName(key, fallback), av: _chatAvHtml(key, fallback) };
  }

  function _escHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  // Solo rutas relativas o http(s); bloquea javascript:/data:/vbscript: en href de notificaciones.
  function _safeLink(u) {
    const s = String(u == null ? '' : u).trim();
    if (!s) return '#';
    return /^(https?:\/\/|\/|#|\.\/)/i.test(s) ? s : '#';
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
    // Una sola lista con TODAS las conversaciones (canal club, canal equipo, grupos custom
    // y DMs), ordenada por recencia. _chatRecent tiene una entrada por conversación; el
    // contador de no-leídos se toma de _chatUnread por la misma key.
    const convs = Object.values(_chatRecent || {})
      .map(r => ({ ...r, count: (_chatUnread[r.key] && _chatUnread[r.key].count) || 0 }))
      .sort((a, b) => (b.lastAt || '') > (a.lastAt || '') ? 1 : -1)
      .slice(0, 8);
    if (!convs.length) {
      list.innerHTML = '<div class="cm-cp-empty" data-i18n="shell.no_convs">No conversations</div>';
      _applyI18n(list);
      return;
    }
    let html = `<div class="cm-cp-sect-lbl" data-i18n="shell.recent">Recent</div>`;
    for (const r of convs) {
      // For a thread I started, the stored sender_name is MINE — don't use it as the peer's
      // fallback name; the key already points at the other person.
      const fb = r.mine ? '' : r.senderName;
      const d  = _convDisplay(r.key, r.kind, fb);
      // Prefijo del preview: "You: " si es mío; en canales/grupos, el nombre de quién escribió.
      let who = '';
      if (r.mine) who = _ttx('shell.you_prefix', 'You: ');
      else if (r.kind !== 'dm' && r.senderId) who = _chatName(r.senderId, r.senderName) + ': ';
      html += `<button class="cm-ci" data-chat-nav="1" data-conv="${_escHtml(r.key)}">
        ${d.av}
        <div class="cm-ci-body">
          <div class="cm-ci-name"><span>${_escHtml(d.name)}</span><span class="time">${_relTime(r.lastAt)}</span></div>
          <div class="cm-ci-preview">${_escHtml(who)}${_escHtml((r.lastMsg || '').slice(0,40))}</div>
        </div>
        ${r.count ? `<div class="cm-ci-count">${r.count > 9 ? '9+' : r.count}</div>` : ''}
      </button>`;
    }
    list.innerHTML = html;
    _applyI18n(list);
  }

  // Tono corto sintetizado con Web Audio (mismo que el chat) — así una notificación
  // de mensaje suena en CUALQUIER página, no solo con Chat & Tasks abierto. El
  // AudioContext se crea/reanuda perezosamente; requiere un gesto previo del usuario,
  // que en la práctica siempre existe (navegó por la app) antes del primer mensaje.
  let _chatAudioCtx = null;
  function _playChatChime() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!_chatAudioCtx) _chatAudioCtx = new AC();
      const ctx = _chatAudioCtx;
      if (ctx.state === 'suspended') ctx.resume();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(660, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.14, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.34);
    } catch (_) { /* audio bloqueado / no soportado: silencioso */ }
  }

  function _showChatToast(msg, senderName, label) {
    _playChatChime();
    const root = document.getElementById('cm-toast-root');
    if (!root) return;
    const ini = (senderName || '?').split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
    const t = document.createElement('div');
    t.className = 'cm-toast';
    t.style.cursor = 'pointer';
    t.innerHTML = `
      <div class="cm-toast-ico" style="background:rgba(99,102,241,.12);color:#4f46e5;border-radius:50%;font:600 11px/1 var(--cm-font-sans,sans-serif)">${_escHtml(ini)}</div>
      <div class="cm-toast-body">
        <div class="cm-toast-ttl">${_escHtml(senderName || 'Message')}${label ? ' · ' + _escHtml(label) : ''}</div>
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

    // El chrome de chat (botón + panel) se ancla junto a la campana. En páginas con
    // header propio (Dossier, Rehab Planner) no hay campana: NO abortamos — dejamos el
    // chrome sin inyectar pero igual nos suscribimos al realtime para que el toast y el
    // sonido lleguen. Garantizamos también que exista el cm-toast-root (que normalmente
    // crea _initNotifications, y que también depende de la campana).
    const bellBtn = [...document.querySelectorAll('.cm-icon-btn')].find(b => b.querySelector('.ti-bell'));
    if (!document.getElementById('cm-toast-root')) {
      const tr = document.createElement('div');
      tr.id = 'cm-toast-root';
      document.body.appendChild(tr);
    }
    let chatBtn = null, wrap = null, panel = null;
    if (bellBtn) {
      chatBtn = document.createElement('button');
      chatBtn.className = 'cm-icon-btn';
      chatBtn.title = 'Messages';
      chatBtn.setAttribute('aria-label', 'Messages');
      chatBtn.innerHTML = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
      wrap = document.createElement('div');
      wrap.className = 'cm-cb';
      bellBtn.parentNode.insertBefore(wrap, bellBtn);
      wrap.appendChild(chatBtn);
      const badge = document.createElement('span');
      badge.id = 'cm-cbadge';
      badge.className = 'cm-cbadge';
      wrap.appendChild(badge);
      panel = document.createElement('div');
      panel.id = 'cm-cp';
      panel.className = 'cm-cp';
      // Dos vistas dentro del mismo popover: la lista de conversaciones (cm-cp-main) y el
      // hilo inline (cm-ct) que permite leer + responder sin navegar a Chat & Tasks.
      panel.innerHTML = `
        <div id="cm-cp-main" style="display:flex;flex-direction:column;overflow:hidden;min-height:0">
          <div class="cm-cp-h"><span class="ttl" data-i18n="shell.messages">Messages</span></div>
          <div id="cm-cp-list" style="overflow-y:auto;flex:1;max-height:360px"></div>
          <div class="cm-cp-foot"><a href="Chat%20%26%20Tasks.html">Open Chat</a></div>
        </div>
        <div id="cm-ct" style="display:none;flex-direction:column;overflow:hidden;min-height:0">
          <div class="cm-ct-h">
            <button id="cm-ct-back" class="cm-ct-back" data-i18n-attr="aria-label:shell.back" aria-label="Back"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg></button>
            <span class="cm-ct-av-slot"></span>
            <span class="cm-ct-name"></span>
            <a class="cm-ct-open" href="Chat%20%26%20Tasks.html" data-i18n-attr="title:shell.open_full;aria-label:shell.open_full" title="Open in Chat &amp; Tasks"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="M10 14L21 3"/></svg></a>
          </div>
          <div id="cm-ct-msgs" class="cm-ct-msgs"></div>
          <div class="cm-ct-comp">
            <textarea id="cm-ct-inp" class="cm-ct-inp" rows="1" data-i18n-ph="shell.type_message" placeholder="Type a message…"></textarea>
            <button id="cm-ct-send" class="cm-ct-send" data-i18n-attr="aria-label:shell.send" aria-label="Send"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg></button>
          </div>
        </div>`;
      wrap.appendChild(panel);
      _applyI18n(panel);
    }

    // Expose mark-read for Chat & Tasks to call
    window.cmChatMarkRead = key => {
      delete _chatUnread[key];
      _updateChatBadge();
      _renderChatPanel();
    };

    // Initial unread counts — bail silently if either table doesn't exist yet
    const [readsRes, msgsRes, profsRes, grpsRes] = await Promise.all([
      window.sb.from('channel_reads').select('channel_key,last_read_at').eq('user_id', user.id).eq('club_id', clubId),
      // NOTE: own messages are included on purpose — a DM you started must show up in
      // "Recent" even if nobody replied yet. The unread loop below skips them explicitly.
      // group_id/team_id son necesarios para separar canal club / canal equipo / grupo custom.
      window.sb.from('messages').select('id,sender_id,recipient_id,group_id,team_id,content,created_at,sender_name')
        .eq('club_id', clubId)
        .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString())
        .order('created_at', { ascending: false }).limit(200),
      // Real names + photos for the panel (the stored sender_name is the old email handle).
      window.sb.from('profiles').select('id, full_name, first_name, last_name, email, avatar_url')
        .eq('club_id', clubId),
      // Grupos custom del usuario (RLS devuelve solo a los que pertenezco/creé) → nombre + filtro
      // de membresía para no listar mensajes de grupos ajenos.
      window.sb.from('chat_groups').select('id,name').eq('club_id', clubId)
    ]);
    _chatProfiles = {};
    (profsRes && profsRes.data || []).forEach(p => { _chatProfiles[p.id] = p; });
    _chatGroups = {};
    (grpsRes && grpsRes.data || []).forEach(g => { _chatGroups[g.id] = { name: g.name }; });

    // Tipo de conversación de un mensaje (espeja la clasificación de Chat & Tasks).
    const _msgKind = m => m.group_id ? 'cg' : (!m.recipient_id ? (m.team_id ? 'team' : 'club') : 'dm');
    // Key de conversación (== ?conv= y == channel_key). Devuelve null si el mensaje no me
    // corresponde: DM de terceros, o grupo custom del que no soy miembro.
    const _convKey = (m, uid) => {
      if (m.group_id) return _chatGroups[m.group_id] ? 'cg:' + m.group_id : null;
      if (!m.recipient_id) return m.team_id ? 'group' : 'club';
      const mine = m.sender_id === uid;
      if (!mine && m.recipient_id !== uid) return null;
      return mine ? m.recipient_id : m.sender_id;
    };
    // Si la carga inicial de contadores falla, NO abortamos: seguimos hasta suscribirnos
    // al realtime. El badge arranca vacío, pero las notificaciones (toast + sonido) de
    // mensajes entrantes siguen llegando en cualquier página.
    const _initOk = !readsRes.error && !msgsRes.error;
    const reads = _initOk ? readsRes.data : [];
    const recentMsgs = _initOk ? msgsRes.data : [];
    const readMap = {};
    (reads || []).forEach(r => { readMap[r.channel_key] = r.last_read_at; });
    for (const msg of (recentMsgs || [])) {
      if (msg.sender_id === user.id) continue;          // never unread from yourself
      const key = _convKey(msg, user.id);
      if (!key) continue;                               // DM ajeno o grupo del que no soy miembro
      const lr = readMap[key];
      if (lr && msg.created_at <= lr) continue;
      if (!_chatUnread[key]) _chatUnread[key] = { count: 0, lastMsg: '', lastAt: '', senderName: '', senderId: null };
      _chatUnread[key].count += 1;
      if (!_chatUnread[key].lastAt || msg.created_at > _chatUnread[key].lastAt) {
        _chatUnread[key].lastMsg    = msg.content || '';
        _chatUnread[key].lastAt     = msg.created_at;
        _chatUnread[key].senderName = msg.sender_name || '';
        _chatUnread[key].senderId   = msg.sender_id || null;
      }
    }
    // Historial: agrupar por conversación (reusa recentMsgs ya cargado)
    _chatRecent = {};
    for (const msg of (recentMsgs || [])) {
      const mine = msg.sender_id === user.id;
      const key  = _convKey(msg, user.id);
      if (!key) continue;
      if (!_chatRecent[key] || msg.created_at > _chatRecent[key].lastAt) {
        _chatRecent[key] = {
          key, kind: _msgKind(msg), mine,
          lastMsg: msg.content || '',
          lastAt: msg.created_at,
          senderName: msg.sender_name || '',
          senderId: msg.sender_id || null
        };
      }
    }
    _renderChatPanel();
    _updateChatBadge();

    // ── Hilo inline: leer + responder desde el panel sin salir de la página ──
    let _ctConv = null;              // { key, kind } de la conversación abierta en el panel
    let _ctTeamId = null;            // team del canal de equipo (para responder a 'group')
    const _ctRendered = new Set();   // ids ya pintados (dedup insert-echo vs realtime)

    // Marca la conversación como leída (badge fuera ya; el upsert va en background).
    function _markConvRead(conv) {
      delete _chatUnread[conv];
      _updateChatBadge();
      try {
        window.sb.from('channel_reads').upsert(
          { user_id: user.id, club_id: clubId, channel_key: conv, last_read_at: new Date().toISOString() },
          { onConflict: 'user_id,club_id,channel_key' }
        ).then(() => {}, () => {});
      } catch (_) {}
    }

    function _ctKind(key) {
      if (key === 'club') return 'club';
      if (key === 'group') return 'team';
      return String(key).startsWith('cg:') ? 'cg' : 'dm';
    }

    function _ctBubbleHtml(m) {
      const mine = m.sender_id === user.id;
      // En canales/grupos, nombre del autor arriba de la burbuja ajena (en DM sobra).
      const who = (!mine && _ctConv && _ctConv.kind !== 'dm')
        ? `<div class="cm-ct-who">${_escHtml(_chatName(m.sender_id, m.sender_name))}</div>` : '';
      const txt = m.content || (m.attachment_name ? '📎 ' + m.attachment_name : '');
      return `${who}<div class="cm-ct-bub ${mine ? 'me' : 'them'}">${_escHtml(txt)}</div>`;
    }

    function _ctAppendMsg(m) {
      const box = document.getElementById('cm-ct-msgs');
      if (!box || !_ctConv) return;
      if (m.id && _ctRendered.has(m.id)) return;
      if (m.id) _ctRendered.add(m.id);
      const empty = box.querySelector('.cm-ct-empty');
      if (empty) empty.remove();
      box.insertAdjacentHTML('beforeend', _ctBubbleHtml(m));
      box.scrollTop = box.scrollHeight;
    }

    function _closeConvThread() {
      _ctConv = null;
      _ctRendered.clear();
      const main = document.getElementById('cm-cp-main');
      const th = document.getElementById('cm-ct');
      if (main) main.style.display = 'flex';
      if (th) th.style.display = 'none';
    }

    async function _openConvThread(conv) {
      const th = document.getElementById('cm-ct');
      const main = document.getElementById('cm-cp-main');
      if (!th || !main) return;
      _ctConv = { key: conv, kind: _ctKind(conv) };
      _ctRendered.clear();
      _ctTeamId = null;
      const rec = _chatRecent[conv];
      const d = _convDisplay(conv, _ctConv.kind, (rec && !rec.mine) ? rec.senderName : '');
      main.style.display = 'none';
      th.style.display = 'flex';
      th.querySelector('.cm-ct-av-slot').innerHTML = d.av;
      th.querySelector('.cm-ct-name').textContent = d.name;
      th.querySelector('.cm-ct-open').href = 'Chat%20%26%20Tasks.html?conv=' + encodeURIComponent(conv);
      const box = document.getElementById('cm-ct-msgs');
      box.innerHTML = '<div class="cm-ct-empty">…</div>';
      _markConvRead(conv);
      _renderChatPanel();
      const inp = document.getElementById('cm-ct-inp');
      if (inp) { inp.value = ''; inp.style.height = 'auto'; inp.focus(); }

      // Últimos mensajes de la conversación (espeja los filtros de loadMessages en Chat & Tasks).
      let q = window.sb.from('messages')
        .select('id,sender_id,recipient_id,group_id,team_id,content,created_at,sender_name,attachment_name,deleted_at')
        .eq('club_id', clubId);
      if (conv === 'club') {
        q = q.is('recipient_id', null).is('group_id', null).is('team_id', null);
      } else if (conv === 'group') {
        q = q.is('recipient_id', null).is('group_id', null);
        let tid = null; try { tid = sessionStorage.getItem('cal_active_team'); } catch (_) {}
        if (tid) q = q.or(`team_id.eq.${tid},team_id.is.null`);
      } else if (_ctConv.kind === 'cg') {
        q = q.eq('group_id', conv.slice(3));
      } else {
        q = q.or(`and(sender_id.eq.${user.id},recipient_id.eq.${conv}),and(sender_id.eq.${conv},recipient_id.eq.${user.id})`);
      }
      const { data: msgs } = await q.order('created_at', { ascending: false }).limit(15);
      if (!_ctConv || _ctConv.key !== conv) return;   // cambió de hilo mientras cargaba
      // Team para responder al canal de equipo: el seleccionado en la app, o el del
      // mensaje más reciente que traiga uno (mensajes legacy vienen con team_id null).
      if (_ctConv.kind === 'team') {
        try { _ctTeamId = sessionStorage.getItem('cal_active_team') || null; } catch (_) {}
        if (!_ctTeamId) { const wt = (msgs || []).find(m => m.team_id); _ctTeamId = wt ? wt.team_id : null; }
      }
      const rows = (msgs || []).filter(m => !m.deleted_at).reverse();
      box.innerHTML = rows.length ? '' : '<div class="cm-ct-empty" data-i18n="shell.no_msgs">No messages yet</div>';
      _applyI18n(box);
      rows.forEach(m => _ctAppendMsg(m));
    }

    async function _ctSend() {
      if (!_ctConv) return;
      const inp = document.getElementById('cm-ct-inp');
      const btn = document.getElementById('cm-ct-send');
      const content = (inp && inp.value || '').trim();
      if (!content) return;
      const { key, kind } = _ctConv;
      // El canal de equipo nunca guarda team_id null (ese mensaje no lo vería nadie).
      if (kind === 'team' && !_ctTeamId) {
        alert(_ttx('shell.select_team_first', 'Open Chat & Tasks and select a team before posting to the team channel.'));
        return;
      }
      if (btn) btn.disabled = true;
      const { data, error } = await window.sb.from('messages').insert({
        club_id:      clubId,
        sender_id:    user.id,
        sender_name:  _chatName(user.id, (user.email || '').split('@')[0]),
        recipient_id: kind === 'dm' ? key : null,
        team_id:      kind === 'team' ? _ctTeamId : null,
        group_id:     kind === 'cg' ? key.slice(3) : null,
        content,
        message_type: 'text'
      }).select();
      if (btn) btn.disabled = false;
      if (error) { alert(_ttx('shell.send_failed', 'Could not send — try again.')); return; }
      if (inp) { inp.value = ''; inp.style.height = 'auto'; inp.focus(); }
      const row = (data || [])[0];
      if (row) _ctAppendMsg(row);   // el eco realtime se dedupe por id
      _markConvRead(key);           // actualiza last_read_at para el chat completo
    }

    // Realtime
    try { window.sb.getChannels().filter(c => c.topic.includes('cm-chat-notif')).forEach(c => window.sb.removeChannel(c)); } catch(_){}
    window.sb.channel(`cm-chat-notif-${clubId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `club_id=eq.${clubId}` }, payload => {
        const msg = payload.new;
        if (!msg) return;
        const key = _convKey(msg, user.id);
        if (!key) return;                       // DM ajeno o grupo del que no soy miembro
        const kind = _msgKind(msg);
        // Si el hilo inline del panel está abierto sobre esta conversación, pintar el
        // mensaje ahí mismo (dedup por id contra el eco del propio insert).
        const inThread = _ctConv && _ctConv.key === key;
        if (inThread) _ctAppendMsg(msg);
        if (msg.sender_id === user.id) {
          // My own message: never unread, but the thread must show up in "Recent" right away
          // (a DM I just started, before any reply).
          _chatRecent[key] = {
            key, kind, mine: true,
            lastMsg: msg.content || '', lastAt: msg.created_at,
            senderName: msg.sender_name || '', senderId: msg.sender_id || null
          };
          _renderChatPanel();
          return;
        }
        _chatRecent[key] = {
          key, kind, mine: false,
          lastMsg: msg.content || '', lastAt: msg.created_at,
          senderName: msg.sender_name || '', senderId: msg.sender_id || null
        };
        if (inThread) {
          // Lo estoy viendo en el hilo inline: leído al instante, sin badge ni toast.
          _markConvRead(key);
          _renderChatPanel();
          return;
        }
        if (!_chatUnread[key]) _chatUnread[key] = { count: 0, lastMsg: '', lastAt: '', senderName: '', senderId: null };
        _chatUnread[key].count += 1;
        _chatUnread[key].lastMsg    = msg.content || '';
        _chatUnread[key].lastAt     = msg.created_at;
        _chatUnread[key].senderName = msg.sender_name || '';
        _chatUnread[key].senderId   = msg.sender_id || null;
        _updateChatBadge();
        _renderChatPanel();
        const label = kind === 'club' ? '#club' : kind === 'team' ? '#team'
                    : kind === 'cg' ? ('#' + (_chatGroups[msg.group_id] ? _chatGroups[msg.group_id].name : 'group')) : '';
        _showChatToast(msg, _chatName(msg.sender_id, msg.sender_name), label);
      })
      .subscribe();

    // Los listeners del popover solo aplican si el chrome se inyectó (hay campana).
    // En páginas sin campana, el toast + sonido ya funcionan sin nada de esto.
    if (!chatBtn || !panel || !wrap) return;
    chatBtn.addEventListener('click', e => {
      e.stopPropagation();
      const open = panel.classList.toggle('is-open');
      if (!open) _closeConvThread();
      document.getElementById('cm-np')?.classList.remove('is-open');
    });
    document.addEventListener('click', e => {
      // Si el clic borró el nodo (un re-render dentro del panel), contains() daría
      // falso y cerraríamos el popover por un clic que fue ADENTRO. No es clic afuera.
      if (!e.target.isConnected) return;
      if (!wrap.contains(e.target)) {
        if (panel.classList.contains('is-open')) { panel.classList.remove('is-open'); _closeConvThread(); }
      }
    });
    panel.addEventListener('click', e => {
      // Clic en una conversación: abrir el hilo inline (leer + responder acá mismo,
      // sin navegar). El link del header del hilo lleva al chat completo.
      // stopPropagation: _openConvThread re-renderiza la lista y desconecta el botón
      // clickeado — si el evento llegara a document, se leería como clic afuera.
      const item = e.target.closest('[data-chat-nav]');
      if (item) { e.stopPropagation(); _openConvThread(item.dataset.conv || 'group'); return; }
      if (e.target.closest('#cm-ct-back')) { e.stopPropagation(); _closeConvThread(); return; }
      if (e.target.closest('#cm-ct-send')) { e.stopPropagation(); _ctSend(); return; }
    });
    const ctInp = panel.querySelector('#cm-ct-inp');
    if (ctInp) {
      ctInp.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); _ctSend(); }
        else if (e.key === 'Escape') { e.stopPropagation(); _closeConvThread(); }
      });
      ctInp.addEventListener('input', () => {
        ctInp.style.height = 'auto';
        ctInp.style.height = Math.min(ctInp.scrollHeight, 90) + 'px';
      });
    }
  }

  // ── LIVE PRESENCE (who's online, per club) ───────────────────
  // Supabase Realtime *Presence*: ephemeral, no DB tables. Each client tracks
  // { userId, name, avatar, color, page } on a club-scoped channel; everyone
  // receives the merged state live. Scoping by club is the ONLY privacy barrier
  // (Presence isn't governed by RLS), so the channel name MUST carry the clubId.
  const _PRESENCE_COLORS = ['#2563EB','#16A34A','#D97706','#7C3AED','#DC2626','#0891B2','#DB2777','#65A30D','#EA580C','#4F46E5','#0D9488','#9333EA'];
  function _presenceColor(id) {
    let h = 0; const s = String(id || '');
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return _PRESENCE_COLORS[h % _PRESENCE_COLORS.length];
  }
  // Friendly current-page name for the tooltip ("Ana · GPS Analysis").
  function _prettyPage() {
    const t = (document.title || '').split(/[—|·]/)[0].trim();
    if (t && !/^clavametrics$/i.test(t)) return t;
    return decodeURIComponent((location.pathname.split('/').pop() || '').replace(/\.html$/i, '')) || 'App';
  }
  // Translated role label, reusing the admin.role_* keys; humanized fallback.
  function _prettyRole(r) {
    if (!r) return '';
    const k = String(r).toLowerCase();
    const fb = k.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    return _ttx('admin.role_' + k, fb);
  }
  const _reduceMotion = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } };

  // Custom tooltip (one reused node) — replaces the plain browser title.
  let _ptEl = null;
  function _presenceTip() {
    if (_ptEl) return _ptEl;
    _ptEl = document.createElement('div');
    _ptEl.className = 'cm-pt';
    _ptEl.innerHTML = `<span class="cm-pt-dot"></span><span class="cm-pt-txt"><span class="cm-pt-name"></span><span class="cm-pt-meta"></span></span>`;
    document.body.appendChild(_ptEl);
    return _ptEl;
  }
  function _showTip(el) {
    const tip = _presenceTip();
    const isMore = el.classList.contains('more');
    const dot = tip.querySelector('.cm-pt-dot');
    dot.style.display = isMore ? 'none' : 'block';
    dot.style.background = el.style.getPropertyValue('--pb') || 'var(--cm-fg-muted)';
    tip.querySelector('.cm-pt-name').textContent = el.dataset.name || '—';
    const meta = [el.dataset.role, el.dataset.page].filter(Boolean).join(' · ');
    const metaEl = tip.querySelector('.cm-pt-meta');
    metaEl.textContent = meta; metaEl.style.display = meta ? 'block' : 'none';
    tip.classList.add('on');
    const r = el.getBoundingClientRect(), tr = tip.getBoundingClientRect();
    let left = r.left + r.width / 2 - tr.width / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - tr.width - 8));
    tip.style.left = left + 'px';
    tip.style.top = (r.bottom + 8) + 'px';
  }
  function _hideTip() { if (_ptEl) _ptEl.classList.remove('on'); }

  function _pbInner(m) {
    return m.avatar
      ? `<img src="${_escHtml(m.avatar)}" alt="" onerror="this.remove()">`
      : _escHtml((m.name || '?').trim().slice(0, 1).toUpperCase() || '?');
  }
  // Keyed, incremental render: bubbles persist across syncs so joins animate in
  // and leaves animate out (instead of a full innerHTML swap that pops).
  function _renderPresence(box, states, selfId, selfPage) {
    const byUser = new Map();
    Object.values(states || {}).forEach(arr => (arr || []).forEach(m => {
      if (!m || !m.userId || m.userId === selfId) return;   // others only
      if (!byUser.has(m.userId)) byUser.set(m.userId, m);    // one bubble per person (any tab)
    }));
    const people = [...byUser.values()];
    let stack = box.querySelector('.cm-presence-stack');
    if (!stack) { stack = document.createElement('span'); stack.className = 'cm-presence-stack'; box.appendChild(stack); }
    box.style.display = people.length ? 'inline-flex' : 'none';

    const MAX = 5;
    const shown = people.slice(0, MAX);
    const extra = people.length - shown.length;
    const wantIds = new Set(shown.map(m => m.userId));

    // Leave animation for anyone no longer present.
    stack.querySelectorAll('.cm-pb[data-uid]').forEach(el => {
      if (wantIds.has(el.dataset.uid) || el.classList.contains('leaving')) return;
      if (_reduceMotion()) { el.remove(); return; }
      el.classList.add('leaving');
      el.addEventListener('animationend', () => el.remove(), { once: true });
      setTimeout(() => { if (el.isConnected) el.remove(); }, 300);   // safety net
    });

    // Add / update visible people, preserving people-order in the DOM.
    shown.forEach(m => {
      let el = stack.querySelector(`.cm-pb[data-uid="${CSS.escape(m.userId)}"]:not(.leaving)`);
      const col = m.color || _presenceColor(m.userId);
      const here = !!(selfPage && m.page && m.page === selfPage);
      const sig = (m.avatar || '') + '|' + (m.name || '');
      if (!el) {
        el = document.createElement('span');
        el.className = 'cm-pb';
        el.dataset.uid = m.userId;
        el.innerHTML = _pbInner(m);
        el.dataset.sig = sig;
        if (!_reduceMotion()) {
          el.classList.add('entering');
          el.addEventListener('animationend', () => el.classList.remove('entering'), { once: true });
        }
      } else if (el.dataset.sig !== sig) {
        el.innerHTML = _pbInner(m);
        el.dataset.sig = sig;
      }
      el.style.setProperty('--pb', col);
      el.style.borderColor = col;
      el.style.background = col;
      el.classList.toggle('is-here', here);      // (B) same-page emphasis
      el.dataset.name = m.name || '—';
      el.dataset.page = m.page || '';
      el.dataset.role = _prettyRole(m.role);
      stack.appendChild(el);                     // reorder to match people order
    });

    // "+N more" pill.
    let moreEl = stack.querySelector('.cm-pb.more');
    if (extra > 0) {
      if (!moreEl) { moreEl = document.createElement('span'); moreEl.className = 'cm-pb more'; }
      moreEl.textContent = `+${extra}`;
      moreEl.dataset.name = `${extra} ${_ttx('shell.presence_more', 'more online')}`;
      moreEl.dataset.role = ''; moreEl.dataset.page = '';
      stack.appendChild(moreEl);
    } else if (moreEl) { moreEl.remove(); }
  }
  async function _initPresence() {
    let attempts = 0;
    while (!window.sb && attempts < 20) { await new Promise(r => setTimeout(r, 200)); attempts++; }
    if (!window.sb) return;
    const { data: { user } } = await window.sb.auth.getUser();
    if (!user) return;
    let profile = null;
    try { profile = (typeof window.getProfile === 'function') ? await window.getProfile() : null; } catch (_) {}
    let clubId = profile?.club_id;
    if (!clubId && window.getClubId) { try { clubId = await window.getClubId(); } catch (_) {} }
    if (!clubId) return;

    // Anchor into the topbar actions cluster (present on every shell page).
    const bell = [...document.querySelectorAll('.cm-icon-btn')].find(b => b.querySelector('.ti-bell'));
    const actions = document.querySelector('.cm-topbar-actions')
      || (bell && bell.closest('.cm-topbar-actions')) || (bell && bell.parentNode);
    if (!actions || document.getElementById('cm-presence')) return;
    const box = document.createElement('div');
    box.id = 'cm-presence'; box.className = 'cm-presence'; box.style.display = 'none';
    actions.insertBefore(box, actions.firstChild);
    // (E) custom tooltip on hover — delegated.
    box.addEventListener('mouseover', e => { const el = e.target.closest('.cm-pb'); if (el) _showTip(el); });
    box.addEventListener('mouseout', e => { const el = e.target.closest('.cm-pb'); if (el && !el.contains(e.relatedTarget)) _hideTip(); });

    const name = (window.cmDisplayName ? window.cmDisplayName(profile) : (profile?.full_name || '')) || 'Someone';
    const avatar = (window.cmAvatarUrl ? window.cmAvatarUrl(profile) : null) || null;
    const selfPage = _prettyPage();
    const meta = { userId: user.id, name, avatar, color: _presenceColor(user.id), page: selfPage, role: profile?.role || '' };

    // Drop any stale presence channel from a prior mount (re-entrancy safe).
    try { window.sb.getChannels().filter(c => c.topic.includes('cm-presence')).forEach(c => window.sb.removeChannel(c)); } catch (_) {}
    const chan = window.sb.channel(`cm-presence-${clubId}`, { config: { presence: { key: user.id } } });
    chan.on('presence', { event: 'sync' }, () => _renderPresence(box, chan.presenceState(), user.id, selfPage));
    chan.subscribe(async status => { if (status === 'SUBSCRIBED') { try { await chan.track(meta); } catch (_) {} } });
    // Leave cleanly when the tab goes away (Supabase also auto-reaps on disconnect).
    window.addEventListener('pagehide', () => { try { chan.untrack(); window.sb.removeChannel(chan); } catch (_) {} });
  }

  // The sport is served from localStorage on the first paint and confirmed against the DB
  // a moment later. When they disagree — the first load after a club changes sport, or
  // right after signing into a different club — the nav has already been built with the
  // wrong vocabulary. Patch it in place instead of re-injecting the whole sidebar, which
  // would drop the drag handlers, the notification panel and the presence wiring.
  function _applySportToNav() {
    const nav = _sportNav();
    const hidden = new Set(nav.hidden || []);
    document.querySelectorAll('.hub-nav-item[data-mod]').forEach(el => {
      const key = el.dataset.mod;
      if (hidden.has(key)) { el.remove(); return; }
      const icon = nav.icons && nav.icons[key];
      if (icon) {
        const i = el.querySelector('i.ti');
        if (i) i.className = 'ti ' + icon;
      }
      const txt = el.querySelector('.hub-nav-txt');
      if (txt && window.CMSport) {
        // Re-derive from the canonical key, not from whatever is on the node: this may be
        // the second sport change in one session.
        const base = 'shell.nav.' + key;
        const mapped = window.CMSport.i18nKey(base);
        if (mapped !== txt.getAttribute('data-i18n')) txt.setAttribute('data-i18n', mapped);
      }
    });
    // Groups can end up empty once items are removed.
    document.querySelectorAll('.hub-nav-group').forEach(g => {
      if (!g.querySelector('.hub-nav-item')) g.style.display = 'none';
    });
    _applyI18n(document);
  }
  window.addEventListener('cm:sport-change', _applySportToNav);

  // ── BOOT ─────────────────────────────────────────────────────
  // Re-translate the whole shell whenever the i18n runtime boots or the user
  // switches language (covers the sidebar + the dynamically-built chrome panels).
  document.addEventListener('cm:langchanged', () => _applyI18n(document));
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { inject(); _paintCachedBrand(); loadData(); _initNotifications(); _initChatNotif(); _initPresence(); });
  } else {
    inject();
    _paintCachedBrand();
    loadData();
    _initNotifications();
    _initChatNotif();
    _initPresence();
  }
})();
