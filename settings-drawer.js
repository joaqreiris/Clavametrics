(()=>{var B="cm-settings.v1";function L(){try{let t=localStorage.getItem(B);return t?JSON.parse(t):{}}catch{return{}}}function M(t){try{localStorage.setItem(B,JSON.stringify(t))}catch{}}var D=(t,n)=>{try{return window.CM_I18N&&window.CM_I18N.t?window.CM_I18N.t(t):n}catch{return n}},S={light:{neutral:{hue:"#0A0A0A",soft:"#F4F4F2",tokens:{"--cm-accent":"#0A0A0A","--cm-accent-hover":"#1F1F1F","--cm-accent-press":"#000","--cm-accent-soft":"#F4F4F2","--cm-fg-on-accent":"#fff"}},green:{hue:"#15803D",soft:"#ECFDF5",tokens:{"--cm-accent":"#15803D","--cm-accent-hover":"#166534","--cm-accent-press":"#14532D","--cm-accent-soft":"#ECFDF5","--cm-fg-on-accent":"#fff"}},blue:{hue:"#2563EB",soft:"#EFF6FF",tokens:{"--cm-accent":"#2563EB","--cm-accent-hover":"#1D4ED8","--cm-accent-press":"#1E40AF","--cm-accent-soft":"#EFF6FF","--cm-fg-on-accent":"#fff"}},violet:{hue:"#7C3AED",soft:"#F5F3FF",tokens:{"--cm-accent":"#7C3AED","--cm-accent-hover":"#6D28D9","--cm-accent-press":"#5B21B6","--cm-accent-soft":"#F5F3FF","--cm-fg-on-accent":"#fff"}},gold:{hue:"#A87C2A",soft:"#FAF3E2",tokens:{"--cm-accent":"#A87C2A","--cm-accent-hover":"#8C6520","--cm-accent-press":"#75531B","--cm-accent-soft":"#FAF3E2","--cm-fg-on-accent":"#fff"}}},dark:{neutral:{hue:"#FAFAFA",soft:"rgba(255,255,255,0.06)",tokens:{"--cm-accent":"#FAFAFA","--cm-accent-hover":"#E5E5E5","--cm-accent-press":"#fff","--cm-accent-soft":"rgba(255,255,255,0.06)","--cm-fg-on-accent":"#0A0A0A"}},green:{hue:"#22C55E",soft:"rgba(34,197,94,0.10)",tokens:{"--cm-accent":"#22C55E","--cm-accent-hover":"#16A34A","--cm-accent-press":"#15803D","--cm-accent-soft":"rgba(34,197,94,0.10)","--cm-fg-on-accent":"#0A0A0A"}},blue:{hue:"#3B82F6",soft:"rgba(59,130,246,0.10)",tokens:{"--cm-accent":"#3B82F6","--cm-accent-hover":"#2563EB","--cm-accent-press":"#1D4ED8","--cm-accent-soft":"rgba(59,130,246,0.10)","--cm-fg-on-accent":"#fff"}},violet:{hue:"#A78BFA",soft:"rgba(167,139,250,0.10)",tokens:{"--cm-accent":"#A78BFA","--cm-accent-hover":"#8B5CF6","--cm-accent-press":"#7C3AED","--cm-accent-soft":"rgba(167,139,250,0.10)","--cm-fg-on-accent":"#0A0A0A"}},gold:{hue:"#C9A84C",soft:"rgba(201,168,76,0.12)",tokens:{"--cm-accent":"#C9A84C","--cm-accent-hover":"#A87C2A","--cm-accent-press":"#8B6520","--cm-accent-soft":"rgba(201,168,76,0.12)","--cm-fg-on-accent":"#0A0A0A"}}},hybrid:{neutral:{hue:"#0A0A0A",soft:"#F4F4F2",tokens:{"--cm-accent":"#0A0A0A","--cm-accent-hover":"#1F1F1F","--cm-accent-press":"#000","--cm-accent-soft":"#F4F4F2","--cm-fg-on-accent":"#fff","--cm-side-item-active-bg":"rgba(255,255,255,0.06)","--cm-side-item-active-fg":"#fff","--cm-side-accent":"#fff"}},green:{hue:"#15803D",soft:"#ECFDF5",tokens:{"--cm-accent":"#15803D","--cm-accent-hover":"#166534","--cm-accent-press":"#14532D","--cm-accent-soft":"#ECFDF5","--cm-fg-on-accent":"#fff","--cm-side-item-active-bg":"rgba(34,197,94,0.10)","--cm-side-item-active-fg":"#4ADE80","--cm-side-accent":"#4ADE80"}},blue:{hue:"#2563EB",soft:"#EFF6FF",tokens:{"--cm-accent":"#2563EB","--cm-accent-hover":"#1D4ED8","--cm-accent-press":"#1E40AF","--cm-accent-soft":"#EFF6FF","--cm-fg-on-accent":"#fff","--cm-side-item-active-bg":"rgba(59,130,246,0.14)","--cm-side-item-active-fg":"#60A5FA","--cm-side-accent":"#60A5FA"}},violet:{hue:"#7C3AED",soft:"#F5F3FF",tokens:{"--cm-accent":"#7C3AED","--cm-accent-hover":"#6D28D9","--cm-accent-press":"#5B21B6","--cm-accent-soft":"#F5F3FF","--cm-fg-on-accent":"#fff","--cm-side-item-active-bg":"rgba(167,139,250,0.14)","--cm-side-item-active-fg":"#A78BFA","--cm-side-accent":"#A78BFA"}},gold:{hue:"#A87C2A",soft:"#FAF3E2",tokens:{"--cm-accent":"#A87C2A","--cm-accent-hover":"#8C6520","--cm-accent-press":"#75531B","--cm-accent-soft":"#FAF3E2","--cm-fg-on-accent":"#fff","--cm-side-item-active-bg":"rgba(201,168,76,0.16)","--cm-side-item-active-fg":"#E5C875","--cm-side-accent":"#E5C875"}}}},P={default:{},ink:{"--cm-side-bg":"#0A0A0A"},slate:{"--cm-side-bg":"#0F172A"},forest:{"--cm-side-bg":"#0D1F17"},zinc:{"--cm-side-bg":"#18181B"}},$={tight:{"--cm-r-2":"4px","--cm-r-3":"5px","--cm-r-4":"6px","--cm-r-5":"8px","--cm-r-6":"10px"},regular:{},soft:{"--cm-r-2":"8px","--cm-r-3":"10px","--cm-r-4":"14px","--cm-r-5":"18px","--cm-r-6":"22px"}},O={compact:{"--cm-density-pad":"10px"},balanced:{"--cm-density-pad":"14px"},comfortable:{"--cm-density-pad":"20px"}};function R(t){let n=document.documentElement;n.setAttribute("data-theme",t.theme),["--cm-accent","--cm-accent-hover","--cm-accent-press","--cm-accent-soft","--cm-fg-on-accent","--cm-side-item-active-bg","--cm-side-item-active-fg","--cm-side-accent","--cm-side-bg","--cm-r-2","--cm-r-3","--cm-r-4","--cm-r-5","--cm-r-6","--cm-density-pad"].forEach(i=>n.style.removeProperty(i));let g=S[t.theme]&&S[t.theme][t.accent]||{};Object.entries(g.tokens||{}).forEach(([i,a])=>n.style.setProperty(i,a)),Object.entries(P[t.sidebarHue]||{}).forEach(([i,a])=>n.style.setProperty(i,a)),Object.entries($[t.radius]||{}).forEach(([i,a])=>n.style.setProperty(i,a)),Object.entries(O[t.density]||{}).forEach(([i,a])=>n.style.setProperty(i,a))}var q={alertInjury:!0,alertTask:!0,alertSession:!0,emailWeekly:!0,emailInjury:!0};function _(){let t=L(),n=window.__CM_TWEAK_DEFAULTS||{theme:"light",accent:"neutral"},s=Object.assign({theme:"light",accent:"neutral",radius:"regular",density:"balanced",sidebarHue:"default"},n,t);return s.notif={...q,...s.notif||{}},R(s),s}var H=({notif:t,onDismiss:n})=>(React.useEffect(()=>{let s=setTimeout(n,4e3);return()=>clearTimeout(s)},[]),React.createElement("div",{className:"cm-toast",onClick:()=>{t.link&&(window.location.href=t.link),n()}},React.createElement("i",{className:"ti ti-bell cm-toast-icon"}),React.createElement("div",{className:"cm-toast-body"},React.createElement("div",{className:"cm-toast-title"},t.title),t.body&&React.createElement("div",{className:"cm-toast-sub"},t.body)),React.createElement("button",{className:"cm-toast-x",onClick:s=>{s.stopPropagation(),n()}},React.createElement("i",{className:"ti ti-x"})))),U=()=>{let[t,n]=React.useState(null),[s,g]=React.useState(!0);React.useEffect(()=>{window.getClub&&window.getClub().then(w=>{n(w),g(!1)})},[]);let i=(t==null?void 0:t.billing_plan)||null,a=(t==null?void 0:t.billing_amount)||null,b=(t==null?void 0:t.billing_next_date)||null,f=(t==null?void 0:t.billing_status)||null;return React.createElement(React.Fragment,null,React.createElement("div",{className:"sd-section"},React.createElement("div",{className:"sd-section-h"},React.createElement("div",{className:"sd-section-l"},"Workspace subscription")),React.createElement("div",{className:"sd-section-body"},React.createElement("div",{className:"sd-billing-card"},React.createElement("div",{className:"sd-billing-row"},React.createElement("span",{className:"sd-row-label"},"Plan"),React.createElement("span",{className:"sd-billing-val"},s?"\u2026":i||"\u2014")),React.createElement("div",{className:"sd-billing-row"},React.createElement("span",{className:"sd-row-label"},"Monthly amount"),React.createElement("span",{className:"sd-billing-val"},s?"\u2026":a?`$${a}`:"\u2014")),React.createElement("div",{className:"sd-billing-row"},React.createElement("span",{className:"sd-row-label"},"Next billing date"),React.createElement("span",{className:"sd-billing-val"},s?"\u2026":b?new Date(b).toLocaleDateString([],{month:"long",day:"numeric",year:"numeric"}):"\u2014")),React.createElement("div",{className:"sd-billing-row"},React.createElement("span",{className:"sd-row-label"},"Status"),React.createElement("span",{className:"sd-billing-val",style:{color:f==="active"?"var(--cm-success)":"var(--cm-fg-muted)"}},s?"\u2026":f||"\u2014"))),React.createElement("div",{style:{padding:"10px 14px",borderTop:"1px solid var(--cm-border-soft)"}},React.createElement("a",{href:"Billing.html",style:{display:"inline-flex",alignItems:"center",gap:6,fontSize:12.5,fontWeight:500,color:"var(--cm-accent)",textDecoration:"none"}},"Ver detalle completo ",React.createElement("i",{className:"ti ti-arrow-right",style:{fontSize:13}}))),React.createElement("div",{className:"sd-note",style:{marginTop:12}},React.createElement("i",{className:"ti ti-brand-stripe"}),"Billing is managed via Stripe. Subscription data syncs automatically when the webhook is active. Contact your admin to change plans."))))},z=({open:t,onClose:n,profile:s,supabaseSettings:g,onSettingsChange:i})=>{let[a,b]=React.useState(_),[f,w]=React.useState("appearance"),[k,h]=React.useState(!1),[y,C]=React.useState(()=>window.CM_I18N?window.CM_I18N.current:"en"),[F,r]=React.useState(()=>{try{return!!localStorage.getItem("cm_lang")}catch{return!1}}),d=React.useRef(!1);React.useEffect(()=>{if(R(a),M(a),!d.current){d.current=!0;return}i&&i(a)},[a]),React.useEffect(()=>{g&&b(e=>{let{notif:o,...m}=g,I={...e,...m,notif:{...e.notif,...o||{}}};return R(I),M(I),I})},[g]),React.useEffect(()=>{let e=o=>{o.key==="Escape"&&n()};return t&&document.addEventListener("keydown",e),()=>document.removeEventListener("keydown",e)},[t]),React.useEffect(()=>{if(!t)return;let e=document.body.style.overflow;return document.body.style.overflow="hidden",()=>{document.body.style.overflow=e}},[t]),React.useEffect(()=>{t||h(!1)},[t]),React.useEffect(()=>{let e=o=>C(o.detail&&o.detail.lang||window.CM_I18N&&window.CM_I18N.current||"en");return document.addEventListener("cm:langchanged",e),()=>document.removeEventListener("cm:langchanged",e)},[]);let l=e=>b(o=>({...o,...e})),v=(e,o)=>l({notif:{...a.notif,[e]:o}}),c=window.CM_I18N&&window.CM_I18N.langs||["en","es","pt"],u=window.CM_I18N&&window.CM_I18N.name||{en:"English",es:"Espa\xF1ol",pt:"Portugu\xEAs"},N=e=>{window.CM_I18N&&window.CM_I18N.setLang(e),C(e),r(!0)},x=async()=>{try{localStorage.removeItem("cm_lang")}catch{}try{if(window.sb&&(s!=null&&s.id)){let{data:e}=await window.sb.from("profiles").select("settings").eq("id",s.id).single(),o={...(e==null?void 0:e.settings)||{}};delete o.language,await window.sb.from("profiles").update({settings:o}).eq("id",s.id)}}catch{}window.location.reload()},A=e=>e==="dark"?"#0A0A0A":e==="hybrid"?"linear-gradient(90deg,#0E1116 0%,#0E1116 30%,#FBFBFA 30%,#FBFBFA 100%)":"#FBFBFA",E=e=>e==="dark"?"rgba(255,255,255,0.10)":"#E5E7EB",j=Object.entries(S[a.theme]),p=({label:e,children:o,hint:m})=>React.createElement("div",{className:"sd-section"},React.createElement("div",{className:"sd-section-h"},React.createElement("div",{className:"sd-section-l"},e),m?React.createElement("div",{className:"sd-section-hint"},m):null),React.createElement("div",{className:"sd-section-body"},o)),Y=({label:e,sub:o,children:m})=>React.createElement("div",{className:"sd-row"},React.createElement("div",{className:"sd-row-l"},React.createElement("div",{className:"sd-row-label"},e),o?React.createElement("div",{className:"sd-row-sub"},o):null),React.createElement("div",{className:"sd-row-c"},m));return React.createElement(React.Fragment,null,React.createElement("style",null,W),React.createElement("div",{className:`sd-overlay ${t?"is-open":""}`,onClick:n}),React.createElement("aside",{className:`sd-drawer ${t?"is-open":""}`,role:"dialog","aria-label":"Settings"},React.createElement("header",{className:"sd-head"},React.createElement("div",{className:"sd-head-l"},React.createElement("i",{className:"ti ti-settings"}),React.createElement("div",null,React.createElement("div",{className:"sd-title"},"Settings"),React.createElement("div",{className:"sd-sub"},"Appearance \xB7 workspace \xB7 account"))),React.createElement("button",{className:"sd-x",onClick:n,"aria-label":"Close"},React.createElement("i",{className:"ti ti-x"}))),React.createElement("nav",{className:"sd-tabs"},[{id:"appearance",icon:"ti-palette",label:"Appearance"},{id:"notifications",icon:"ti-bell",label:"Notifications"},{id:"account",icon:"ti-shield-lock",label:"Account"},{id:"billing",icon:"ti-credit-card",label:"Billing"}].map(({id:e,icon:o,label:m})=>React.createElement("button",{key:e,className:`sd-tab ${f===e?"is-on":""}`,onClick:()=>w(e)},React.createElement("i",{className:`ti ${o}`}),m))),React.createElement("div",{className:"sd-body"},f==="appearance"&&React.createElement(React.Fragment,null,React.createElement(p,{label:"Theme",hint:"How the chrome looks across the app."},React.createElement("div",{className:"sd-tiles"},["light","dark","hybrid"].map(e=>React.createElement("button",{key:e,className:`sd-tile ${a.theme===e?"is-on":""}`,onClick:()=>l({theme:e,accent:S[e][a.accent]?a.accent:"green"})},React.createElement("div",{className:"sd-tile-pv",style:{background:A(e),borderColor:E(e)}},React.createElement("div",{className:"sd-tile-pv-bar",style:{background:e==="dark"?"rgba(255,255,255,0.08)":e==="hybrid"?"rgba(255,255,255,0.06)":"#EFEFED"}}),React.createElement("div",{className:"sd-tile-pv-c",style:{background:e==="dark"?"#161616":"#fff",borderColor:E(e)}})),React.createElement("div",{className:"sd-tile-label"},React.createElement("span",null,e==="light"?"Light":e==="dark"?"Dark":"Hybrid"),a.theme===e?React.createElement("i",{className:"ti ti-check"}):null))))),React.createElement(p,{label:"Accent",hint:"Used for primary buttons, active nav, and focus rings."},React.createElement("div",{className:"sd-swatches"},j.map(([e,o])=>React.createElement("button",{key:e,className:`sd-swatch ${a.accent===e?"is-on":""}`,onClick:()=>l({accent:e}),title:e},React.createElement("span",{className:"sd-swatch-hue",style:{background:o.hue}}),React.createElement("span",{className:"sd-swatch-name"},e))))),a.theme!=="light"?React.createElement(p,{label:"Sidebar tone"},React.createElement("div",{className:"sd-chips"},[{v:"default",l:"Default"},{v:"ink",l:"Ink"},{v:"slate",l:"Slate"},{v:"forest",l:"Forest"},{v:"zinc",l:"Zinc"}].map(e=>React.createElement("button",{key:e.v,className:`sd-chip ${a.sidebarHue===e.v?"is-on":""}`,onClick:()=>l({sidebarHue:e.v})},e.l)))):null,React.createElement(p,{label:"Density",hint:"Affects vertical padding inside cards & tables."},React.createElement("div",{className:"sd-chips"},[{v:"compact",l:"Compact"},{v:"balanced",l:"Balanced"},{v:"comfortable",l:"Comfy"}].map(e=>React.createElement("button",{key:e.v,className:`sd-chip ${a.density===e.v?"is-on":""}`,onClick:()=>l({density:e.v})},e.l)))),React.createElement(p,{label:"Corners"},React.createElement("div",{className:"sd-chips"},[{v:"tight",l:"Tight"},{v:"regular",l:"Regular"},{v:"soft",l:"Soft"}].map(e=>React.createElement("button",{key:e.v,className:`sd-chip ${a.radius===e.v?"is-on":""}`,onClick:()=>l({radius:e.v})},e.l)))),React.createElement(p,{label:D("settings.language","Language"),hint:D("settings.language.hint","Choose the language for the whole app.")},React.createElement("div",{className:"sd-chips"},React.createElement("button",{className:`sd-chip ${F?"":"is-on"}`,onClick:x},D("settings.language.auto","Auto (detect)")),c.map(e=>React.createElement("button",{key:e,className:`sd-chip ${F&&y===e?"is-on":""}`,onClick:()=>N(e)},u[e]||e.toUpperCase())))),React.createElement(p,{label:"Reset"},k?React.createElement("div",{className:"sd-reset-confirm"},React.createElement("span",null,"Reset all appearance settings?"),React.createElement("button",{className:"sd-reset-yes",onClick:()=>{localStorage.removeItem(B);let e=_();b(e),h(!1)}},React.createElement("i",{className:"ti ti-check"}),"Yes, reset"),React.createElement("button",{className:"sd-reset-no",onClick:()=>h(!1)},"Cancel")):React.createElement("button",{className:"sd-reset",onClick:()=>h(!0)},React.createElement("i",{className:"ti ti-rotate"}),"Reset to workspace defaults"))),f==="notifications"&&React.createElement(React.Fragment,null,React.createElement(p,{label:"In-app alerts",hint:"Shown as badges and banners inside the app."},[{key:"alertInjury",label:"Injury reported",sub:"Badge on the Treatments nav item"},{key:"alertTask",label:"Task assigned to me",sub:"Badge on the Tasks nav item"},{key:"alertSession",label:"Session published",sub:"Shown in Hub activity feed"}].map(({key:e,label:o,sub:m})=>React.createElement("div",{key:e,className:"sd-toggle-row"},React.createElement("div",{className:"sd-row-l"},React.createElement("div",{className:"sd-row-label"},o),React.createElement("div",{className:"sd-row-sub"},m)),React.createElement("button",{role:"switch","aria-checked":!!(a.notif&&a.notif[e]),className:`sd-toggle ${a.notif&&a.notif[e]?"is-on":""}`,onClick:()=>v(e,!(a.notif&&a.notif[e]))},React.createElement("span",{className:"sd-toggle-thumb"}))))),React.createElement(p,{label:"Email digest",hint:"Requires email delivery to be configured by the workspace admin."},[{key:"emailWeekly",label:"Weekly summary",sub:"Sent every Monday morning"},{key:"emailInjury",label:"Injury alerts",sub:"Immediate \u2014 for medical staff"}].map(({key:e,label:o,sub:m})=>React.createElement("div",{key:e,className:"sd-toggle-row"},React.createElement("div",{className:"sd-row-l"},React.createElement("div",{className:"sd-row-label"},o),React.createElement("div",{className:"sd-row-sub"},m)),React.createElement("button",{role:"switch","aria-checked":!!(a.notif&&a.notif[e]),className:`sd-toggle ${a.notif&&a.notif[e]?"is-on":""}`,onClick:()=>v(e,!(a.notif&&a.notif[e]))},React.createElement("span",{className:"sd-toggle-thumb"})))),React.createElement("div",{className:"sd-note"},React.createElement("i",{className:"ti ti-info-circle"}),"Email delivery is not yet configured for this workspace. Preferences are saved for when it is."))),f==="account"&&React.createElement(React.Fragment,null,React.createElement(p,{label:"Signed in as"},React.createElement("div",{className:"sd-account-row"},React.createElement("div",{className:"sd-account-avatar"},s?(s.full_name||s.email||"?")[0].toUpperCase():"?"),React.createElement("div",null,(s==null?void 0:s.full_name)&&React.createElement("div",{className:"sd-row-label"},s.full_name),React.createElement("div",{className:"sd-row-sub"},(s==null?void 0:s.email)||"\u2014"),React.createElement("div",{className:"sd-row-sub",style:{marginTop:2}},(s==null?void 0:s.role)||"")))),React.createElement(p,{label:"Session"},React.createElement("button",{className:"sd-reset sd-signout",onClick:async()=>{await window.sb.auth.signOut(),window.location.href="Login.html"}},React.createElement("i",{className:"ti ti-logout"}),"Sign out"))),f==="billing"&&React.createElement(U,null)),React.createElement("footer",{className:"sd-foot"},React.createElement("span",null,React.createElement("i",{className:"ti ti-cloud"}),"Saved to cloud & this device"))))},W=`
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
`;window.SettingsDrawer=z;window.openCMSettings=null;window.initCMSettings=_;function T(t){let n=document.querySelector('[title="Notifications"],[aria-label="Notifications"]');if(!n)return;let s=n.querySelector(".cm-bell-badge");if(t<=0){s&&s.remove();return}s||(s=document.createElement("span"),s.className="cm-bell-badge",Object.assign(s.style,{position:"absolute",top:"3px",right:"3px",width:"7px",height:"7px",borderRadius:"50%",background:"var(--cm-danger,#DC2626)",pointerEvents:"none"}),n.style.position="relative",n.appendChild(s))}function X(){let[t,n]=React.useState(!1),[s,g]=React.useState(null),[i,a]=React.useState(null),[b,f]=React.useState(null),[w,k]=React.useState([]),h=React.useRef(null),y=React.useRef(null);React.useEffect(()=>{if(window.sb)return window.sb.auth.getSession().then(({data:r})=>{var l,v;let d=(v=(l=r==null?void 0:r.session)==null?void 0:l.user)==null?void 0:v.id;d&&(a(d),window.CM_I18N&&window.CM_I18N.setCloudSaver(async c=>{let{data:u}=await window.sb.from("profiles").select("settings").eq("id",d).single(),N={...(u==null?void 0:u.settings)||{},language:c};await window.sb.from("profiles").update({settings:N}).eq("id",d)}),window.getClub&&window.getClub().then(c=>{c&&window.CM_I18N&&window.CM_I18N.setClubCountry(c.country)}),window.sb.from("profiles").select("settings, notification_settings").eq("id",d).single().then(({data:c})=>{if(!c)return;window.CM_I18N&&c.settings&&c.settings.language&&window.CM_I18N.setUserPref(c.settings.language);let u={...c.settings||{},notif:c.notification_settings||{}};(Object.keys(c.settings||{}).length>0||Object.keys(c.notification_settings||{}).length>0)&&f(u)}),window.sb.from("notifications").select("id",{count:"exact",head:!0}).eq("user_id",d).eq("read",!1).then(({count:c})=>{c>0&&T(c)}),y.current=window.sb.channel("cm-notif-"+d).on("postgres_changes",{event:"INSERT",schema:"public",table:"notifications",filter:`user_id=eq.${d}`},c=>{let u=c.new,N=Date.now()+Math.random();k(E=>[...E,{...u,_popupId:N}]);let x=document.querySelector('[title="Notifications"],[aria-label="Notifications"]'),A=x?parseInt(x.dataset.unread||"0",10):0;x&&(x.dataset.unread=A+1),T(A+1)}).subscribe())}),()=>{y.current&&window.sb.removeChannel(y.current)}},[]),React.useEffect(()=>(window.openCMSettings=()=>n(!0),()=>{window.openCMSettings=null}),[]),React.useEffect(()=>{!t||s||window.getProfile&&window.getProfile().then(r=>g(r))},[t]);function C(r){!i||!window.sb||(clearTimeout(h.current),h.current=setTimeout(async()=>{let{notif:d,...l}=r,v;try{v=localStorage.getItem("cm_lang")}catch{}window.CM_I18N&&v?l.language=window.CM_I18N.current:delete l.language;let{error:c}=await window.sb.from("profiles").update({settings:l,notification_settings:d||{}}).eq("id",i);c&&console.warn("[settings] cloud save failed:",c.message)},800))}function F(r){k(d=>d.filter(l=>l._popupId!==r))}return React.createElement(React.Fragment,null,React.createElement(z,{open:t,onClose:()=>n(!1),profile:s,supabaseSettings:b,onSettingsChange:C}),React.createElement("div",{className:"cm-notif-stack"},w.map(r=>React.createElement(H,{key:r._popupId,notif:r,onDismiss:()=>F(r._popupId)}))))}(function(){_();let n=document.getElementById("settings-host")||(()=>{let s=document.createElement("div");return s.id="settings-host",document.body.appendChild(s),s})();ReactDOM.createRoot(n).render(React.createElement(X,null)),document.addEventListener("click",s=>{s.target.closest("[data-open-settings]")&&(s.preventDefault(),window.openCMSettings&&window.openCMSettings())})})();})();
