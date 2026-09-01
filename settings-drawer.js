(()=>{var U="cm-settings.v1";function de(){try{let s=localStorage.getItem(U);return s?JSON.parse(s):{}}catch{return{}}}function G(s){try{localStorage.setItem(U,JSON.stringify(s))}catch{}}var t=(s,i)=>{try{return window.CM_I18N&&window.CM_I18N.t?window.CM_I18N.t(s):i}catch{return i}},T={light:{neutral:{hue:"#0A0A0A",soft:"#F4F4F2",tokens:{"--cm-accent":"#0A0A0A","--cm-accent-hover":"#1F1F1F","--cm-accent-press":"#000","--cm-accent-soft":"#F4F4F2","--cm-fg-on-accent":"#fff"}},green:{hue:"#15803D",soft:"#ECFDF5",tokens:{"--cm-accent":"#15803D","--cm-accent-hover":"#166534","--cm-accent-press":"#14532D","--cm-accent-soft":"#ECFDF5","--cm-fg-on-accent":"#fff"}},blue:{hue:"#2563EB",soft:"#EFF6FF",tokens:{"--cm-accent":"#2563EB","--cm-accent-hover":"#1D4ED8","--cm-accent-press":"#1E40AF","--cm-accent-soft":"#EFF6FF","--cm-fg-on-accent":"#fff"}},violet:{hue:"#7C3AED",soft:"#F5F3FF",tokens:{"--cm-accent":"#7C3AED","--cm-accent-hover":"#6D28D9","--cm-accent-press":"#5B21B6","--cm-accent-soft":"#F5F3FF","--cm-fg-on-accent":"#fff"}},gold:{hue:"#A87C2A",soft:"#FAF3E2",tokens:{"--cm-accent":"#A87C2A","--cm-accent-hover":"#8C6520","--cm-accent-press":"#75531B","--cm-accent-soft":"#FAF3E2","--cm-fg-on-accent":"#fff"}}},dark:{neutral:{hue:"#FAFAFA",soft:"rgba(255,255,255,0.06)",tokens:{"--cm-accent":"#FAFAFA","--cm-accent-hover":"#E5E5E5","--cm-accent-press":"#fff","--cm-accent-soft":"rgba(255,255,255,0.06)","--cm-fg-on-accent":"#0A0A0A"}},green:{hue:"#22C55E",soft:"rgba(34,197,94,0.10)",tokens:{"--cm-accent":"#22C55E","--cm-accent-hover":"#16A34A","--cm-accent-press":"#15803D","--cm-accent-soft":"rgba(34,197,94,0.10)","--cm-fg-on-accent":"#0A0A0A"}},blue:{hue:"#3B82F6",soft:"rgba(59,130,246,0.10)",tokens:{"--cm-accent":"#3B82F6","--cm-accent-hover":"#2563EB","--cm-accent-press":"#1D4ED8","--cm-accent-soft":"rgba(59,130,246,0.10)","--cm-fg-on-accent":"#fff"}},violet:{hue:"#A78BFA",soft:"rgba(167,139,250,0.10)",tokens:{"--cm-accent":"#A78BFA","--cm-accent-hover":"#8B5CF6","--cm-accent-press":"#7C3AED","--cm-accent-soft":"rgba(167,139,250,0.10)","--cm-fg-on-accent":"#0A0A0A"}},gold:{hue:"#C9A84C",soft:"rgba(201,168,76,0.12)",tokens:{"--cm-accent":"#C9A84C","--cm-accent-hover":"#A87C2A","--cm-accent-press":"#8B6520","--cm-accent-soft":"rgba(201,168,76,0.12)","--cm-fg-on-accent":"#0A0A0A"}}},hybrid:{neutral:{hue:"#0A0A0A",soft:"#F4F4F2",tokens:{"--cm-accent":"#0A0A0A","--cm-accent-hover":"#1F1F1F","--cm-accent-press":"#000","--cm-accent-soft":"#F4F4F2","--cm-fg-on-accent":"#fff","--cm-side-item-active-bg":"rgba(255,255,255,0.06)","--cm-side-item-active-fg":"#fff","--cm-side-accent":"#fff"}},green:{hue:"#15803D",soft:"#ECFDF5",tokens:{"--cm-accent":"#15803D","--cm-accent-hover":"#166534","--cm-accent-press":"#14532D","--cm-accent-soft":"#ECFDF5","--cm-fg-on-accent":"#fff","--cm-side-item-active-bg":"rgba(34,197,94,0.10)","--cm-side-item-active-fg":"#4ADE80","--cm-side-accent":"#4ADE80"}},blue:{hue:"#2563EB",soft:"#EFF6FF",tokens:{"--cm-accent":"#2563EB","--cm-accent-hover":"#1D4ED8","--cm-accent-press":"#1E40AF","--cm-accent-soft":"#EFF6FF","--cm-fg-on-accent":"#fff","--cm-side-item-active-bg":"rgba(59,130,246,0.14)","--cm-side-item-active-fg":"#60A5FA","--cm-side-accent":"#60A5FA"}},violet:{hue:"#7C3AED",soft:"#F5F3FF",tokens:{"--cm-accent":"#7C3AED","--cm-accent-hover":"#6D28D9","--cm-accent-press":"#5B21B6","--cm-accent-soft":"#F5F3FF","--cm-fg-on-accent":"#fff","--cm-side-item-active-bg":"rgba(167,139,250,0.14)","--cm-side-item-active-fg":"#A78BFA","--cm-side-accent":"#A78BFA"}},gold:{hue:"#A87C2A",soft:"#FAF3E2",tokens:{"--cm-accent":"#A87C2A","--cm-accent-hover":"#8C6520","--cm-accent-press":"#75531B","--cm-accent-soft":"#FAF3E2","--cm-fg-on-accent":"#fff","--cm-side-item-active-bg":"rgba(201,168,76,0.16)","--cm-side-item-active-fg":"#E5C875","--cm-side-accent":"#E5C875"}}}},le={default:{},ink:{"--cm-side-bg":"#0A0A0A"},slate:{"--cm-side-bg":"#0F172A"},forest:{"--cm-side-bg":"#0D1F17"},zinc:{"--cm-side-bg":"#18181B"}},me={tight:{"--cm-r-2":"4px","--cm-r-3":"5px","--cm-r-4":"6px","--cm-r-5":"8px","--cm-r-6":"10px"},regular:{},soft:{"--cm-r-2":"8px","--cm-r-3":"10px","--cm-r-4":"14px","--cm-r-5":"18px","--cm-r-6":"22px"}},pe={compact:{"--cm-density-pad":"10px"},balanced:{"--cm-density-pad":"14px"},comfortable:{"--cm-density-pad":"20px"}};function L(s){let i=document.documentElement;i.setAttribute("data-theme",s.theme),["--cm-accent","--cm-accent-hover","--cm-accent-press","--cm-accent-soft","--cm-fg-on-accent","--cm-side-item-active-bg","--cm-side-item-active-fg","--cm-side-accent","--cm-side-bg","--cm-r-2","--cm-r-3","--cm-r-4","--cm-r-5","--cm-r-6","--cm-density-pad"].forEach(m=>i.style.removeProperty(m));let u=T[s.theme]&&T[s.theme][s.accent]||{};Object.entries(u.tokens||{}).forEach(([m,f])=>i.style.setProperty(m,f)),Object.entries(le[s.sidebarHue]||{}).forEach(([m,f])=>i.style.setProperty(m,f)),Object.entries(me[s.radius]||{}).forEach(([m,f])=>i.style.setProperty(m,f)),Object.entries(pe[s.density]||{}).forEach(([m,f])=>i.style.setProperty(m,f))}var fe={alertInjury:!0,alertTask:!0,alertSession:!0,emailWeekly:!0,emailInjury:!0};function P(){let s=de(),i=window.__CM_TWEAK_DEFAULTS||{theme:"light",accent:"neutral"},a=Object.assign({theme:"light",accent:"neutral",radius:"regular",density:"balanced",sidebarHue:"default"},i,s);return a.notif={...fe,...a.notif||{}},L(a),a}var ge=({notif:s,onDismiss:i})=>(React.useEffect(()=>{let a=setTimeout(i,4e3);return()=>clearTimeout(a)},[]),React.createElement("div",{className:"cm-toast",onClick:()=>{s.link&&(window.location.href=s.link),i()}},React.createElement("i",{className:"ti ti-bell cm-toast-icon"}),React.createElement("div",{className:"cm-toast-body"},React.createElement("div",{className:"cm-toast-title"},s.title),s.body&&React.createElement("div",{className:"cm-toast-sub"},s.body)),React.createElement("button",{className:"cm-toast-x",onClick:a=>{a.stopPropagation(),i()}},React.createElement("i",{className:"ti ti-x"})))),ue=()=>{let[s,i]=React.useState(null),[a,u]=React.useState(!0);React.useEffect(()=>{window.getClub&&window.getClub().then(_=>{i(_),u(!1)})},[]);let m=(s==null?void 0:s.billing_plan)||null,f=(s==null?void 0:s.billing_amount)||null,N=(s==null?void 0:s.billing_next_date)||null,o=(s==null?void 0:s.billing_status)||null;return React.createElement(React.Fragment,null,React.createElement("div",{className:"sd-section"},React.createElement("div",{className:"sd-section-h"},React.createElement("div",{className:"sd-section-l"},t("settings.workspace_subscription","Workspace subscription"))),React.createElement("div",{className:"sd-section-body"},React.createElement("div",{className:"sd-billing-card"},React.createElement("div",{className:"sd-billing-row"},React.createElement("span",{className:"sd-row-label"},t("settings.plan","Plan")),React.createElement("span",{className:"sd-billing-val"},a?"\u2026":m||"\u2014")),React.createElement("div",{className:"sd-billing-row"},React.createElement("span",{className:"sd-row-label"},t("settings.monthly_amount","Monthly amount")),React.createElement("span",{className:"sd-billing-val"},a?"\u2026":f?`$${f}`:"\u2014")),React.createElement("div",{className:"sd-billing-row"},React.createElement("span",{className:"sd-row-label"},t("settings.next_billing","Next billing date")),React.createElement("span",{className:"sd-billing-val"},a?"\u2026":N?new Date(N).toLocaleDateString(window.CM_I18N&&CM_I18N.current||[],{month:"long",day:"numeric",year:"numeric"}):"\u2014")),React.createElement("div",{className:"sd-billing-row"},React.createElement("span",{className:"sd-row-label"},t("settings.status","Status")),React.createElement("span",{className:"sd-billing-val",style:{color:o==="active"?"var(--cm-success)":"var(--cm-fg-muted)"}},a?"\u2026":o||"\u2014"))),React.createElement("div",{style:{padding:"10px 14px",borderTop:"1px solid var(--cm-border-soft)"}},React.createElement("a",{href:"Billing.html",style:{display:"inline-flex",alignItems:"center",gap:6,fontSize:12.5,fontWeight:500,color:"var(--cm-accent)",textDecoration:"none"}},t("settings.view_full_detail","View full detail")," ",React.createElement("i",{className:"ti ti-arrow-right",style:{fontSize:13}}))),React.createElement("div",{className:"sd-note",style:{marginTop:12}},React.createElement("i",{className:"ti ti-brand-stripe"}),t("settings.billing_stripe_note","Billing is managed via Stripe. Subscription data syncs automatically when the webhook is active. Contact your admin to change plans.")))))},b=({label:s,children:i,hint:a})=>React.createElement("div",{className:"sd-section"},React.createElement("div",{className:"sd-section-h"},React.createElement("div",{className:"sd-section-l"},s),a?React.createElement("div",{className:"sd-section-hint"},a):null),React.createElement("div",{className:"sd-section-body"},i));var V=({open:s,onClose:i,profile:a,userId:u,setProfile:m,supabaseSettings:f,onSettingsChange:N})=>{let[o,_]=React.useState(P),[x,R]=React.useState("appearance"),[A,F]=React.useState(!1),[r,p]=React.useState(null),[g,v]=React.useState(null),[w,l]=React.useState(null),[h,y]=React.useState("idle"),[D,j]=React.useState(null),[Z,z]=React.useState(()=>window.CM_I18N?window.CM_I18N.current:"en"),[he,$]=React.useState(()=>{try{return!!localStorage.getItem("cm_lang")}catch{return!1}}),[M,Q]=React.useState([]);React.useEffect(()=>{!s||M.length||!window.getClub||!window.getTeams||window.getClub().then(e=>e&&window.getTeams(e.id)).then(e=>e&&Q(e)).catch(()=>{})},[s]);let O=React.useRef(!1);React.useEffect(()=>{if(L(o),G(o),!O.current){O.current=!0;return}N&&N(o)},[o]),React.useEffect(()=>{f&&_(e=>{let{notif:n,...c}=f,d={...e,...c,notif:{...e.notif,...n||{}}};return L(d),G(d),d})},[f]),React.useEffect(()=>{let e=n=>{n.key==="Escape"&&i()};return s&&document.addEventListener("keydown",e),()=>document.removeEventListener("keydown",e)},[s]),React.useEffect(()=>{if(!s)return;let e=document.body.style.overflow;return document.body.style.overflow="hidden",()=>{document.body.style.overflow=e}},[s]),React.useEffect(()=>{s||F(!1)},[s]),React.useEffect(()=>{let e=n=>z(n.detail&&n.detail.lang||window.CM_I18N&&window.CM_I18N.current||"en");return document.addEventListener("cm:langchanged",e),()=>document.removeEventListener("cm:langchanged",e)},[]),React.useEffect(()=>{!s||r||!u||!window.sb||window.sb.from("profiles").select("first_name,last_name,phone,birth_date,preferred_lang,avatar_url,full_name").eq("id",u).single().then(({data:e})=>{let n=e||{};p({first_name:n.first_name||"",last_name:n.last_name||"",phone:n.phone||"",birth_date:n.birth_date||"",preferred_lang:window.CM_I18N&&window.CM_I18N.current||n.preferred_lang||"en",avatar_url:n.avatar_url||a&&a.avatar_url||null})},()=>{})},[s,u]);let q=React.useMemo(()=>w||(r&&window.cmAvatarUrl?window.cmAvatarUrl(r):null),[w,r&&r.avatar_url]),E=(e,n)=>p(c=>({...c||{},[e]:n})),ee=e=>{let n=e.target.files&&e.target.files[0];if(n){v(n);try{l(URL.createObjectURL(n))}catch{}}};async function te(){if(!r)return;let e=(r.first_name||"").trim(),n=(r.last_name||"").trim();if(!e||!n){j(t("settings.profile.name_required","Please enter your first and last name."));return}j(null),y("saving");try{let c=u||a&&a.id;if(!c||!window.sb)throw new Error("no session");let d=r.avatar_url||null;if(g){let I=await window.cmShrinkImage(g,{maxDim:512,maxBytes:153600}),ce=(I.name.split(".").pop()||"jpg").toLowerCase().replace(/[^a-z0-9]/g,"")||"jpg",Y=c+"/avatar."+ce,{error:J}=await window.sb.storage.from("profile-avatars").upload(Y,I,{upsert:!0,contentType:I.type||"image/jpeg",cacheControl:window.CM_CACHE_IMMUTABLE});if(J)throw J;let{data:K}=await window.sb.storage.from("profile-avatars").createSignedUrl(Y,31536e4);d=K&&K.signedUrl||d}let C=(e+" "+n).trim(),S={first_name:e,last_name:n,phone:r.phone||null,birth_date:r.birth_date||null,preferred_lang:r.preferred_lang,full_name:C};d&&(S.avatar_url=d);let{error:X}=await window.sb.from("profiles").update(S).eq("id",c);if(X)throw X;if(r.preferred_lang&&r.preferred_lang!==Z){if(window.CM_I18N&&window.CM_I18N.setLang)try{window.CM_I18N.setLang(r.preferred_lang)}catch{}try{localStorage.setItem("cm_lang",r.preferred_lang)}catch{}z(r.preferred_lang),$(!0)}let B={...a||{},...S};d&&(B.avatar_url=d);try{window.__cm_profile={...window.__cm_profile||{},...B}}catch{}m&&m(B),p(I=>({...I||{},avatar_url:d})),v(null),l(null);try{document.dispatchEvent(new CustomEvent("cm:profileupdated",{detail:{profile:B}}))}catch{}y("saved"),setTimeout(()=>y("idle"),2e3)}catch(c){j(c&&c.message||t("settings.profile.save_error","Couldn't save your profile.")),y("idle")}}let k=e=>_(n=>({...n,...e})),H=(e,n)=>k({notif:{...o.notif,[e]:n}}),se=()=>M.map(e=>e.id),ae=(e,n)=>{let c=o.notif&&o.notif.teamFilter&&o.notif.teamFilter[e];return!Array.isArray(c)||c.includes(n)},ne=(e,n)=>{let c={...o.notif&&o.notif.teamFilter||{}},d=Array.isArray(c[e])?c[e]:se();d=d.includes(n)?d.filter(S=>S!==n):[...d,n],c[e]=d;let C={...o.notif,teamFilter:c};k({notif:C});try{document.dispatchEvent(new CustomEvent("cm:notiffilterchanged",{detail:c}))}catch{}},xe=window.CM_I18N&&window.CM_I18N.langs||["en","es","pt"],we=window.CM_I18N&&window.CM_I18N.name||{en:"English",es:"Espa\xF1ol",pt:"Portugu\xEAs"},oe=e=>{window.CM_I18N&&window.CM_I18N.setLang(e),z(e),$(!0)},ye=async()=>{try{localStorage.removeItem("cm_lang")}catch{}try{if(window.sb&&(a!=null&&a.id)){let{data:e}=await window.sb.from("profiles").select("settings").eq("id",a.id).single(),n={...(e==null?void 0:e.settings)||{}};delete n.language,await window.sb.from("profiles").update({settings:n}).eq("id",a.id)}}catch{}window.location.reload()},ie=e=>e==="dark"?"#0A0A0A":e==="hybrid"?"linear-gradient(90deg,#0E1116 0%,#0E1116 30%,#FBFBFA 30%,#FBFBFA 100%)":"#FBFBFA",W=e=>e==="dark"?"rgba(255,255,255,0.10)":"#E5E7EB",re=Object.entries(T[o.theme]);return React.createElement(React.Fragment,null,React.createElement("style",null,be),React.createElement("div",{className:`sd-overlay ${s?"is-open":""}`,onClick:i}),React.createElement("aside",{className:`sd-drawer ${s?"is-open":""}`,role:"dialog","aria-label":t("settings.title","Settings")},React.createElement("header",{className:"sd-head"},React.createElement("div",{className:"sd-head-l"},React.createElement("i",{className:"ti ti-settings"}),React.createElement("div",null,React.createElement("div",{className:"sd-title"},t("settings.title","Settings")),React.createElement("div",{className:"sd-sub"},t("settings.subtitle","Appearance \xB7 workspace \xB7 account")))),React.createElement("button",{className:"sd-x",onClick:i,"aria-label":t("settings.close","Close")},React.createElement("i",{className:"ti ti-x"}))),React.createElement("nav",{className:"sd-tabs"},[{id:"appearance",icon:"ti-palette",label:"Appearance"},{id:"notifications",icon:"ti-bell",label:"Notifications"},{id:"account",icon:"ti-shield-lock",label:"Account"},{id:"billing",icon:"ti-credit-card",label:"Billing"}].map(({id:e,icon:n,label:c})=>React.createElement("button",{key:e,className:`sd-tab ${x===e?"is-on":""}`,onClick:()=>R(e)},React.createElement("i",{className:`ti ${n}`}),t("settings.tab."+e,c)))),React.createElement("div",{className:"sd-body"},x==="appearance"&&React.createElement(React.Fragment,null,React.createElement(b,{label:t("settings.theme","Theme"),hint:t("settings.theme.hint","How the chrome looks across the app.")},React.createElement("div",{className:"sd-tiles"},["light","dark","hybrid"].map(e=>React.createElement("button",{key:e,className:`sd-tile ${o.theme===e?"is-on":""}`,onClick:()=>k({theme:e,accent:T[e][o.accent]?o.accent:"green"})},React.createElement("div",{className:"sd-tile-pv",style:{background:ie(e),borderColor:W(e)}},React.createElement("div",{className:"sd-tile-pv-bar",style:{background:e==="dark"?"rgba(255,255,255,0.08)":e==="hybrid"?"rgba(255,255,255,0.06)":"#EFEFED"}}),React.createElement("div",{className:"sd-tile-pv-c",style:{background:e==="dark"?"#161616":"#fff",borderColor:W(e)}})),React.createElement("div",{className:"sd-tile-label"},React.createElement("span",null,t("settings.theme_"+e,e==="light"?"Light":e==="dark"?"Dark":"Hybrid")),o.theme===e?React.createElement("i",{className:"ti ti-check"}):null))))),React.createElement(b,{label:t("settings.accent","Accent"),hint:t("settings.accent.hint","Used for primary buttons, active nav, and focus rings.")},React.createElement("div",{className:"sd-swatches"},re.map(([e,n])=>React.createElement("button",{key:e,className:`sd-swatch ${o.accent===e?"is-on":""}`,onClick:()=>k({accent:e}),title:e},React.createElement("span",{className:"sd-swatch-hue",style:{background:n.hue}}),React.createElement("span",{className:"sd-swatch-name"},e))))),o.theme!=="light"?React.createElement(b,{label:t("settings.sidebar_tone","Sidebar tone")},React.createElement("div",{className:"sd-chips"},[{v:"default",l:"Default"},{v:"ink",l:"Ink"},{v:"slate",l:"Slate"},{v:"forest",l:"Forest"},{v:"zinc",l:"Zinc"}].map(e=>React.createElement("button",{key:e.v,className:`sd-chip ${o.sidebarHue===e.v?"is-on":""}`,onClick:()=>k({sidebarHue:e.v})},t("settings.tone_"+e.v,e.l))))):null,React.createElement(b,{label:t("settings.density","Density"),hint:t("settings.density.hint","Affects vertical padding inside cards & tables.")},React.createElement("div",{className:"sd-chips"},[{v:"compact",l:"Compact",k:"compact"},{v:"balanced",l:"Balanced",k:"balanced"},{v:"comfortable",l:"Comfy",k:"comfy"}].map(e=>React.createElement("button",{key:e.v,className:`sd-chip ${o.density===e.v?"is-on":""}`,onClick:()=>k({density:e.v})},t("settings.density_"+e.k,e.l))))),React.createElement(b,{label:t("settings.corners","Corners")},React.createElement("div",{className:"sd-chips"},[{v:"tight",l:"Tight"},{v:"regular",l:"Regular"},{v:"soft",l:"Soft"}].map(e=>React.createElement("button",{key:e.v,className:`sd-chip ${o.radius===e.v?"is-on":""}`,onClick:()=>k({radius:e.v})},t("settings.corners_"+e.v,e.l))))),React.createElement(b,{label:t("settings.reset","Reset")},A?React.createElement("div",{className:"sd-reset-confirm"},React.createElement("span",null,t("settings.reset_confirm","Reset all appearance settings?")),React.createElement("button",{className:"sd-reset-yes",onClick:()=>{localStorage.removeItem(U);let e=P();_(e),F(!1)}},React.createElement("i",{className:"ti ti-check"}),t("settings.reset_yes","Yes, reset")),React.createElement("button",{className:"sd-reset-no",onClick:()=>F(!1)},t("settings.cancel","Cancel"))):React.createElement("button",{className:"sd-reset",onClick:()=>F(!0)},React.createElement("i",{className:"ti ti-rotate"}),t("settings.reset_defaults","Reset to workspace defaults")))),x==="notifications"&&React.createElement(React.Fragment,null,React.createElement(b,{label:t("settings.inapp_alerts","In-app alerts"),hint:t("settings.inapp_alerts.hint","Shown as badges and banners inside the app.")},[{key:"alertInjury",k:"injury",label:"Injury reported",sub:"Badge on the Treatments nav item"},{key:"alertTask",k:"task",label:"Task assigned to me",sub:"Badge on the Tasks nav item"},{key:"alertSession",k:"session",label:"Session published",sub:"Shown in Hub activity feed"}].map(({key:e,k:n,label:c,sub:d})=>React.createElement("div",{key:e,className:"sd-toggle-row"},React.createElement("div",{className:"sd-row-l"},React.createElement("div",{className:"sd-row-label"},t("settings.alert_"+n,c)),React.createElement("div",{className:"sd-row-sub"},t("settings.alert_"+n+".sub",d))),React.createElement("button",{role:"switch","aria-checked":!!(o.notif&&o.notif[e]),className:`sd-toggle ${o.notif&&o.notif[e]?"is-on":""}`,onClick:()=>H(e,!(o.notif&&o.notif[e]))},React.createElement("span",{className:"sd-toggle-thumb"}))))),React.createElement(b,{label:t("settings.notif_teams","Notifications by team"),hint:t("settings.notif_teams.hint","For each alert, pick which teams you want notifications about. Club-wide alerts always show.")},M.length<2?React.createElement("div",{className:"sd-row-sub"},t("settings.notif_teams.single","You only have one team \u2014 nothing to filter here.")):[{type:"wellness_alert",label:"Discomfort reported",sub:"Wellness & post-RPE discomfort alerts"},{type:"task_reminder",label:"Task reminders",sub:"Reminders for tasks due soon"},{type:"player_birthday",label:"Player birthdays",sub:"Birthday reminders for players"}].map(({type:e,label:n,sub:c})=>React.createElement("div",{key:e,className:"sd-teamrow"},React.createElement("div",{className:"sd-teamrow-h"},React.createElement("div",{className:"sd-row-label"},t("settings.notif_type_"+e,n)),React.createElement("div",{className:"sd-row-sub"},t("settings.notif_type_"+e+".sub",c))),React.createElement("div",{className:"sd-teamchips"},M.map(d=>{let C=ae(e,d.id);return React.createElement("button",{key:d.id,type:"button",className:`sd-teamchip ${C?"is-on":""}`,"aria-pressed":C,onClick:()=>ne(e,d.id)},React.createElement("i",{className:`ti ${C?"ti-check":"ti-plus"}`}),d.name)}))))),React.createElement(b,{label:t("settings.email_digest","Email digest"),hint:t("settings.email_digest.hint","Requires email delivery to be configured by the workspace admin.")},[{key:"emailWeekly",k:"weekly",label:"Weekly summary",sub:"Sent every Monday morning"},{key:"emailInjury",k:"injury",label:"Injury alerts",sub:"Immediate \u2014 for medical staff"}].map(({key:e,k:n,label:c,sub:d})=>React.createElement("div",{key:e,className:"sd-toggle-row"},React.createElement("div",{className:"sd-row-l"},React.createElement("div",{className:"sd-row-label"},t("settings.email_"+n,c)),React.createElement("div",{className:"sd-row-sub"},t("settings.email_"+n+".sub",d))),React.createElement("button",{role:"switch","aria-checked":!!(o.notif&&o.notif[e]),className:`sd-toggle ${o.notif&&o.notif[e]?"is-on":""}`,onClick:()=>H(e,!(o.notif&&o.notif[e]))},React.createElement("span",{className:"sd-toggle-thumb"})))),React.createElement("div",{className:"sd-note"},React.createElement("i",{className:"ti ti-info-circle"}),t("settings.email_note","Email delivery is not yet configured for this workspace. Preferences are saved for when it is.")))),x==="account"&&React.createElement(React.Fragment,null,React.createElement(b,{label:t("settings.profile.title","My profile")},r?React.createElement("div",{className:"sd-pf"},React.createElement("div",{className:"sd-pf-photo"},React.createElement("div",{className:"sd-pf-ava"},q?React.createElement("img",{src:q,alt:""}):React.createElement("span",null,window.cmInitials?window.cmInitials(((r.first_name||"")+" "+(r.last_name||"")).trim()||a&&a.email||"?"):"?")),React.createElement("label",{className:"sd-pf-photobtn"},React.createElement("i",{className:"ti ti-camera"}),t("settings.profile.change_photo","Change photo"),React.createElement("input",{type:"file",accept:"image/*",onChange:ee,style:{display:"none"}}))),React.createElement("div",{className:"sd-pf-grid"},React.createElement("label",{className:"sd-pf-f"},React.createElement("span",null,t("settings.profile.first_name","First name")),React.createElement("input",{value:r.first_name,onChange:e=>E("first_name",e.target.value)})),React.createElement("label",{className:"sd-pf-f"},React.createElement("span",null,t("settings.profile.last_name","Last name")),React.createElement("input",{value:r.last_name,onChange:e=>E("last_name",e.target.value)})),React.createElement("label",{className:"sd-pf-f"},React.createElement("span",null,t("settings.profile.phone","Phone")),React.createElement("input",{type:"tel",value:r.phone,onChange:e=>E("phone",e.target.value)})),React.createElement("label",{className:"sd-pf-f"},React.createElement("span",null,t("settings.profile.birth_date","Birth date")),React.createElement("input",{type:"date",value:r.birth_date||"",onChange:e=>E("birth_date",e.target.value)})),React.createElement("label",{className:"sd-pf-f sd-pf-wide"},React.createElement("span",null,t("settings.profile.language","Language")),React.createElement("select",{value:r.preferred_lang,onChange:e=>{let n=e.target.value;E("preferred_lang",n),oe(n)}},React.createElement("option",{value:"en"},"English"),React.createElement("option",{value:"es"},"Espa\xF1ol"),React.createElement("option",{value:"pt"},"Portugu\xEAs")))),D?React.createElement("div",{className:"sd-pf-err"},D):null,React.createElement("div",{className:"sd-pf-actions"},React.createElement("button",{className:"sd-pf-save",disabled:h==="saving",onClick:te},h==="saving"?t("settings.profile.saving","Saving\u2026"):h==="saved"?t("settings.profile.saved","Saved"):t("settings.profile.save","Save")))):React.createElement("div",{className:"sd-row-sub"},t("settings.profile.loading","Loading\u2026"))),React.createElement(b,{label:t("settings.signed_in_as","Signed in as")},React.createElement("div",{className:"sd-account-row"},React.createElement("div",{className:"sd-account-avatar"},a?(a.full_name||a.email||"?")[0].toUpperCase():"?"),React.createElement("div",null,(a==null?void 0:a.full_name)&&React.createElement("div",{className:"sd-row-label"},a.full_name),React.createElement("div",{className:"sd-row-sub"},(a==null?void 0:a.email)||"\u2014"),React.createElement("div",{className:"sd-row-sub",style:{marginTop:2}},(a==null?void 0:a.role)||"")))),React.createElement(b,{label:t("settings.session","Session")},React.createElement("button",{className:"sd-reset sd-signout",onClick:async()=>{await window.sb.auth.signOut(),window.location.href="Login.html"}},React.createElement("i",{className:"ti ti-logout"}),t("settings.sign_out","Sign out")))),x==="billing"&&React.createElement(ue,null)),React.createElement("footer",{className:"sd-foot"},React.createElement("span",null,React.createElement("i",{className:"ti ti-cloud"}),t("settings.saved_footer","Saved to cloud & this device")))))},be=`
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

  /* Per-type team filter */
  .sd-teamrow { padding:12px 0; border-bottom:1px solid var(--cm-border-soft); }
  .sd-teamrow:last-child { border-bottom:0; }
  .sd-teamrow-h { margin-bottom:8px; }
  .sd-teamchips { display:flex; flex-wrap:wrap; gap:6px; }
  .sd-teamchip {
    display:inline-flex; align-items:center; gap:5px; cursor:pointer;
    padding:5px 10px; border-radius:999px; font:600 12px/1 var(--cm-font-sans);
    border:1px solid var(--cm-border); background:var(--cm-bg-soft); color:var(--cm-fg-muted);
    transition:background 140ms, color 140ms, border-color 140ms;
  }
  .sd-teamchip.is-on { background:var(--cm-accent-soft,var(--cm-accent)); border-color:var(--cm-accent); color:var(--cm-accent); }
  .sd-teamchip .ti { font-size:13px; }

  /* Info note */
  .sd-note { display:flex; align-items:flex-start; gap:7px; padding:10px 12px; margin-top:12px; background:var(--cm-bg-soft); border-radius:8px; font:500 12px/1.4 var(--cm-font-sans); color:var(--cm-fg-muted); }
  .sd-note .ti { font-size:14px; flex-shrink:0; margin-top:1px; }

  /* Account tab */
  .sd-account-row { display:flex; align-items:center; gap:12px; padding:6px 0; }
  .sd-account-avatar { width:38px; height:38px; border-radius:50%; background:var(--cm-accent); color:var(--cm-fg-on-accent,#fff); font:600 16px/38px var(--cm-font-sans); text-align:center; flex-shrink:0; }
  .sd-signout { color:var(--cm-danger,#DC2626); }
  /* My profile (editable) */
  .sd-pf { display:flex; flex-direction:column; gap:12px; }
  .sd-pf-photo { display:flex; align-items:center; gap:12px; }
  .sd-pf-ava { width:56px; height:56px; border-radius:50%; overflow:hidden; background:var(--cm-bg-sunk); border:1px solid var(--cm-border); display:flex; align-items:center; justify-content:center; font:600 18px/1 var(--cm-font-sans); color:var(--cm-fg-muted); flex-shrink:0; }
  .sd-pf-ava img { width:100%; height:100%; object-fit:cover; }
  .sd-pf-photobtn { display:inline-flex; align-items:center; gap:6px; height:32px; padding:0 12px; border:1px solid var(--cm-border); border-radius:8px; background:var(--cm-bg-soft); color:var(--cm-fg); font:500 12px/1 var(--cm-font-sans); cursor:pointer; }
  .sd-pf-photobtn:hover { border-color:var(--cm-accent); }
  .sd-pf-photobtn .ti { font-size:15px; }
  .sd-pf-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
  .sd-pf-f { display:flex; flex-direction:column; gap:5px; min-width:0; }
  .sd-pf-f.sd-pf-wide { grid-column:1 / -1; }
  .sd-pf-f > span { font:500 11.5px/1 var(--cm-font-sans); color:var(--cm-fg-muted); }
  .sd-pf-f input, .sd-pf-f select { height:36px; padding:0 10px; background:var(--cm-bg-soft); border:1px solid var(--cm-border); border-radius:8px; font:var(--cm-body-sm); color:var(--cm-fg); outline:none; box-sizing:border-box; width:100%; }
  .sd-pf-f input:focus, .sd-pf-f select:focus { border-color:var(--cm-accent); }
  .sd-pf-err { font:500 12px/1.4 var(--cm-font-sans); color:var(--cm-danger,#DC2626); background:var(--cm-danger-bg,#FEF2F2); border-radius:8px; padding:8px 10px; }
  .sd-pf-actions { display:flex; justify-content:flex-end; }
  .sd-pf-save { height:34px; padding:0 16px; border:0; border-radius:8px; background:var(--cm-accent); color:var(--cm-fg-on-accent,#fff); font:600 12.5px/1 var(--cm-font-sans); cursor:pointer; }
  .sd-pf-save:disabled { opacity:.6; cursor:default; }
  .sd-pf-save:hover:not(:disabled) { background:var(--cm-accent-hover,var(--cm-accent)); }

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
`;window.SettingsDrawer=V;window.openCMSettings=null;window.initCMSettings=P;function ve(){let[s,i]=React.useState(!1),[a,u]=React.useState(null),[m,f]=React.useState(null),[N,o]=React.useState(null),[_,x]=React.useState([]),R=React.useRef(null),A=React.useRef(null);React.useEffect(()=>{if(window.sb)return window.sb.auth.getSession().then(({data:p})=>{var v,w;let g=(w=(v=p==null?void 0:p.session)==null?void 0:v.user)==null?void 0:w.id;g&&(f(g),window.CM_I18N&&window.CM_I18N.setCloudSaver(async l=>{let{data:h}=await window.sb.from("profiles").select("settings").eq("id",g).single(),y={...(h==null?void 0:h.settings)||{},language:l};await window.sb.from("profiles").update({settings:y}).eq("id",g)}),window.getClub&&window.getClub().then(l=>{l&&window.CM_I18N&&window.CM_I18N.setClubCountry(l.country)}),window.sb.from("profiles").select("settings, notification_settings").eq("id",g).single().then(({data:l})=>{if(!l)return;window.CM_I18N&&l.settings&&l.settings.language&&window.CM_I18N.setUserPref(l.settings.language);let h={...l.settings||{},notif:l.notification_settings||{}};(Object.keys(l.settings||{}).length>0||Object.keys(l.notification_settings||{}).length>0)&&o(h)}),A.current=window.sb.channel("cm-notif-"+g).on("postgres_changes",{event:"INSERT",schema:"public",table:"notifications",filter:`user_id=eq.${g}`},l=>{let h=l.new,y=Date.now()+Math.random();x(D=>[...D,{...h,_popupId:y}])}).subscribe())}),()=>{A.current&&window.sb.removeChannel(A.current)}},[]),React.useEffect(()=>(window.openCMSettings=()=>i(!0),()=>{window.openCMSettings=null}),[]),React.useEffect(()=>{!s||a||window.getProfile&&window.getProfile().then(p=>u(p))},[s]);function F(p){!m||!window.sb||(clearTimeout(R.current),R.current=setTimeout(async()=>{let{notif:g,...v}=p,w;try{w=localStorage.getItem("cm_lang")}catch{}window.CM_I18N&&w?v.language=window.CM_I18N.current:delete v.language;let{error:l}=await window.sb.from("profiles").update({settings:v,notification_settings:g||{}}).eq("id",m);l&&console.warn("[settings] cloud save failed:",l.message)},800))}function r(p){x(g=>g.filter(v=>v._popupId!==p))}return React.createElement(React.Fragment,null,React.createElement(V,{open:s,onClose:()=>i(!1),profile:a,userId:m,setProfile:u,supabaseSettings:N,onSettingsChange:F}),React.createElement("div",{className:"cm-notif-stack"},_.map(p=>React.createElement(ge,{key:p._popupId,notif:p,onDismiss:()=>r(p._popupId)}))))}(function(){P();let i=document.getElementById("settings-host")||(()=>{let a=document.createElement("div");return a.id="settings-host",document.body.appendChild(a),a})();ReactDOM.createRoot(i).render(React.createElement(ve,null)),document.addEventListener("click",a=>{a.target.closest("[data-open-settings]")&&(a.preventDefault(),window.openCMSettings&&window.openCMSettings())})})();})();
