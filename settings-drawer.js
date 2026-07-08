(()=>{var B="cm-settings.v1";function L(){try{let t=localStorage.getItem(B);return t?JSON.parse(t):{}}catch{return{}}}function M(t){try{localStorage.setItem(B,JSON.stringify(t))}catch{}}var a=(t,i)=>{try{return window.CM_I18N&&window.CM_I18N.t?window.CM_I18N.t(t):i}catch{return i}},I={light:{neutral:{hue:"#0A0A0A",soft:"#F4F4F2",tokens:{"--cm-accent":"#0A0A0A","--cm-accent-hover":"#1F1F1F","--cm-accent-press":"#000","--cm-accent-soft":"#F4F4F2","--cm-fg-on-accent":"#fff"}},green:{hue:"#15803D",soft:"#ECFDF5",tokens:{"--cm-accent":"#15803D","--cm-accent-hover":"#166534","--cm-accent-press":"#14532D","--cm-accent-soft":"#ECFDF5","--cm-fg-on-accent":"#fff"}},blue:{hue:"#2563EB",soft:"#EFF6FF",tokens:{"--cm-accent":"#2563EB","--cm-accent-hover":"#1D4ED8","--cm-accent-press":"#1E40AF","--cm-accent-soft":"#EFF6FF","--cm-fg-on-accent":"#fff"}},violet:{hue:"#7C3AED",soft:"#F5F3FF",tokens:{"--cm-accent":"#7C3AED","--cm-accent-hover":"#6D28D9","--cm-accent-press":"#5B21B6","--cm-accent-soft":"#F5F3FF","--cm-fg-on-accent":"#fff"}},gold:{hue:"#A87C2A",soft:"#FAF3E2",tokens:{"--cm-accent":"#A87C2A","--cm-accent-hover":"#8C6520","--cm-accent-press":"#75531B","--cm-accent-soft":"#FAF3E2","--cm-fg-on-accent":"#fff"}}},dark:{neutral:{hue:"#FAFAFA",soft:"rgba(255,255,255,0.06)",tokens:{"--cm-accent":"#FAFAFA","--cm-accent-hover":"#E5E5E5","--cm-accent-press":"#fff","--cm-accent-soft":"rgba(255,255,255,0.06)","--cm-fg-on-accent":"#0A0A0A"}},green:{hue:"#22C55E",soft:"rgba(34,197,94,0.10)",tokens:{"--cm-accent":"#22C55E","--cm-accent-hover":"#16A34A","--cm-accent-press":"#15803D","--cm-accent-soft":"rgba(34,197,94,0.10)","--cm-fg-on-accent":"#0A0A0A"}},blue:{hue:"#3B82F6",soft:"rgba(59,130,246,0.10)",tokens:{"--cm-accent":"#3B82F6","--cm-accent-hover":"#2563EB","--cm-accent-press":"#1D4ED8","--cm-accent-soft":"rgba(59,130,246,0.10)","--cm-fg-on-accent":"#fff"}},violet:{hue:"#A78BFA",soft:"rgba(167,139,250,0.10)",tokens:{"--cm-accent":"#A78BFA","--cm-accent-hover":"#8B5CF6","--cm-accent-press":"#7C3AED","--cm-accent-soft":"rgba(167,139,250,0.10)","--cm-fg-on-accent":"#0A0A0A"}},gold:{hue:"#C9A84C",soft:"rgba(201,168,76,0.12)",tokens:{"--cm-accent":"#C9A84C","--cm-accent-hover":"#A87C2A","--cm-accent-press":"#8B6520","--cm-accent-soft":"rgba(201,168,76,0.12)","--cm-fg-on-accent":"#0A0A0A"}}},hybrid:{neutral:{hue:"#0A0A0A",soft:"#F4F4F2",tokens:{"--cm-accent":"#0A0A0A","--cm-accent-hover":"#1F1F1F","--cm-accent-press":"#000","--cm-accent-soft":"#F4F4F2","--cm-fg-on-accent":"#fff","--cm-side-item-active-bg":"rgba(255,255,255,0.06)","--cm-side-item-active-fg":"#fff","--cm-side-accent":"#fff"}},green:{hue:"#15803D",soft:"#ECFDF5",tokens:{"--cm-accent":"#15803D","--cm-accent-hover":"#166534","--cm-accent-press":"#14532D","--cm-accent-soft":"#ECFDF5","--cm-fg-on-accent":"#fff","--cm-side-item-active-bg":"rgba(34,197,94,0.10)","--cm-side-item-active-fg":"#4ADE80","--cm-side-accent":"#4ADE80"}},blue:{hue:"#2563EB",soft:"#EFF6FF",tokens:{"--cm-accent":"#2563EB","--cm-accent-hover":"#1D4ED8","--cm-accent-press":"#1E40AF","--cm-accent-soft":"#EFF6FF","--cm-fg-on-accent":"#fff","--cm-side-item-active-bg":"rgba(59,130,246,0.14)","--cm-side-item-active-fg":"#60A5FA","--cm-side-accent":"#60A5FA"}},violet:{hue:"#7C3AED",soft:"#F5F3FF",tokens:{"--cm-accent":"#7C3AED","--cm-accent-hover":"#6D28D9","--cm-accent-press":"#5B21B6","--cm-accent-soft":"#F5F3FF","--cm-fg-on-accent":"#fff","--cm-side-item-active-bg":"rgba(167,139,250,0.14)","--cm-side-item-active-fg":"#A78BFA","--cm-side-accent":"#A78BFA"}},gold:{hue:"#A87C2A",soft:"#FAF3E2",tokens:{"--cm-accent":"#A87C2A","--cm-accent-hover":"#8C6520","--cm-accent-press":"#75531B","--cm-accent-soft":"#FAF3E2","--cm-fg-on-accent":"#fff","--cm-side-item-active-bg":"rgba(201,168,76,0.16)","--cm-side-item-active-fg":"#E5C875","--cm-side-accent":"#E5C875"}}}},P={default:{},ink:{"--cm-side-bg":"#0A0A0A"},slate:{"--cm-side-bg":"#0F172A"},forest:{"--cm-side-bg":"#0D1F17"},zinc:{"--cm-side-bg":"#18181B"}},$={tight:{"--cm-r-2":"4px","--cm-r-3":"5px","--cm-r-4":"6px","--cm-r-5":"8px","--cm-r-6":"10px"},regular:{},soft:{"--cm-r-2":"8px","--cm-r-3":"10px","--cm-r-4":"14px","--cm-r-5":"18px","--cm-r-6":"22px"}},O={compact:{"--cm-density-pad":"10px"},balanced:{"--cm-density-pad":"14px"},comfortable:{"--cm-density-pad":"20px"}};function R(t){let i=document.documentElement;i.setAttribute("data-theme",t.theme),["--cm-accent","--cm-accent-hover","--cm-accent-press","--cm-accent-soft","--cm-fg-on-accent","--cm-side-item-active-bg","--cm-side-item-active-fg","--cm-side-accent","--cm-side-bg","--cm-r-2","--cm-r-3","--cm-r-4","--cm-r-5","--cm-r-6","--cm-density-pad"].forEach(r=>i.style.removeProperty(r));let f=I[t.theme]&&I[t.theme][t.accent]||{};Object.entries(f.tokens||{}).forEach(([r,n])=>i.style.setProperty(r,n)),Object.entries(P[t.sidebarHue]||{}).forEach(([r,n])=>i.style.setProperty(r,n)),Object.entries($[t.radius]||{}).forEach(([r,n])=>i.style.setProperty(r,n)),Object.entries(O[t.density]||{}).forEach(([r,n])=>i.style.setProperty(r,n))}var q={alertInjury:!0,alertTask:!0,alertSession:!0,emailWeekly:!0,emailInjury:!0};function D(){let t=L(),i=window.__CM_TWEAK_DEFAULTS||{theme:"light",accent:"neutral"},s=Object.assign({theme:"light",accent:"neutral",radius:"regular",density:"balanced",sidebarHue:"default"},i,t);return s.notif={...q,...s.notif||{}},R(s),s}var H=({notif:t,onDismiss:i})=>(React.useEffect(()=>{let s=setTimeout(i,4e3);return()=>clearTimeout(s)},[]),React.createElement("div",{className:"cm-toast",onClick:()=>{t.link&&(window.location.href=t.link),i()}},React.createElement("i",{className:"ti ti-bell cm-toast-icon"}),React.createElement("div",{className:"cm-toast-body"},React.createElement("div",{className:"cm-toast-title"},t.title),t.body&&React.createElement("div",{className:"cm-toast-sub"},t.body)),React.createElement("button",{className:"cm-toast-x",onClick:s=>{s.stopPropagation(),i()}},React.createElement("i",{className:"ti ti-x"})))),U=()=>{let[t,i]=React.useState(null),[s,f]=React.useState(!0);React.useEffect(()=>{window.getClub&&window.getClub().then(N=>{i(N),f(!1)})},[]);let r=(t==null?void 0:t.billing_plan)||null,n=(t==null?void 0:t.billing_amount)||null,v=(t==null?void 0:t.billing_next_date)||null,u=(t==null?void 0:t.billing_status)||null;return React.createElement(React.Fragment,null,React.createElement("div",{className:"sd-section"},React.createElement("div",{className:"sd-section-h"},React.createElement("div",{className:"sd-section-l"},a("settings.workspace_subscription","Workspace subscription"))),React.createElement("div",{className:"sd-section-body"},React.createElement("div",{className:"sd-billing-card"},React.createElement("div",{className:"sd-billing-row"},React.createElement("span",{className:"sd-row-label"},a("settings.plan","Plan")),React.createElement("span",{className:"sd-billing-val"},s?"\u2026":r||"\u2014")),React.createElement("div",{className:"sd-billing-row"},React.createElement("span",{className:"sd-row-label"},a("settings.monthly_amount","Monthly amount")),React.createElement("span",{className:"sd-billing-val"},s?"\u2026":n?`$${n}`:"\u2014")),React.createElement("div",{className:"sd-billing-row"},React.createElement("span",{className:"sd-row-label"},a("settings.next_billing","Next billing date")),React.createElement("span",{className:"sd-billing-val"},s?"\u2026":v?new Date(v).toLocaleDateString(window.CM_I18N&&CM_I18N.current||[],{month:"long",day:"numeric",year:"numeric"}):"\u2014")),React.createElement("div",{className:"sd-billing-row"},React.createElement("span",{className:"sd-row-label"},a("settings.status","Status")),React.createElement("span",{className:"sd-billing-val",style:{color:u==="active"?"var(--cm-success)":"var(--cm-fg-muted)"}},s?"\u2026":u||"\u2014"))),React.createElement("div",{style:{padding:"10px 14px",borderTop:"1px solid var(--cm-border-soft)"}},React.createElement("a",{href:"Billing.html",style:{display:"inline-flex",alignItems:"center",gap:6,fontSize:12.5,fontWeight:500,color:"var(--cm-accent)",textDecoration:"none"}},a("settings.view_full_detail","View full detail")," ",React.createElement("i",{className:"ti ti-arrow-right",style:{fontSize:13}}))),React.createElement("div",{className:"sd-note",style:{marginTop:12}},React.createElement("i",{className:"ti ti-brand-stripe"}),a("settings.billing_stripe_note","Billing is managed via Stripe. Subscription data syncs automatically when the webhook is active. Contact your admin to change plans.")))))},j=({open:t,onClose:i,profile:s,supabaseSettings:f,onSettingsChange:r})=>{let[n,v]=React.useState(D),[u,N]=React.useState("appearance"),[F,x]=React.useState(!1),[k,A]=React.useState(()=>window.CM_I18N?window.CM_I18N.current:"en"),[E,d]=React.useState(()=>{try{return!!localStorage.getItem("cm_lang")}catch{return!1}}),l=React.useRef(!1);React.useEffect(()=>{if(R(n),M(n),!l.current){l.current=!0;return}r&&r(n)},[n]),React.useEffect(()=>{f&&v(e=>{let{notif:o,...g}=f,w={...e,...g,notif:{...e.notif,...o||{}}};return R(w),M(w),w})},[f]),React.useEffect(()=>{let e=o=>{o.key==="Escape"&&i()};return t&&document.addEventListener("keydown",e),()=>document.removeEventListener("keydown",e)},[t]),React.useEffect(()=>{if(!t)return;let e=document.body.style.overflow;return document.body.style.overflow="hidden",()=>{document.body.style.overflow=e}},[t]),React.useEffect(()=>{t||x(!1)},[t]),React.useEffect(()=>{let e=o=>A(o.detail&&o.detail.lang||window.CM_I18N&&window.CM_I18N.current||"en");return document.addEventListener("cm:langchanged",e),()=>document.removeEventListener("cm:langchanged",e)},[]);let m=e=>v(o=>({...o,...e})),h=(e,o)=>m({notif:{...n.notif,[e]:o}}),c=window.CM_I18N&&window.CM_I18N.langs||["en","es","pt"],b=window.CM_I18N&&window.CM_I18N.name||{en:"English",es:"Espa\xF1ol",pt:"Portugu\xEAs"},C=e=>{window.CM_I18N&&window.CM_I18N.setLang(e),A(e),d(!0)},y=async()=>{try{localStorage.removeItem("cm_lang")}catch{}try{if(window.sb&&(s!=null&&s.id)){let{data:e}=await window.sb.from("profiles").select("settings").eq("id",s.id).single(),o={...(e==null?void 0:e.settings)||{}};delete o.language,await window.sb.from("profiles").update({settings:o}).eq("id",s.id)}}catch{}window.location.reload()},_=e=>e==="dark"?"#0A0A0A":e==="hybrid"?"linear-gradient(90deg,#0E1116 0%,#0E1116 30%,#FBFBFA 30%,#FBFBFA 100%)":"#FBFBFA",S=e=>e==="dark"?"rgba(255,255,255,0.10)":"#E5E7EB",z=Object.entries(I[n.theme]),p=({label:e,children:o,hint:g})=>React.createElement("div",{className:"sd-section"},React.createElement("div",{className:"sd-section-h"},React.createElement("div",{className:"sd-section-l"},e),g?React.createElement("div",{className:"sd-section-hint"},g):null),React.createElement("div",{className:"sd-section-body"},o)),Y=({label:e,sub:o,children:g})=>React.createElement("div",{className:"sd-row"},React.createElement("div",{className:"sd-row-l"},React.createElement("div",{className:"sd-row-label"},e),o?React.createElement("div",{className:"sd-row-sub"},o):null),React.createElement("div",{className:"sd-row-c"},g));return React.createElement(React.Fragment,null,React.createElement("style",null,W),React.createElement("div",{className:`sd-overlay ${t?"is-open":""}`,onClick:i}),React.createElement("aside",{className:`sd-drawer ${t?"is-open":""}`,role:"dialog","aria-label":a("settings.title","Settings")},React.createElement("header",{className:"sd-head"},React.createElement("div",{className:"sd-head-l"},React.createElement("i",{className:"ti ti-settings"}),React.createElement("div",null,React.createElement("div",{className:"sd-title"},a("settings.title","Settings")),React.createElement("div",{className:"sd-sub"},a("settings.subtitle","Appearance \xB7 workspace \xB7 account")))),React.createElement("button",{className:"sd-x",onClick:i,"aria-label":a("settings.close","Close")},React.createElement("i",{className:"ti ti-x"}))),React.createElement("nav",{className:"sd-tabs"},[{id:"appearance",icon:"ti-palette",label:"Appearance"},{id:"notifications",icon:"ti-bell",label:"Notifications"},{id:"account",icon:"ti-shield-lock",label:"Account"},{id:"billing",icon:"ti-credit-card",label:"Billing"}].map(({id:e,icon:o,label:g})=>React.createElement("button",{key:e,className:`sd-tab ${u===e?"is-on":""}`,onClick:()=>N(e)},React.createElement("i",{className:`ti ${o}`}),a("settings.tab."+e,g)))),React.createElement("div",{className:"sd-body"},u==="appearance"&&React.createElement(React.Fragment,null,React.createElement(p,{label:a("settings.theme","Theme"),hint:a("settings.theme.hint","How the chrome looks across the app.")},React.createElement("div",{className:"sd-tiles"},["light","dark","hybrid"].map(e=>React.createElement("button",{key:e,className:`sd-tile ${n.theme===e?"is-on":""}`,onClick:()=>m({theme:e,accent:I[e][n.accent]?n.accent:"green"})},React.createElement("div",{className:"sd-tile-pv",style:{background:_(e),borderColor:S(e)}},React.createElement("div",{className:"sd-tile-pv-bar",style:{background:e==="dark"?"rgba(255,255,255,0.08)":e==="hybrid"?"rgba(255,255,255,0.06)":"#EFEFED"}}),React.createElement("div",{className:"sd-tile-pv-c",style:{background:e==="dark"?"#161616":"#fff",borderColor:S(e)}})),React.createElement("div",{className:"sd-tile-label"},React.createElement("span",null,a("settings.theme_"+e,e==="light"?"Light":e==="dark"?"Dark":"Hybrid")),n.theme===e?React.createElement("i",{className:"ti ti-check"}):null))))),React.createElement(p,{label:a("settings.accent","Accent"),hint:a("settings.accent.hint","Used for primary buttons, active nav, and focus rings.")},React.createElement("div",{className:"sd-swatches"},z.map(([e,o])=>React.createElement("button",{key:e,className:`sd-swatch ${n.accent===e?"is-on":""}`,onClick:()=>m({accent:e}),title:e},React.createElement("span",{className:"sd-swatch-hue",style:{background:o.hue}}),React.createElement("span",{className:"sd-swatch-name"},e))))),n.theme!=="light"?React.createElement(p,{label:a("settings.sidebar_tone","Sidebar tone")},React.createElement("div",{className:"sd-chips"},[{v:"default",l:"Default"},{v:"ink",l:"Ink"},{v:"slate",l:"Slate"},{v:"forest",l:"Forest"},{v:"zinc",l:"Zinc"}].map(e=>React.createElement("button",{key:e.v,className:`sd-chip ${n.sidebarHue===e.v?"is-on":""}`,onClick:()=>m({sidebarHue:e.v})},a("settings.tone_"+e.v,e.l))))):null,React.createElement(p,{label:a("settings.density","Density"),hint:a("settings.density.hint","Affects vertical padding inside cards & tables.")},React.createElement("div",{className:"sd-chips"},[{v:"compact",l:"Compact",k:"compact"},{v:"balanced",l:"Balanced",k:"balanced"},{v:"comfortable",l:"Comfy",k:"comfy"}].map(e=>React.createElement("button",{key:e.v,className:`sd-chip ${n.density===e.v?"is-on":""}`,onClick:()=>m({density:e.v})},a("settings.density_"+e.k,e.l))))),React.createElement(p,{label:a("settings.corners","Corners")},React.createElement("div",{className:"sd-chips"},[{v:"tight",l:"Tight"},{v:"regular",l:"Regular"},{v:"soft",l:"Soft"}].map(e=>React.createElement("button",{key:e.v,className:`sd-chip ${n.radius===e.v?"is-on":""}`,onClick:()=>m({radius:e.v})},a("settings.corners_"+e.v,e.l))))),React.createElement(p,{label:a("settings.language","Language"),hint:a("settings.language.hint","Choose the language for the whole app.")},React.createElement("div",{className:"sd-chips"},React.createElement("button",{className:`sd-chip ${E?"":"is-on"}`,onClick:y},a("settings.language.auto","Auto (detect)")),c.map(e=>React.createElement("button",{key:e,className:`sd-chip ${E&&k===e?"is-on":""}`,onClick:()=>C(e)},b[e]||e.toUpperCase())))),React.createElement(p,{label:a("settings.reset","Reset")},F?React.createElement("div",{className:"sd-reset-confirm"},React.createElement("span",null,a("settings.reset_confirm","Reset all appearance settings?")),React.createElement("button",{className:"sd-reset-yes",onClick:()=>{localStorage.removeItem(B);let e=D();v(e),x(!1)}},React.createElement("i",{className:"ti ti-check"}),a("settings.reset_yes","Yes, reset")),React.createElement("button",{className:"sd-reset-no",onClick:()=>x(!1)},a("settings.cancel","Cancel"))):React.createElement("button",{className:"sd-reset",onClick:()=>x(!0)},React.createElement("i",{className:"ti ti-rotate"}),a("settings.reset_defaults","Reset to workspace defaults")))),u==="notifications"&&React.createElement(React.Fragment,null,React.createElement(p,{label:a("settings.inapp_alerts","In-app alerts"),hint:a("settings.inapp_alerts.hint","Shown as badges and banners inside the app.")},[{key:"alertInjury",k:"injury",label:"Injury reported",sub:"Badge on the Treatments nav item"},{key:"alertTask",k:"task",label:"Task assigned to me",sub:"Badge on the Tasks nav item"},{key:"alertSession",k:"session",label:"Session published",sub:"Shown in Hub activity feed"}].map(({key:e,k:o,label:g,sub:w})=>React.createElement("div",{key:e,className:"sd-toggle-row"},React.createElement("div",{className:"sd-row-l"},React.createElement("div",{className:"sd-row-label"},a("settings.alert_"+o,g)),React.createElement("div",{className:"sd-row-sub"},a("settings.alert_"+o+".sub",w))),React.createElement("button",{role:"switch","aria-checked":!!(n.notif&&n.notif[e]),className:`sd-toggle ${n.notif&&n.notif[e]?"is-on":""}`,onClick:()=>h(e,!(n.notif&&n.notif[e]))},React.createElement("span",{className:"sd-toggle-thumb"}))))),React.createElement(p,{label:a("settings.email_digest","Email digest"),hint:a("settings.email_digest.hint","Requires email delivery to be configured by the workspace admin.")},[{key:"emailWeekly",k:"weekly",label:"Weekly summary",sub:"Sent every Monday morning"},{key:"emailInjury",k:"injury",label:"Injury alerts",sub:"Immediate \u2014 for medical staff"}].map(({key:e,k:o,label:g,sub:w})=>React.createElement("div",{key:e,className:"sd-toggle-row"},React.createElement("div",{className:"sd-row-l"},React.createElement("div",{className:"sd-row-label"},a("settings.email_"+o,g)),React.createElement("div",{className:"sd-row-sub"},a("settings.email_"+o+".sub",w))),React.createElement("button",{role:"switch","aria-checked":!!(n.notif&&n.notif[e]),className:`sd-toggle ${n.notif&&n.notif[e]?"is-on":""}`,onClick:()=>h(e,!(n.notif&&n.notif[e]))},React.createElement("span",{className:"sd-toggle-thumb"})))),React.createElement("div",{className:"sd-note"},React.createElement("i",{className:"ti ti-info-circle"}),a("settings.email_note","Email delivery is not yet configured for this workspace. Preferences are saved for when it is.")))),u==="account"&&React.createElement(React.Fragment,null,React.createElement(p,{label:a("settings.signed_in_as","Signed in as")},React.createElement("div",{className:"sd-account-row"},React.createElement("div",{className:"sd-account-avatar"},s?(s.full_name||s.email||"?")[0].toUpperCase():"?"),React.createElement("div",null,(s==null?void 0:s.full_name)&&React.createElement("div",{className:"sd-row-label"},s.full_name),React.createElement("div",{className:"sd-row-sub"},(s==null?void 0:s.email)||"\u2014"),React.createElement("div",{className:"sd-row-sub",style:{marginTop:2}},(s==null?void 0:s.role)||"")))),React.createElement(p,{label:a("settings.session","Session")},React.createElement("button",{className:"sd-reset sd-signout",onClick:async()=>{await window.sb.auth.signOut(),window.location.href="Login.html"}},React.createElement("i",{className:"ti ti-logout"}),a("settings.sign_out","Sign out")))),u==="billing"&&React.createElement(U,null)),React.createElement("footer",{className:"sd-foot"},React.createElement("span",null,React.createElement("i",{className:"ti ti-cloud"}),a("settings.saved_footer","Saved to cloud & this device")))))},W=`
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
`;window.SettingsDrawer=j;window.openCMSettings=null;window.initCMSettings=D;function T(t){let i=document.querySelector('[title="Notifications"],[aria-label="Notifications"]');if(!i)return;let s=i.querySelector(".cm-bell-badge");if(t<=0){s&&s.remove();return}s||(s=document.createElement("span"),s.className="cm-bell-badge",Object.assign(s.style,{position:"absolute",top:"3px",right:"3px",width:"7px",height:"7px",borderRadius:"50%",background:"var(--cm-danger,#DC2626)",pointerEvents:"none"}),i.style.position="relative",i.appendChild(s))}function X(){let[t,i]=React.useState(!1),[s,f]=React.useState(null),[r,n]=React.useState(null),[v,u]=React.useState(null),[N,F]=React.useState([]),x=React.useRef(null),k=React.useRef(null);React.useEffect(()=>{if(window.sb)return window.sb.auth.getSession().then(({data:d})=>{var m,h;let l=(h=(m=d==null?void 0:d.session)==null?void 0:m.user)==null?void 0:h.id;l&&(n(l),window.CM_I18N&&window.CM_I18N.setCloudSaver(async c=>{let{data:b}=await window.sb.from("profiles").select("settings").eq("id",l).single(),C={...(b==null?void 0:b.settings)||{},language:c};await window.sb.from("profiles").update({settings:C}).eq("id",l)}),window.getClub&&window.getClub().then(c=>{c&&window.CM_I18N&&window.CM_I18N.setClubCountry(c.country)}),window.sb.from("profiles").select("settings, notification_settings").eq("id",l).single().then(({data:c})=>{if(!c)return;window.CM_I18N&&c.settings&&c.settings.language&&window.CM_I18N.setUserPref(c.settings.language);let b={...c.settings||{},notif:c.notification_settings||{}};(Object.keys(c.settings||{}).length>0||Object.keys(c.notification_settings||{}).length>0)&&u(b)}),window.sb.from("notifications").select("id",{count:"exact",head:!0}).eq("user_id",l).eq("read",!1).then(({count:c})=>{c>0&&T(c)}),k.current=window.sb.channel("cm-notif-"+l).on("postgres_changes",{event:"INSERT",schema:"public",table:"notifications",filter:`user_id=eq.${l}`},c=>{let b=c.new,C=Date.now()+Math.random();F(S=>[...S,{...b,_popupId:C}]);let y=document.querySelector('[title="Notifications"],[aria-label="Notifications"]'),_=y?parseInt(y.dataset.unread||"0",10):0;y&&(y.dataset.unread=_+1),T(_+1)}).subscribe())}),()=>{k.current&&window.sb.removeChannel(k.current)}},[]),React.useEffect(()=>(window.openCMSettings=()=>i(!0),()=>{window.openCMSettings=null}),[]),React.useEffect(()=>{!t||s||window.getProfile&&window.getProfile().then(d=>f(d))},[t]);function A(d){!r||!window.sb||(clearTimeout(x.current),x.current=setTimeout(async()=>{let{notif:l,...m}=d,h;try{h=localStorage.getItem("cm_lang")}catch{}window.CM_I18N&&h?m.language=window.CM_I18N.current:delete m.language;let{error:c}=await window.sb.from("profiles").update({settings:m,notification_settings:l||{}}).eq("id",r);c&&console.warn("[settings] cloud save failed:",c.message)},800))}function E(d){F(l=>l.filter(m=>m._popupId!==d))}return React.createElement(React.Fragment,null,React.createElement(j,{open:t,onClose:()=>i(!1),profile:s,supabaseSettings:v,onSettingsChange:A}),React.createElement("div",{className:"cm-notif-stack"},N.map(d=>React.createElement(H,{key:d._popupId,notif:d,onDismiss:()=>E(d._popupId)}))))}(function(){D();let i=document.getElementById("settings-host")||(()=>{let s=document.createElement("div");return s.id="settings-host",document.body.appendChild(s),s})();ReactDOM.createRoot(i).render(React.createElement(X,null)),document.addEventListener("click",s=>{s.target.closest("[data-open-settings]")&&(s.preventDefault(),window.openCMSettings&&window.openCMSettings())})})();})();
