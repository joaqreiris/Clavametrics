(()=>{var A="cm-settings.v1";function R(){try{let t=localStorage.getItem(A);return t?JSON.parse(t):{}}catch{return{}}}function S(t){try{localStorage.setItem(A,JSON.stringify(t))}catch{}}var w={light:{neutral:{hue:"#0A0A0A",soft:"#F4F4F2",tokens:{"--cm-accent":"#0A0A0A","--cm-accent-hover":"#1F1F1F","--cm-accent-press":"#000","--cm-accent-soft":"#F4F4F2","--cm-fg-on-accent":"#fff"}},green:{hue:"#15803D",soft:"#ECFDF5",tokens:{"--cm-accent":"#15803D","--cm-accent-hover":"#166534","--cm-accent-press":"#14532D","--cm-accent-soft":"#ECFDF5","--cm-fg-on-accent":"#fff"}},blue:{hue:"#2563EB",soft:"#EFF6FF",tokens:{"--cm-accent":"#2563EB","--cm-accent-hover":"#1D4ED8","--cm-accent-press":"#1E40AF","--cm-accent-soft":"#EFF6FF","--cm-fg-on-accent":"#fff"}},violet:{hue:"#7C3AED",soft:"#F5F3FF",tokens:{"--cm-accent":"#7C3AED","--cm-accent-hover":"#6D28D9","--cm-accent-press":"#5B21B6","--cm-accent-soft":"#F5F3FF","--cm-fg-on-accent":"#fff"}},gold:{hue:"#A87C2A",soft:"#FAF3E2",tokens:{"--cm-accent":"#A87C2A","--cm-accent-hover":"#8C6520","--cm-accent-press":"#75531B","--cm-accent-soft":"#FAF3E2","--cm-fg-on-accent":"#fff"}}},dark:{neutral:{hue:"#FAFAFA",soft:"rgba(255,255,255,0.06)",tokens:{"--cm-accent":"#FAFAFA","--cm-accent-hover":"#E5E5E5","--cm-accent-press":"#fff","--cm-accent-soft":"rgba(255,255,255,0.06)","--cm-fg-on-accent":"#0A0A0A"}},green:{hue:"#22C55E",soft:"rgba(34,197,94,0.10)",tokens:{"--cm-accent":"#22C55E","--cm-accent-hover":"#16A34A","--cm-accent-press":"#15803D","--cm-accent-soft":"rgba(34,197,94,0.10)","--cm-fg-on-accent":"#0A0A0A"}},blue:{hue:"#3B82F6",soft:"rgba(59,130,246,0.10)",tokens:{"--cm-accent":"#3B82F6","--cm-accent-hover":"#2563EB","--cm-accent-press":"#1D4ED8","--cm-accent-soft":"rgba(59,130,246,0.10)","--cm-fg-on-accent":"#fff"}},violet:{hue:"#A78BFA",soft:"rgba(167,139,250,0.10)",tokens:{"--cm-accent":"#A78BFA","--cm-accent-hover":"#8B5CF6","--cm-accent-press":"#7C3AED","--cm-accent-soft":"rgba(167,139,250,0.10)","--cm-fg-on-accent":"#0A0A0A"}},gold:{hue:"#C9A84C",soft:"rgba(201,168,76,0.12)",tokens:{"--cm-accent":"#C9A84C","--cm-accent-hover":"#A87C2A","--cm-accent-press":"#8B6520","--cm-accent-soft":"rgba(201,168,76,0.12)","--cm-fg-on-accent":"#0A0A0A"}}},hybrid:{neutral:{hue:"#0A0A0A",soft:"#F4F4F2",tokens:{"--cm-accent":"#0A0A0A","--cm-accent-hover":"#1F1F1F","--cm-accent-press":"#000","--cm-accent-soft":"#F4F4F2","--cm-fg-on-accent":"#fff","--cm-side-item-active-bg":"rgba(255,255,255,0.06)","--cm-side-item-active-fg":"#fff","--cm-side-accent":"#fff"}},green:{hue:"#15803D",soft:"#ECFDF5",tokens:{"--cm-accent":"#15803D","--cm-accent-hover":"#166534","--cm-accent-press":"#14532D","--cm-accent-soft":"#ECFDF5","--cm-fg-on-accent":"#fff","--cm-side-item-active-bg":"rgba(34,197,94,0.10)","--cm-side-item-active-fg":"#4ADE80","--cm-side-accent":"#4ADE80"}},blue:{hue:"#2563EB",soft:"#EFF6FF",tokens:{"--cm-accent":"#2563EB","--cm-accent-hover":"#1D4ED8","--cm-accent-press":"#1E40AF","--cm-accent-soft":"#EFF6FF","--cm-fg-on-accent":"#fff","--cm-side-item-active-bg":"rgba(59,130,246,0.14)","--cm-side-item-active-fg":"#60A5FA","--cm-side-accent":"#60A5FA"}},violet:{hue:"#7C3AED",soft:"#F5F3FF",tokens:{"--cm-accent":"#7C3AED","--cm-accent-hover":"#6D28D9","--cm-accent-press":"#5B21B6","--cm-accent-soft":"#F5F3FF","--cm-fg-on-accent":"#fff","--cm-side-item-active-bg":"rgba(167,139,250,0.14)","--cm-side-item-active-fg":"#A78BFA","--cm-side-accent":"#A78BFA"}},gold:{hue:"#A87C2A",soft:"#FAF3E2",tokens:{"--cm-accent":"#A87C2A","--cm-accent-hover":"#8C6520","--cm-accent-press":"#75531B","--cm-accent-soft":"#FAF3E2","--cm-fg-on-accent":"#fff","--cm-side-item-active-bg":"rgba(201,168,76,0.16)","--cm-side-item-active-fg":"#E5C875","--cm-side-accent":"#E5C875"}}}},_={default:{},ink:{"--cm-side-bg":"#0A0A0A"},slate:{"--cm-side-bg":"#0F172A"},forest:{"--cm-side-bg":"#0D1F17"},zinc:{"--cm-side-bg":"#18181B"}},I={tight:{"--cm-r-2":"4px","--cm-r-3":"5px","--cm-r-4":"6px","--cm-r-5":"8px","--cm-r-6":"10px"},regular:{},soft:{"--cm-r-2":"8px","--cm-r-3":"10px","--cm-r-4":"14px","--cm-r-5":"18px","--cm-r-6":"22px"}},T={compact:{"--cm-density-pad":"10px"},balanced:{"--cm-density-pad":"14px"},comfortable:{"--cm-density-pad":"20px"}};function F(t){let o=document.documentElement;o.setAttribute("data-theme",t.theme),["--cm-accent","--cm-accent-hover","--cm-accent-press","--cm-accent-soft","--cm-fg-on-accent","--cm-side-item-active-bg","--cm-side-item-active-fg","--cm-side-accent","--cm-side-bg","--cm-r-2","--cm-r-3","--cm-r-4","--cm-r-5","--cm-r-6","--cm-density-pad"].forEach(n=>o.style.removeProperty(n));let m=w[t.theme]&&w[t.theme][t.accent]||{};Object.entries(m.tokens||{}).forEach(([n,a])=>o.style.setProperty(n,a)),Object.entries(_[t.sidebarHue]||{}).forEach(([n,a])=>o.style.setProperty(n,a)),Object.entries(I[t.radius]||{}).forEach(([n,a])=>o.style.setProperty(n,a)),Object.entries(T[t.density]||{}).forEach(([n,a])=>o.style.setProperty(n,a))}function y(){let t=R(),o=window.__CM_TWEAK_DEFAULTS||{theme:"light",accent:"neutral"},s=Object.assign({theme:"light",accent:"neutral",radius:"regular",density:"balanced",sidebarHue:"default"},o,t);return F(s),s}var z=({notif:t,onDismiss:o})=>(React.useEffect(()=>{let s=setTimeout(o,4e3);return()=>clearTimeout(s)},[]),React.createElement("div",{className:"cm-toast",onClick:()=>{t.link&&(window.location.href=t.link),o()}},React.createElement("i",{className:"ti ti-bell cm-toast-icon"}),React.createElement("div",{className:"cm-toast-body"},React.createElement("div",{className:"cm-toast-title"},t.title),t.body&&React.createElement("div",{className:"cm-toast-sub"},t.body)),React.createElement("button",{className:"cm-toast-x",onClick:s=>{s.stopPropagation(),o()}},React.createElement("i",{className:"ti ti-x"})))),j=()=>{let[t,o]=React.useState(null),[s,m]=React.useState(!0);React.useEffect(()=>{window.getClub&&window.getClub().then(u=>{o(u),m(!1)})},[]);let n=(t==null?void 0:t.billing_plan)||null,a=(t==null?void 0:t.billing_amount)||null,g=(t==null?void 0:t.billing_next_date)||null,p=(t==null?void 0:t.billing_status)||null;return React.createElement(React.Fragment,null,React.createElement("div",{className:"sd-section"},React.createElement("div",{className:"sd-section-h"},React.createElement("div",{className:"sd-section-l"},"Workspace subscription")),React.createElement("div",{className:"sd-section-body"},React.createElement("div",{className:"sd-billing-card"},React.createElement("div",{className:"sd-billing-row"},React.createElement("span",{className:"sd-row-label"},"Plan"),React.createElement("span",{className:"sd-billing-val"},s?"\u2026":n||"\u2014")),React.createElement("div",{className:"sd-billing-row"},React.createElement("span",{className:"sd-row-label"},"Monthly amount"),React.createElement("span",{className:"sd-billing-val"},s?"\u2026":a?`$${a}`:"\u2014")),React.createElement("div",{className:"sd-billing-row"},React.createElement("span",{className:"sd-row-label"},"Next billing date"),React.createElement("span",{className:"sd-billing-val"},s?"\u2026":g?new Date(g).toLocaleDateString([],{month:"long",day:"numeric",year:"numeric"}):"\u2014")),React.createElement("div",{className:"sd-billing-row"},React.createElement("span",{className:"sd-row-label"},"Status"),React.createElement("span",{className:"sd-billing-val",style:{color:p==="active"?"var(--cm-success)":"var(--cm-fg-muted)"}},s?"\u2026":p||"\u2014"))),React.createElement("div",{style:{padding:"10px 14px",borderTop:"1px solid var(--cm-border-soft)"}},React.createElement("a",{href:"Billing.html",style:{display:"inline-flex",alignItems:"center",gap:6,fontSize:12.5,fontWeight:500,color:"var(--cm-accent)",textDecoration:"none"}},"Ver detalle completo ",React.createElement("i",{className:"ti ti-arrow-right",style:{fontSize:13}}))),React.createElement("div",{className:"sd-note",style:{marginTop:12}},React.createElement("i",{className:"ti ti-brand-stripe"}),"Billing is managed via Stripe. Subscription data syncs automatically when the webhook is active. Contact your admin to change plans."))))},D=({open:t,onClose:o,profile:s,supabaseSettings:m,onSettingsChange:n})=>{let[a,g]=React.useState(y),[p,u]=React.useState("appearance"),[v,b]=React.useState(!1);React.useEffect(()=>{F(a),S(a),n&&n(a)},[a]),React.useEffect(()=>{m&&g(e=>{let c={...e,...m};return F(c),S(c),c})},[m]),React.useEffect(()=>{let e=c=>{c.key==="Escape"&&o()};return t&&document.addEventListener("keydown",e),()=>document.removeEventListener("keydown",e)},[t]),React.useEffect(()=>{if(!t)return;let e=document.body.style.overflow;return document.body.style.overflow="hidden",()=>{document.body.style.overflow=e}},[t]),React.useEffect(()=>{t||b(!1)},[t]);let f=e=>g(c=>({...c,...e})),x=(e,c)=>f({notif:{...a.notif,[e]:c}}),k=e=>e==="dark"?"#0A0A0A":e==="hybrid"?"linear-gradient(90deg,#0E1116 0%,#0E1116 30%,#FBFBFA 30%,#FBFBFA 100%)":"#FBFBFA",r=e=>e==="dark"?"rgba(255,255,255,0.10)":"#E5E7EB",d=Object.entries(w[a.theme]),i=({label:e,children:c,hint:l})=>React.createElement("div",{className:"sd-section"},React.createElement("div",{className:"sd-section-h"},React.createElement("div",{className:"sd-section-l"},e),l?React.createElement("div",{className:"sd-section-hint"},l):null),React.createElement("div",{className:"sd-section-body"},c)),N=({label:e,sub:c,children:l})=>React.createElement("div",{className:"sd-row"},React.createElement("div",{className:"sd-row-l"},React.createElement("div",{className:"sd-row-label"},e),c?React.createElement("div",{className:"sd-row-sub"},c):null),React.createElement("div",{className:"sd-row-c"},l));return React.createElement(React.Fragment,null,React.createElement("style",null,P),React.createElement("div",{className:`sd-overlay ${t?"is-open":""}`,onClick:o}),React.createElement("aside",{className:`sd-drawer ${t?"is-open":""}`,role:"dialog","aria-label":"Settings"},React.createElement("header",{className:"sd-head"},React.createElement("div",{className:"sd-head-l"},React.createElement("i",{className:"ti ti-settings"}),React.createElement("div",null,React.createElement("div",{className:"sd-title"},"Settings"),React.createElement("div",{className:"sd-sub"},"Appearance \xB7 workspace \xB7 account"))),React.createElement("button",{className:"sd-x",onClick:o,"aria-label":"Close"},React.createElement("i",{className:"ti ti-x"}))),React.createElement("nav",{className:"sd-tabs"},[{id:"appearance",icon:"ti-palette",label:"Appearance"},{id:"notifications",icon:"ti-bell",label:"Notifications"},{id:"account",icon:"ti-shield-lock",label:"Account"},{id:"billing",icon:"ti-credit-card",label:"Billing"}].map(({id:e,icon:c,label:l})=>React.createElement("button",{key:e,className:`sd-tab ${p===e?"is-on":""}`,onClick:()=>u(e)},React.createElement("i",{className:`ti ${c}`}),l))),React.createElement("div",{className:"sd-body"},p==="appearance"&&React.createElement(React.Fragment,null,React.createElement(i,{label:"Theme",hint:"How the chrome looks across the app."},React.createElement("div",{className:"sd-tiles"},["light","dark","hybrid"].map(e=>React.createElement("button",{key:e,className:`sd-tile ${a.theme===e?"is-on":""}`,onClick:()=>f({theme:e,accent:w[e][a.accent]?a.accent:"green"})},React.createElement("div",{className:"sd-tile-pv",style:{background:k(e),borderColor:r(e)}},React.createElement("div",{className:"sd-tile-pv-bar",style:{background:e==="dark"?"rgba(255,255,255,0.08)":e==="hybrid"?"rgba(255,255,255,0.06)":"#EFEFED"}}),React.createElement("div",{className:"sd-tile-pv-c",style:{background:e==="dark"?"#161616":"#fff",borderColor:r(e)}})),React.createElement("div",{className:"sd-tile-label"},React.createElement("span",null,e==="light"?"Light":e==="dark"?"Dark":"Hybrid"),a.theme===e?React.createElement("i",{className:"ti ti-check"}):null))))),React.createElement(i,{label:"Accent",hint:"Used for primary buttons, active nav, and focus rings."},React.createElement("div",{className:"sd-swatches"},d.map(([e,c])=>React.createElement("button",{key:e,className:`sd-swatch ${a.accent===e?"is-on":""}`,onClick:()=>f({accent:e}),title:e},React.createElement("span",{className:"sd-swatch-hue",style:{background:c.hue}}),React.createElement("span",{className:"sd-swatch-name"},e))))),a.theme!=="light"?React.createElement(i,{label:"Sidebar tone"},React.createElement("div",{className:"sd-chips"},[{v:"default",l:"Default"},{v:"ink",l:"Ink"},{v:"slate",l:"Slate"},{v:"forest",l:"Forest"},{v:"zinc",l:"Zinc"}].map(e=>React.createElement("button",{key:e.v,className:`sd-chip ${a.sidebarHue===e.v?"is-on":""}`,onClick:()=>f({sidebarHue:e.v})},e.l)))):null,React.createElement(i,{label:"Density",hint:"Affects vertical padding inside cards & tables."},React.createElement("div",{className:"sd-chips"},[{v:"compact",l:"Compact"},{v:"balanced",l:"Balanced"},{v:"comfortable",l:"Comfy"}].map(e=>React.createElement("button",{key:e.v,className:`sd-chip ${a.density===e.v?"is-on":""}`,onClick:()=>f({density:e.v})},e.l)))),React.createElement(i,{label:"Corners"},React.createElement("div",{className:"sd-chips"},[{v:"tight",l:"Tight"},{v:"regular",l:"Regular"},{v:"soft",l:"Soft"}].map(e=>React.createElement("button",{key:e.v,className:`sd-chip ${a.radius===e.v?"is-on":""}`,onClick:()=>f({radius:e.v})},e.l)))),React.createElement(i,{label:"Reset"},v?React.createElement("div",{className:"sd-reset-confirm"},React.createElement("span",null,"Reset all appearance settings?"),React.createElement("button",{className:"sd-reset-yes",onClick:()=>{localStorage.removeItem(A);let e=y();g(e),b(!1)}},React.createElement("i",{className:"ti ti-check"}),"Yes, reset"),React.createElement("button",{className:"sd-reset-no",onClick:()=>b(!1)},"Cancel")):React.createElement("button",{className:"sd-reset",onClick:()=>b(!0)},React.createElement("i",{className:"ti ti-rotate"}),"Reset to workspace defaults"))),p==="notifications"&&React.createElement(React.Fragment,null,React.createElement(i,{label:"In-app alerts",hint:"Shown as badges and banners inside the app."},[{key:"alertInjury",label:"Injury reported",sub:"Badge on the Treatments nav item"},{key:"alertTask",label:"Task assigned to me",sub:"Badge on the Tasks nav item"},{key:"alertSession",label:"Session published",sub:"Shown in Hub activity feed"}].map(({key:e,label:c,sub:l})=>React.createElement("div",{key:e,className:"sd-toggle-row"},React.createElement("div",{className:"sd-row-l"},React.createElement("div",{className:"sd-row-label"},c),React.createElement("div",{className:"sd-row-sub"},l)),React.createElement("button",{role:"switch","aria-checked":!!(a.notif&&a.notif[e]),className:`sd-toggle ${a.notif&&a.notif[e]?"is-on":""}`,onClick:()=>x(e,!(a.notif&&a.notif[e]))},React.createElement("span",{className:"sd-toggle-thumb"}))))),React.createElement(i,{label:"Email digest",hint:"Requires email delivery to be configured by the workspace admin."},[{key:"emailWeekly",label:"Weekly summary",sub:"Sent every Monday morning"},{key:"emailInjury",label:"Injury alerts",sub:"Immediate \u2014 for medical staff"}].map(({key:e,label:c,sub:l})=>React.createElement("div",{key:e,className:"sd-toggle-row"},React.createElement("div",{className:"sd-row-l"},React.createElement("div",{className:"sd-row-label"},c),React.createElement("div",{className:"sd-row-sub"},l)),React.createElement("button",{role:"switch","aria-checked":!!(a.notif&&a.notif[e]),className:`sd-toggle ${a.notif&&a.notif[e]?"is-on":""}`,onClick:()=>x(e,!(a.notif&&a.notif[e]))},React.createElement("span",{className:"sd-toggle-thumb"})))),React.createElement("div",{className:"sd-note"},React.createElement("i",{className:"ti ti-info-circle"}),"Email delivery is not yet configured for this workspace. Preferences are saved for when it is."))),p==="account"&&React.createElement(React.Fragment,null,React.createElement(i,{label:"Signed in as"},React.createElement("div",{className:"sd-account-row"},React.createElement("div",{className:"sd-account-avatar"},s?(s.full_name||s.email||"?")[0].toUpperCase():"?"),React.createElement("div",null,(s==null?void 0:s.full_name)&&React.createElement("div",{className:"sd-row-label"},s.full_name),React.createElement("div",{className:"sd-row-sub"},(s==null?void 0:s.email)||"\u2014"),React.createElement("div",{className:"sd-row-sub",style:{marginTop:2}},(s==null?void 0:s.role)||"")))),React.createElement(i,{label:"Session"},React.createElement("button",{className:"sd-reset sd-signout",onClick:async()=>{await window.sb.auth.signOut(),window.location.href="Login.html"}},React.createElement("i",{className:"ti ti-logout"}),"Sign out"))),p==="billing"&&React.createElement(j,null)),React.createElement("footer",{className:"sd-foot"},React.createElement("span",null,React.createElement("i",{className:"ti ti-cloud"}),"Saved to cloud & this device"))))},P=`
  .sd-overlay { position:fixed; inset:0; background:rgba(8,10,12,0.45); backdrop-filter:blur(4px); opacity:0; pointer-events:none; transition:opacity 200ms cubic-bezier(.2,.7,.2,1); z-index:900; }
  .sd-overlay.is-open { opacity:1; pointer-events:auto; }

  .sd-drawer {
    position:fixed; top:0; right:0; bottom:0; width:420px; max-width:96vw;
    background:var(--cm-bg);
    color:var(--cm-fg);
    border-left:1px solid var(--cm-border);
    box-shadow:0 24px 80px rgba(0,0,0,0.18);
    transform:translateX(100%);
    transition:transform 280ms cubic-bezier(.2,.7,.2,1);
    z-index:910;
    display:flex; flex-direction:column;
    font:var(--cm-body);
  }
  .sd-drawer.is-open { transform:translateX(0); }

  .sd-head { display:flex; align-items:center; gap:12px; padding:18px 20px; border-bottom:1px solid var(--cm-border); }
  .sd-head-l { display:flex; align-items:center; gap:12px; flex:1; }
  .sd-head-l > i { font-size:20px; color:var(--cm-fg-muted); }
  .sd-title { font:600 16px/1 var(--cm-font-sans); letter-spacing:-0.01em; color:var(--cm-fg-strong); }
  .sd-sub { font:500 11.5px/1 var(--cm-font-mono); color:var(--cm-fg-muted); margin-top:3px; }
  .sd-x { width:32px; height:32px; display:flex; align-items:center; justify-content:center; border-radius:8px; border:1px solid var(--cm-border); background:transparent; color:var(--cm-fg-muted); cursor:pointer; }
  .sd-x:hover { background:var(--cm-bg-soft); color:var(--cm-fg); }
  .sd-x .ti { font-size:16px; }

  .sd-tabs { display:flex; gap:2px; padding:8px 12px; border-bottom:1px solid var(--cm-border); overflow-x:auto; }
  .sd-tab {
    display:inline-flex; align-items:center; gap:6px;
    height:30px; padding:0 10px;
    border:1px solid transparent; border-radius:7px;
    background:transparent; color:var(--cm-fg-muted);
    font:500 12.5px/1 var(--cm-font-sans); cursor:pointer;
    white-space:nowrap;
  }
  .sd-tab .ti { font-size:14px; }
  .sd-tab:hover { background:var(--cm-bg-soft); color:var(--cm-fg); }
  .sd-tab.is-on { background:var(--cm-accent-soft); color:var(--cm-fg-strong); border-color:var(--cm-border); }

  .sd-body { flex:1; overflow-y:auto; padding:8px 20px 24px; }
  .sd-section { padding:18px 0; border-bottom:1px solid var(--cm-border-soft); }
  .sd-section:last-child { border-bottom:0; }
  .sd-section-h { margin-bottom:12px; }
  .sd-section-l { font:600 13px/1 var(--cm-font-sans); color:var(--cm-fg-strong); }
  .sd-section-hint { font:500 12px/1.4 var(--cm-font-sans); color:var(--cm-fg-muted); margin-top:4px; }

  /* Theme tiles */
  .sd-tiles { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; }
  .sd-tile {
    border:1px solid var(--cm-border);
    border-radius:10px;
    padding:8px 8px 10px;
    background:var(--cm-surface);
    cursor:pointer;
    text-align:left;
    transition:border-color 120ms, box-shadow 120ms;
  }
  .sd-tile:hover { border-color:var(--cm-border-strong); }
  .sd-tile.is-on { border-color:var(--cm-accent); box-shadow:0 0 0 3px var(--cm-focus-ring); }
  .sd-tile-pv {
    height:64px; border-radius:6px; overflow:hidden;
    position:relative; border:1px solid;
  }
  .sd-tile-pv-bar { position:absolute; top:0; left:0; right:0; height:12px; }
  .sd-tile-pv-c { position:absolute; left:30%; top:18px; right:8px; bottom:8px; border-radius:4px; border:1px solid; }
  .sd-tile-label { display:flex; align-items:center; justify-content:space-between; padding:8px 4px 0; font:500 13px/1 var(--cm-font-sans); color:var(--cm-fg-strong); }
  .sd-tile-label .ti { font-size:14px; color:var(--cm-accent); }

  /* Accent swatches */
  .sd-swatches { display:grid; grid-template-columns:repeat(5,1fr); gap:8px; }
  .sd-swatch {
    border:1px solid var(--cm-border);
    background:var(--cm-surface);
    border-radius:9px;
    padding:8px 6px 7px;
    display:flex; flex-direction:column; align-items:center; gap:6px;
    cursor:pointer;
    transition:border-color 120ms, box-shadow 120ms;
  }
  .sd-swatch:hover { border-color:var(--cm-border-strong); }
  .sd-swatch.is-on { border-color:var(--cm-accent); box-shadow:0 0 0 3px var(--cm-focus-ring); }
  .sd-swatch-hue { width:26px; height:26px; border-radius:50%; border:1px solid rgba(0,0,0,0.06); }
  .sd-swatch-name { font:500 10.5px/1 var(--cm-font-mono); color:var(--cm-fg-muted); text-transform:capitalize; letter-spacing:0.01em; }
  .sd-swatch.is-on .sd-swatch-name { color:var(--cm-fg-strong); }

  /* Chips */
  .sd-chips { display:flex; flex-wrap:wrap; gap:6px; }
  .sd-chip {
    height:30px; padding:0 12px;
    border:1px solid var(--cm-border); border-radius:7px;
    background:var(--cm-surface); color:var(--cm-fg-muted);
    font:500 12.5px/1 var(--cm-font-sans);
    cursor:pointer;
    transition:border-color 120ms, color 120ms, background 120ms;
  }
  .sd-chip:hover { color:var(--cm-fg); border-color:var(--cm-border-strong); }
  .sd-chip.is-on { background:var(--cm-accent-soft); color:var(--cm-fg-strong); border-color:var(--cm-border-strong); }

  .sd-reset {
    display:inline-flex; align-items:center; gap:6px;
    height:32px; padding:0 12px;
    border:1px solid var(--cm-border); border-radius:7px;
    background:var(--cm-bg-soft); color:var(--cm-fg);
    font:500 12.5px/1 var(--cm-font-sans);
    cursor:pointer;
  }
  .sd-reset .ti { font-size:14px; }
  .sd-reset:hover { background:var(--cm-bg-sunk); }

  .sd-foot {
    padding:12px 20px;
    border-top:1px solid var(--cm-border);
    background:var(--cm-bg-soft);
    font:500 11.5px/1 var(--cm-font-mono);
    color:var(--cm-fg-muted);
    display:flex; align-items:center; gap:8px;
  }
  .sd-foot .ti { font-size:13px; }

  /* Row helper */
  .sd-row { display:flex; align-items:center; gap:12px; padding:6px 0; }
  .sd-row-l { flex:1; }
  .sd-row-label { font:500 13px/1 var(--cm-font-sans); color:var(--cm-fg); }
  .sd-row-sub { font:500 12px/1.3 var(--cm-font-sans); color:var(--cm-fg-muted); margin-top:2px; }

  /* Toggle rows (Notifications) */
  .sd-toggle-row { display:flex; align-items:center; gap:12px; padding:10px 0; border-bottom:1px solid var(--cm-border-soft); }
  .sd-toggle-row:last-child { border-bottom:0; }
  .sd-toggle {
    flex-shrink:0; width:40px; height:22px; border-radius:11px;
    border:none; cursor:pointer; position:relative;
    background:var(--cm-bg-sunk,#E5E5E5); transition:background 160ms;
  }
  .sd-toggle.is-on { background:var(--cm-accent); }
  .sd-toggle-thumb {
    position:absolute; top:3px; left:3px;
    width:16px; height:16px; border-radius:50%;
    background:#fff; box-shadow:0 1px 3px rgba(0,0,0,0.2);
    transition:left 160ms;
  }
  .sd-toggle.is-on .sd-toggle-thumb { left:21px; }

  /* Info note */
  .sd-note { display:flex; align-items:flex-start; gap:7px; padding:10px 12px; margin-top:12px; background:var(--cm-bg-soft); border-radius:8px; font:500 12px/1.4 var(--cm-font-sans); color:var(--cm-fg-muted); }
  .sd-note .ti { font-size:14px; flex-shrink:0; margin-top:1px; }

  /* Account tab */
  .sd-account-row { display:flex; align-items:center; gap:12px; padding:6px 0; }
  .sd-account-avatar { width:38px; height:38px; border-radius:50%; background:var(--cm-accent); color:var(--cm-fg-on-accent,#fff); font:600 16px/38px var(--cm-font-sans); text-align:center; flex-shrink:0; }
  .sd-signout { color:var(--cm-danger,#DC2626); }

  /* Reset confirmation */
  .sd-reset-confirm { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
  .sd-reset-confirm span { font:500 12.5px/1 var(--cm-font-sans); color:var(--cm-fg); }
  .sd-reset-yes { display:inline-flex; align-items:center; gap:5px; height:30px; padding:0 12px; border-radius:7px; border:none; background:var(--cm-danger,#DC2626); color:#fff; font:500 12.5px/1 var(--cm-font-sans); cursor:pointer; }
  .sd-reset-yes .ti { font-size:13px; }
  .sd-reset-no { display:inline-flex; align-items:center; height:30px; padding:0 12px; border-radius:7px; border:1px solid var(--cm-border); background:var(--cm-bg-soft); color:var(--cm-fg-muted); font:500 12.5px/1 var(--cm-font-sans); cursor:pointer; }

  /* Billing tab */
  .sd-billing-card { background:var(--cm-bg-soft); border:1px solid var(--cm-border); border-radius:8px; overflow:hidden; }
  .sd-billing-row { display:flex; align-items:center; justify-content:space-between; padding:10px 14px; border-bottom:1px solid var(--cm-border-soft); }
  .sd-billing-row:last-child { border-bottom:0; }
  .sd-billing-val { font:500 13px/1 var(--cm-font-mono); color:var(--cm-fg-strong); }

  /* Notification toasts */
  .cm-notif-stack { position:fixed; top:20px; right:20px; z-index:9999; display:flex; flex-direction:column; gap:8px; pointer-events:none; }
  .cm-toast {
    pointer-events:auto;
    display:flex; align-items:flex-start; gap:10px;
    padding:14px 14px 14px 14px;
    min-width:280px; max-width:380px;
    background:var(--cm-bg); border:1px solid var(--cm-border);
    border-radius:12px; box-shadow:0 8px 32px rgba(0,0,0,0.18);
    cursor:pointer;
    animation:cm-toast-in 220ms cubic-bezier(.2,.7,.2,1);
  }
  .cm-toast:hover { background:var(--cm-bg-soft); }
  .cm-toast-icon { font-size:16px; color:var(--cm-accent); flex-shrink:0; margin-top:2px; }
  .cm-toast-body { flex:1; min-width:0; }
  .cm-toast-title { font:600 13px/1.3 var(--cm-font-sans); color:var(--cm-fg-strong); }
  .cm-toast-sub { font:500 12px/1.4 var(--cm-font-sans); color:var(--cm-fg-muted); margin-top:3px; }
  .cm-toast-x { flex-shrink:0; width:22px; height:22px; border:none; background:transparent; color:var(--cm-fg-muted); cursor:pointer; display:flex; align-items:center; justify-content:center; border-radius:5px; }
  .cm-toast-x:hover { background:var(--cm-bg-sunk); }
  .cm-toast-x .ti { font-size:12px; }
  @keyframes cm-toast-in { from { opacity:0; transform:translateX(16px); } to { opacity:1; transform:translateX(0); } }
`;window.SettingsDrawer=D;window.openCMSettings=null;window.initCMSettings=y;function C(t){let o=document.querySelector('[title="Notifications"],[aria-label="Notifications"]');if(!o)return;let s=o.querySelector(".cm-bell-badge");if(t<=0){s&&s.remove();return}s||(s=document.createElement("span"),s.className="cm-bell-badge",Object.assign(s.style,{position:"absolute",top:"3px",right:"3px",width:"7px",height:"7px",borderRadius:"50%",background:"var(--cm-danger,#DC2626)",pointerEvents:"none"}),o.style.position="relative",o.appendChild(s))}function O(){let[t,o]=React.useState(!1),[s,m]=React.useState(null),[n,a]=React.useState(null),[g,p]=React.useState(null),[u,v]=React.useState([]),b=React.useRef(null),f=React.useRef(null);React.useEffect(()=>{if(window.sb)return window.sb.auth.getSession().then(({data:r})=>{var i,N;let d=(N=(i=r==null?void 0:r.session)==null?void 0:i.user)==null?void 0:N.id;d&&(a(d),window.sb.from("profiles").select("settings, notification_settings").eq("id",d).single().then(({data:e})=>{if(!e)return;let c={...e.settings||{},notif:e.notification_settings||{}};(Object.keys(e.settings||{}).length>0||Object.keys(e.notification_settings||{}).length>0)&&p(c)}),window.sb.from("notifications").select("id",{count:"exact",head:!0}).eq("user_id",d).eq("read",!1).then(({count:e})=>{e>0&&C(e)}),f.current=window.sb.channel("cm-notif-"+d).on("postgres_changes",{event:"INSERT",schema:"public",table:"notifications",filter:`user_id=eq.${d}`},e=>{let c=e.new,l=Date.now()+Math.random();v(B=>[...B,{...c,_popupId:l}]);let h=document.querySelector('[title="Notifications"],[aria-label="Notifications"]'),E=h?parseInt(h.dataset.unread||"0",10):0;h&&(h.dataset.unread=E+1),C(E+1)}).subscribe())}),()=>{f.current&&window.sb.removeChannel(f.current)}},[]),React.useEffect(()=>(window.openCMSettings=()=>o(!0),()=>{window.openCMSettings=null}),[]),React.useEffect(()=>{!t||s||window.getProfile&&window.getProfile().then(r=>m(r))},[t]);function x(r){!n||!window.sb||(clearTimeout(b.current),b.current=setTimeout(()=>{let{notif:d,...i}=r;window.sb.from("profiles").update({settings:i,notification_settings:d||{}}).eq("id",n).then(({error})=>{if(error)console.warn("[settings] cloud save failed:",error.message)})},800))}function k(r){v(d=>d.filter(i=>i._popupId!==r))}return React.createElement(React.Fragment,null,React.createElement(D,{open:t,onClose:()=>o(!1),profile:s,supabaseSettings:g,onSettingsChange:x}),React.createElement("div",{className:"cm-notif-stack"},u.map(r=>React.createElement(z,{key:r._popupId,notif:r,onDismiss:()=>k(r._popupId)}))))}(function(){y();let o=document.getElementById("settings-host")||(()=>{let s=document.createElement("div");return s.id="settings-host",document.body.appendChild(s),s})();ReactDOM.createRoot(o).render(React.createElement(O,null)),document.addEventListener("click",s=>{s.target.closest("[data-open-settings]")&&(s.preventDefault(),window.openCMSettings&&window.openCMSettings())})})();})();
