(()=>{var z="cm-settings.v1";function ce(){try{let a=localStorage.getItem(z);return a?JSON.parse(a):{}}catch{return{}}}function K(a){try{localStorage.setItem(z,JSON.stringify(a))}catch{}}var t=(a,o)=>{try{return window.CM_I18N&&window.CM_I18N.t?window.CM_I18N.t(a):o}catch{return o}},B={light:{neutral:{hue:"#0A0A0A",soft:"#F4F4F2",tokens:{"--cm-accent":"#0A0A0A","--cm-accent-hover":"#1F1F1F","--cm-accent-press":"#000","--cm-accent-soft":"#F4F4F2","--cm-fg-on-accent":"#fff"}},green:{hue:"#15803D",soft:"#ECFDF5",tokens:{"--cm-accent":"#15803D","--cm-accent-hover":"#166534","--cm-accent-press":"#14532D","--cm-accent-soft":"#ECFDF5","--cm-fg-on-accent":"#fff"}},blue:{hue:"#2563EB",soft:"#EFF6FF",tokens:{"--cm-accent":"#2563EB","--cm-accent-hover":"#1D4ED8","--cm-accent-press":"#1E40AF","--cm-accent-soft":"#EFF6FF","--cm-fg-on-accent":"#fff"}},violet:{hue:"#7C3AED",soft:"#F5F3FF",tokens:{"--cm-accent":"#7C3AED","--cm-accent-hover":"#6D28D9","--cm-accent-press":"#5B21B6","--cm-accent-soft":"#F5F3FF","--cm-fg-on-accent":"#fff"}},gold:{hue:"#A87C2A",soft:"#FAF3E2",tokens:{"--cm-accent":"#A87C2A","--cm-accent-hover":"#8C6520","--cm-accent-press":"#75531B","--cm-accent-soft":"#FAF3E2","--cm-fg-on-accent":"#fff"}}},dark:{neutral:{hue:"#FAFAFA",soft:"rgba(255,255,255,0.06)",tokens:{"--cm-accent":"#FAFAFA","--cm-accent-hover":"#E5E5E5","--cm-accent-press":"#fff","--cm-accent-soft":"rgba(255,255,255,0.06)","--cm-fg-on-accent":"#0A0A0A"}},green:{hue:"#22C55E",soft:"rgba(34,197,94,0.10)",tokens:{"--cm-accent":"#22C55E","--cm-accent-hover":"#16A34A","--cm-accent-press":"#15803D","--cm-accent-soft":"rgba(34,197,94,0.10)","--cm-fg-on-accent":"#0A0A0A"}},blue:{hue:"#3B82F6",soft:"rgba(59,130,246,0.10)",tokens:{"--cm-accent":"#3B82F6","--cm-accent-hover":"#2563EB","--cm-accent-press":"#1D4ED8","--cm-accent-soft":"rgba(59,130,246,0.10)","--cm-fg-on-accent":"#fff"}},violet:{hue:"#A78BFA",soft:"rgba(167,139,250,0.10)",tokens:{"--cm-accent":"#A78BFA","--cm-accent-hover":"#8B5CF6","--cm-accent-press":"#7C3AED","--cm-accent-soft":"rgba(167,139,250,0.10)","--cm-fg-on-accent":"#0A0A0A"}},gold:{hue:"#C9A84C",soft:"rgba(201,168,76,0.12)",tokens:{"--cm-accent":"#C9A84C","--cm-accent-hover":"#A87C2A","--cm-accent-press":"#8B6520","--cm-accent-soft":"rgba(201,168,76,0.12)","--cm-fg-on-accent":"#0A0A0A"}}},hybrid:{neutral:{hue:"#0A0A0A",soft:"#F4F4F2",tokens:{"--cm-accent":"#0A0A0A","--cm-accent-hover":"#1F1F1F","--cm-accent-press":"#000","--cm-accent-soft":"#F4F4F2","--cm-fg-on-accent":"#fff","--cm-side-item-active-bg":"rgba(255,255,255,0.06)","--cm-side-item-active-fg":"#fff","--cm-side-accent":"#fff"}},green:{hue:"#15803D",soft:"#ECFDF5",tokens:{"--cm-accent":"#15803D","--cm-accent-hover":"#166534","--cm-accent-press":"#14532D","--cm-accent-soft":"#ECFDF5","--cm-fg-on-accent":"#fff","--cm-side-item-active-bg":"rgba(34,197,94,0.10)","--cm-side-item-active-fg":"#4ADE80","--cm-side-accent":"#4ADE80"}},blue:{hue:"#2563EB",soft:"#EFF6FF",tokens:{"--cm-accent":"#2563EB","--cm-accent-hover":"#1D4ED8","--cm-accent-press":"#1E40AF","--cm-accent-soft":"#EFF6FF","--cm-fg-on-accent":"#fff","--cm-side-item-active-bg":"rgba(59,130,246,0.14)","--cm-side-item-active-fg":"#60A5FA","--cm-side-accent":"#60A5FA"}},violet:{hue:"#7C3AED",soft:"#F5F3FF",tokens:{"--cm-accent":"#7C3AED","--cm-accent-hover":"#6D28D9","--cm-accent-press":"#5B21B6","--cm-accent-soft":"#F5F3FF","--cm-fg-on-accent":"#fff","--cm-side-item-active-bg":"rgba(167,139,250,0.14)","--cm-side-item-active-fg":"#A78BFA","--cm-side-accent":"#A78BFA"}},gold:{hue:"#A87C2A",soft:"#FAF3E2",tokens:{"--cm-accent":"#A87C2A","--cm-accent-hover":"#8C6520","--cm-accent-press":"#75531B","--cm-accent-soft":"#FAF3E2","--cm-fg-on-accent":"#fff","--cm-side-item-active-bg":"rgba(201,168,76,0.16)","--cm-side-item-active-fg":"#E5C875","--cm-side-accent":"#E5C875"}}}},re={default:{},ink:{"--cm-side-bg":"#0A0A0A"},slate:{"--cm-side-bg":"#0F172A"},forest:{"--cm-side-bg":"#0D1F17"},zinc:{"--cm-side-bg":"#18181B"}},de={tight:{"--cm-r-2":"4px","--cm-r-3":"5px","--cm-r-4":"6px","--cm-r-5":"8px","--cm-r-6":"10px"},regular:{},soft:{"--cm-r-2":"8px","--cm-r-3":"10px","--cm-r-4":"14px","--cm-r-5":"18px","--cm-r-6":"22px"}},le={compact:{"--cm-density-pad":"10px"},balanced:{"--cm-density-pad":"14px"},comfortable:{"--cm-density-pad":"20px"}};function L(a){let o=document.documentElement;o.setAttribute("data-theme",a.theme),["--cm-accent","--cm-accent-hover","--cm-accent-press","--cm-accent-soft","--cm-fg-on-accent","--cm-side-item-active-bg","--cm-side-item-active-fg","--cm-side-accent","--cm-side-bg","--cm-r-2","--cm-r-3","--cm-r-4","--cm-r-5","--cm-r-6","--cm-density-pad"].forEach(l=>o.style.removeProperty(l));let u=B[a.theme]&&B[a.theme][a.accent]||{};Object.entries(u.tokens||{}).forEach(([l,g])=>o.style.setProperty(l,g)),Object.entries(re[a.sidebarHue]||{}).forEach(([l,g])=>o.style.setProperty(l,g)),Object.entries(de[a.radius]||{}).forEach(([l,g])=>o.style.setProperty(l,g)),Object.entries(le[a.density]||{}).forEach(([l,g])=>o.style.setProperty(l,g))}var me={alertInjury:!0,alertTask:!0,alertSession:!0,emailWeekly:!0,emailInjury:!0};function M(){let a=ce(),o=window.__CM_TWEAK_DEFAULTS||{theme:"light",accent:"neutral"},s=Object.assign({theme:"light",accent:"neutral",radius:"regular",density:"balanced",sidebarHue:"default"},o,a);return s.notif={...me,...s.notif||{}},L(s),s}var pe=({notif:a,onDismiss:o})=>(React.useEffect(()=>{let s=setTimeout(o,4e3);return()=>clearTimeout(s)},[]),React.createElement("div",{className:"cm-toast",onClick:()=>{a.link&&(window.location.href=a.link),o()}},React.createElement("i",{className:"ti ti-bell cm-toast-icon"}),React.createElement("div",{className:"cm-toast-body"},React.createElement("div",{className:"cm-toast-title"},a.title),a.body&&React.createElement("div",{className:"cm-toast-sub"},a.body)),React.createElement("button",{className:"cm-toast-x",onClick:s=>{s.stopPropagation(),o()}},React.createElement("i",{className:"ti ti-x"})))),ge=()=>{let[a,o]=React.useState(null),[s,u]=React.useState(!0);React.useEffect(()=>{window.getClub&&window.getClub().then(_=>{o(_),u(!1)})},[]);let l=(a==null?void 0:a.billing_plan)||null,g=(a==null?void 0:a.billing_amount)||null,N=(a==null?void 0:a.billing_next_date)||null,i=(a==null?void 0:a.billing_status)||null;return React.createElement(React.Fragment,null,React.createElement("div",{className:"sd-section"},React.createElement("div",{className:"sd-section-h"},React.createElement("div",{className:"sd-section-l"},t("settings.workspace_subscription","Workspace subscription"))),React.createElement("div",{className:"sd-section-body"},React.createElement("div",{className:"sd-billing-card"},React.createElement("div",{className:"sd-billing-row"},React.createElement("span",{className:"sd-row-label"},t("settings.plan","Plan")),React.createElement("span",{className:"sd-billing-val"},s?"\u2026":l||"\u2014")),React.createElement("div",{className:"sd-billing-row"},React.createElement("span",{className:"sd-row-label"},t("settings.monthly_amount","Monthly amount")),React.createElement("span",{className:"sd-billing-val"},s?"\u2026":g?`$${g}`:"\u2014")),React.createElement("div",{className:"sd-billing-row"},React.createElement("span",{className:"sd-row-label"},t("settings.next_billing","Next billing date")),React.createElement("span",{className:"sd-billing-val"},s?"\u2026":N?new Date(N).toLocaleDateString(window.CM_I18N&&CM_I18N.current||[],{month:"long",day:"numeric",year:"numeric"}):"\u2014")),React.createElement("div",{className:"sd-billing-row"},React.createElement("span",{className:"sd-row-label"},t("settings.status","Status")),React.createElement("span",{className:"sd-billing-val",style:{color:i==="active"?"var(--cm-success)":"var(--cm-fg-muted)"}},s?"\u2026":i||"\u2014"))),React.createElement("div",{style:{padding:"10px 14px",borderTop:"1px solid var(--cm-border-soft)"}},React.createElement("a",{href:"Billing.html",style:{display:"inline-flex",alignItems:"center",gap:6,fontSize:12.5,fontWeight:500,color:"var(--cm-accent)",textDecoration:"none"}},t("settings.view_full_detail","View full detail")," ",React.createElement("i",{className:"ti ti-arrow-right",style:{fontSize:13}}))),React.createElement("div",{className:"sd-note",style:{marginTop:12}},React.createElement("i",{className:"ti ti-brand-stripe"}),t("settings.billing_stripe_note","Billing is managed via Stripe. Subscription data syncs automatically when the webhook is active. Contact your admin to change plans.")))))},V=({open:a,onClose:o,profile:s,userId:u,setProfile:l,supabaseSettings:g,onSettingsChange:N})=>{let[i,_]=React.useState(M),[x,I]=React.useState("appearance"),[A,C]=React.useState(!1),[c,m]=React.useState(null),[p,v]=React.useState(null),[w,r]=React.useState(null),[h,y]=React.useState("idle"),[k,F]=React.useState(null),[R,j]=React.useState(()=>window.CM_I18N?window.CM_I18N.current:"en"),[U,q]=React.useState(()=>{try{return!!localStorage.getItem("cm_lang")}catch{return!1}}),O=React.useRef(!1);React.useEffect(()=>{if(L(i),K(i),!O.current){O.current=!0;return}N&&N(i)},[i]),React.useEffect(()=>{g&&_(e=>{let{notif:n,...d}=g,f={...e,...d,notif:{...e.notif,...n||{}}};return L(f),K(f),f})},[g]),React.useEffect(()=>{let e=n=>{n.key==="Escape"&&o()};return a&&document.addEventListener("keydown",e),()=>document.removeEventListener("keydown",e)},[a]),React.useEffect(()=>{if(!a)return;let e=document.body.style.overflow;return document.body.style.overflow="hidden",()=>{document.body.style.overflow=e}},[a]),React.useEffect(()=>{a||C(!1)},[a]),React.useEffect(()=>{let e=n=>j(n.detail&&n.detail.lang||window.CM_I18N&&window.CM_I18N.current||"en");return document.addEventListener("cm:langchanged",e),()=>document.removeEventListener("cm:langchanged",e)},[]),React.useEffect(()=>{!a||c||!u||!window.sb||window.sb.from("profiles").select("first_name,last_name,phone,birth_date,job_title,preferred_lang,avatar_url,full_name").eq("id",u).single().then(({data:e})=>{let n=e||{};m({first_name:n.first_name||"",last_name:n.last_name||"",phone:n.phone||"",birth_date:n.birth_date||"",job_title:n.job_title||"",preferred_lang:n.preferred_lang||window.CM_I18N&&window.CM_I18N.current||"en",avatar_url:n.avatar_url||s&&s.avatar_url||null})},()=>{})},[a,u]);let E=(e,n)=>m(d=>({...d||{},[e]:n})),Z=e=>{let n=e.target.files&&e.target.files[0];if(n){v(n);try{r(URL.createObjectURL(n))}catch{}}};async function Q(){if(!c)return;let e=(c.first_name||"").trim(),n=(c.last_name||"").trim();if(!e||!n){F(t("settings.profile.name_required","Please enter your first and last name."));return}F(null),y("saving");try{let d=u||s&&s.id;if(!d||!window.sb)throw new Error("no session");let f=c.avatar_url||null;if(p){let T=(p.name.split(".").pop()||"jpg").toLowerCase().replace(/[^a-z0-9]/g,"")||"jpg",X=d+"/avatar."+T,{error:J}=await window.sb.storage.from("profile-avatars").upload(X,p,{upsert:!0,contentType:p.type||"image/jpeg"});if(J)throw J;let{data:Y}=await window.sb.storage.from("profile-avatars").createSignedUrl(X,31536e4);f=Y&&Y.signedUrl||f}let oe=(e+" "+n).trim(),P={first_name:e,last_name:n,phone:c.phone||null,birth_date:c.birth_date||null,job_title:c.job_title||null,preferred_lang:c.preferred_lang,full_name:oe};f&&(P.avatar_url=f);let{error:W}=await window.sb.from("profiles").update(P).eq("id",d);if(W)throw W;if(c.preferred_lang&&c.preferred_lang!==R){if(window.CM_I18N&&window.CM_I18N.setLang)try{window.CM_I18N.setLang(c.preferred_lang)}catch{}try{localStorage.setItem("cm_lang",c.preferred_lang)}catch{}j(c.preferred_lang),q(!0)}let D={...s||{},...P};f&&(D.avatar_url=f);try{window.__cm_profile={...window.__cm_profile||{},...D}}catch{}l&&l(D),m(T=>({...T||{},avatar_url:f})),v(null),r(null);try{document.dispatchEvent(new CustomEvent("cm:profileupdated",{detail:{profile:D}}))}catch{}y("saved"),setTimeout(()=>y("idle"),2e3)}catch(d){F(d&&d.message||t("settings.profile.save_error","Couldn't save your profile.")),y("idle")}}let S=e=>_(n=>({...n,...e})),$=(e,n)=>S({notif:{...i.notif,[e]:n}}),ee=window.CM_I18N&&window.CM_I18N.langs||["en","es","pt"],te=window.CM_I18N&&window.CM_I18N.name||{en:"English",es:"Espa\xF1ol",pt:"Portugu\xEAs"},se=e=>{window.CM_I18N&&window.CM_I18N.setLang(e),j(e),q(!0)},ae=async()=>{try{localStorage.removeItem("cm_lang")}catch{}try{if(window.sb&&(s!=null&&s.id)){let{data:e}=await window.sb.from("profiles").select("settings").eq("id",s.id).single(),n={...(e==null?void 0:e.settings)||{}};delete n.language,await window.sb.from("profiles").update({settings:n}).eq("id",s.id)}}catch{}window.location.reload()},ne=e=>e==="dark"?"#0A0A0A":e==="hybrid"?"linear-gradient(90deg,#0E1116 0%,#0E1116 30%,#FBFBFA 30%,#FBFBFA 100%)":"#FBFBFA",H=e=>e==="dark"?"rgba(255,255,255,0.10)":"#E5E7EB",ie=Object.entries(B[i.theme]),b=({label:e,children:n,hint:d})=>React.createElement("div",{className:"sd-section"},React.createElement("div",{className:"sd-section-h"},React.createElement("div",{className:"sd-section-l"},e),d?React.createElement("div",{className:"sd-section-hint"},d):null),React.createElement("div",{className:"sd-section-body"},n)),be=({label:e,sub:n,children:d})=>React.createElement("div",{className:"sd-row"},React.createElement("div",{className:"sd-row-l"},React.createElement("div",{className:"sd-row-label"},e),n?React.createElement("div",{className:"sd-row-sub"},n):null),React.createElement("div",{className:"sd-row-c"},d));return React.createElement(React.Fragment,null,React.createElement("style",null,fe),React.createElement("div",{className:`sd-overlay ${a?"is-open":""}`,onClick:o}),React.createElement("aside",{className:`sd-drawer ${a?"is-open":""}`,role:"dialog","aria-label":t("settings.title","Settings")},React.createElement("header",{className:"sd-head"},React.createElement("div",{className:"sd-head-l"},React.createElement("i",{className:"ti ti-settings"}),React.createElement("div",null,React.createElement("div",{className:"sd-title"},t("settings.title","Settings")),React.createElement("div",{className:"sd-sub"},t("settings.subtitle","Appearance \xB7 workspace \xB7 account")))),React.createElement("button",{className:"sd-x",onClick:o,"aria-label":t("settings.close","Close")},React.createElement("i",{className:"ti ti-x"}))),React.createElement("nav",{className:"sd-tabs"},[{id:"appearance",icon:"ti-palette",label:"Appearance"},{id:"notifications",icon:"ti-bell",label:"Notifications"},{id:"account",icon:"ti-shield-lock",label:"Account"},{id:"billing",icon:"ti-credit-card",label:"Billing"}].map(({id:e,icon:n,label:d})=>React.createElement("button",{key:e,className:`sd-tab ${x===e?"is-on":""}`,onClick:()=>I(e)},React.createElement("i",{className:`ti ${n}`}),t("settings.tab."+e,d)))),React.createElement("div",{className:"sd-body"},x==="appearance"&&React.createElement(React.Fragment,null,React.createElement(b,{label:t("settings.theme","Theme"),hint:t("settings.theme.hint","How the chrome looks across the app.")},React.createElement("div",{className:"sd-tiles"},["light","dark","hybrid"].map(e=>React.createElement("button",{key:e,className:`sd-tile ${i.theme===e?"is-on":""}`,onClick:()=>S({theme:e,accent:B[e][i.accent]?i.accent:"green"})},React.createElement("div",{className:"sd-tile-pv",style:{background:ne(e),borderColor:H(e)}},React.createElement("div",{className:"sd-tile-pv-bar",style:{background:e==="dark"?"rgba(255,255,255,0.08)":e==="hybrid"?"rgba(255,255,255,0.06)":"#EFEFED"}}),React.createElement("div",{className:"sd-tile-pv-c",style:{background:e==="dark"?"#161616":"#fff",borderColor:H(e)}})),React.createElement("div",{className:"sd-tile-label"},React.createElement("span",null,t("settings.theme_"+e,e==="light"?"Light":e==="dark"?"Dark":"Hybrid")),i.theme===e?React.createElement("i",{className:"ti ti-check"}):null))))),React.createElement(b,{label:t("settings.accent","Accent"),hint:t("settings.accent.hint","Used for primary buttons, active nav, and focus rings.")},React.createElement("div",{className:"sd-swatches"},ie.map(([e,n])=>React.createElement("button",{key:e,className:`sd-swatch ${i.accent===e?"is-on":""}`,onClick:()=>S({accent:e}),title:e},React.createElement("span",{className:"sd-swatch-hue",style:{background:n.hue}}),React.createElement("span",{className:"sd-swatch-name"},e))))),i.theme!=="light"?React.createElement(b,{label:t("settings.sidebar_tone","Sidebar tone")},React.createElement("div",{className:"sd-chips"},[{v:"default",l:"Default"},{v:"ink",l:"Ink"},{v:"slate",l:"Slate"},{v:"forest",l:"Forest"},{v:"zinc",l:"Zinc"}].map(e=>React.createElement("button",{key:e.v,className:`sd-chip ${i.sidebarHue===e.v?"is-on":""}`,onClick:()=>S({sidebarHue:e.v})},t("settings.tone_"+e.v,e.l))))):null,React.createElement(b,{label:t("settings.density","Density"),hint:t("settings.density.hint","Affects vertical padding inside cards & tables.")},React.createElement("div",{className:"sd-chips"},[{v:"compact",l:"Compact",k:"compact"},{v:"balanced",l:"Balanced",k:"balanced"},{v:"comfortable",l:"Comfy",k:"comfy"}].map(e=>React.createElement("button",{key:e.v,className:`sd-chip ${i.density===e.v?"is-on":""}`,onClick:()=>S({density:e.v})},t("settings.density_"+e.k,e.l))))),React.createElement(b,{label:t("settings.corners","Corners")},React.createElement("div",{className:"sd-chips"},[{v:"tight",l:"Tight"},{v:"regular",l:"Regular"},{v:"soft",l:"Soft"}].map(e=>React.createElement("button",{key:e.v,className:`sd-chip ${i.radius===e.v?"is-on":""}`,onClick:()=>S({radius:e.v})},t("settings.corners_"+e.v,e.l))))),React.createElement(b,{label:t("settings.language","Language"),hint:t("settings.language.hint","Choose the language for the whole app.")},React.createElement("div",{className:"sd-chips"},React.createElement("button",{className:`sd-chip ${U?"":"is-on"}`,onClick:ae},t("settings.language.auto","Auto (detect)")),ee.map(e=>React.createElement("button",{key:e,className:`sd-chip ${U&&R===e?"is-on":""}`,onClick:()=>se(e)},te[e]||e.toUpperCase())))),React.createElement(b,{label:t("settings.reset","Reset")},A?React.createElement("div",{className:"sd-reset-confirm"},React.createElement("span",null,t("settings.reset_confirm","Reset all appearance settings?")),React.createElement("button",{className:"sd-reset-yes",onClick:()=>{localStorage.removeItem(z);let e=M();_(e),C(!1)}},React.createElement("i",{className:"ti ti-check"}),t("settings.reset_yes","Yes, reset")),React.createElement("button",{className:"sd-reset-no",onClick:()=>C(!1)},t("settings.cancel","Cancel"))):React.createElement("button",{className:"sd-reset",onClick:()=>C(!0)},React.createElement("i",{className:"ti ti-rotate"}),t("settings.reset_defaults","Reset to workspace defaults")))),x==="notifications"&&React.createElement(React.Fragment,null,React.createElement(b,{label:t("settings.inapp_alerts","In-app alerts"),hint:t("settings.inapp_alerts.hint","Shown as badges and banners inside the app.")},[{key:"alertInjury",k:"injury",label:"Injury reported",sub:"Badge on the Treatments nav item"},{key:"alertTask",k:"task",label:"Task assigned to me",sub:"Badge on the Tasks nav item"},{key:"alertSession",k:"session",label:"Session published",sub:"Shown in Hub activity feed"}].map(({key:e,k:n,label:d,sub:f})=>React.createElement("div",{key:e,className:"sd-toggle-row"},React.createElement("div",{className:"sd-row-l"},React.createElement("div",{className:"sd-row-label"},t("settings.alert_"+n,d)),React.createElement("div",{className:"sd-row-sub"},t("settings.alert_"+n+".sub",f))),React.createElement("button",{role:"switch","aria-checked":!!(i.notif&&i.notif[e]),className:`sd-toggle ${i.notif&&i.notif[e]?"is-on":""}`,onClick:()=>$(e,!(i.notif&&i.notif[e]))},React.createElement("span",{className:"sd-toggle-thumb"}))))),React.createElement(b,{label:t("settings.email_digest","Email digest"),hint:t("settings.email_digest.hint","Requires email delivery to be configured by the workspace admin.")},[{key:"emailWeekly",k:"weekly",label:"Weekly summary",sub:"Sent every Monday morning"},{key:"emailInjury",k:"injury",label:"Injury alerts",sub:"Immediate \u2014 for medical staff"}].map(({key:e,k:n,label:d,sub:f})=>React.createElement("div",{key:e,className:"sd-toggle-row"},React.createElement("div",{className:"sd-row-l"},React.createElement("div",{className:"sd-row-label"},t("settings.email_"+n,d)),React.createElement("div",{className:"sd-row-sub"},t("settings.email_"+n+".sub",f))),React.createElement("button",{role:"switch","aria-checked":!!(i.notif&&i.notif[e]),className:`sd-toggle ${i.notif&&i.notif[e]?"is-on":""}`,onClick:()=>$(e,!(i.notif&&i.notif[e]))},React.createElement("span",{className:"sd-toggle-thumb"})))),React.createElement("div",{className:"sd-note"},React.createElement("i",{className:"ti ti-info-circle"}),t("settings.email_note","Email delivery is not yet configured for this workspace. Preferences are saved for when it is.")))),x==="account"&&React.createElement(React.Fragment,null,React.createElement(b,{label:t("settings.profile.title","My profile")},c?React.createElement("div",{className:"sd-pf"},React.createElement("div",{className:"sd-pf-photo"},React.createElement("div",{className:"sd-pf-ava"},w||window.cmAvatarUrl&&window.cmAvatarUrl(c)?React.createElement("img",{src:w||window.cmAvatarUrl(c),alt:""}):React.createElement("span",null,window.cmInitials?window.cmInitials(((c.first_name||"")+" "+(c.last_name||"")).trim()||s&&s.email||"?"):"?")),React.createElement("label",{className:"sd-pf-photobtn"},React.createElement("i",{className:"ti ti-camera"}),t("settings.profile.change_photo","Change photo"),React.createElement("input",{type:"file",accept:"image/*",onChange:Z,style:{display:"none"}}))),React.createElement("div",{className:"sd-pf-grid"},React.createElement("label",{className:"sd-pf-f"},React.createElement("span",null,t("settings.profile.first_name","First name")),React.createElement("input",{value:c.first_name,onChange:e=>E("first_name",e.target.value)})),React.createElement("label",{className:"sd-pf-f"},React.createElement("span",null,t("settings.profile.last_name","Last name")),React.createElement("input",{value:c.last_name,onChange:e=>E("last_name",e.target.value)})),React.createElement("label",{className:"sd-pf-f"},React.createElement("span",null,t("settings.profile.phone","Phone")),React.createElement("input",{type:"tel",value:c.phone,onChange:e=>E("phone",e.target.value)})),React.createElement("label",{className:"sd-pf-f"},React.createElement("span",null,t("settings.profile.birth_date","Birth date")),React.createElement("input",{type:"date",value:c.birth_date||"",onChange:e=>E("birth_date",e.target.value)})),React.createElement("label",{className:"sd-pf-f sd-pf-wide"},React.createElement("span",null,t("settings.profile.job_title","Job title")),React.createElement("input",{value:c.job_title,onChange:e=>E("job_title",e.target.value)})),React.createElement("label",{className:"sd-pf-f sd-pf-wide"},React.createElement("span",null,t("settings.profile.language","Language")),React.createElement("select",{value:c.preferred_lang,onChange:e=>E("preferred_lang",e.target.value)},React.createElement("option",{value:"en"},"English"),React.createElement("option",{value:"es"},"Espa\xF1ol"),React.createElement("option",{value:"pt"},"Portugu\xEAs")))),k?React.createElement("div",{className:"sd-pf-err"},k):null,React.createElement("div",{className:"sd-pf-actions"},React.createElement("button",{className:"sd-pf-save",disabled:h==="saving",onClick:Q},h==="saving"?t("settings.profile.saving","Saving\u2026"):h==="saved"?t("settings.profile.saved","Saved"):t("settings.profile.save","Save")))):React.createElement("div",{className:"sd-row-sub"},t("settings.profile.loading","Loading\u2026"))),React.createElement(b,{label:t("settings.signed_in_as","Signed in as")},React.createElement("div",{className:"sd-account-row"},React.createElement("div",{className:"sd-account-avatar"},s?(s.full_name||s.email||"?")[0].toUpperCase():"?"),React.createElement("div",null,(s==null?void 0:s.full_name)&&React.createElement("div",{className:"sd-row-label"},s.full_name),React.createElement("div",{className:"sd-row-sub"},(s==null?void 0:s.email)||"\u2014"),React.createElement("div",{className:"sd-row-sub",style:{marginTop:2}},(s==null?void 0:s.role)||"")))),React.createElement(b,{label:t("settings.session","Session")},React.createElement("button",{className:"sd-reset sd-signout",onClick:async()=>{await window.sb.auth.signOut(),window.location.href="Login.html"}},React.createElement("i",{className:"ti ti-logout"}),t("settings.sign_out","Sign out")))),x==="billing"&&React.createElement(ge,null)),React.createElement("footer",{className:"sd-foot"},React.createElement("span",null,React.createElement("i",{className:"ti ti-cloud"}),t("settings.saved_footer","Saved to cloud & this device")))))},fe=`
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
`;window.SettingsDrawer=V;window.openCMSettings=null;window.initCMSettings=M;function G(a){let o=document.querySelector('[title="Notifications"],[aria-label="Notifications"]');if(!o)return;let s=o.querySelector(".cm-bell-badge");if(a<=0){s&&s.remove();return}s||(s=document.createElement("span"),s.className="cm-bell-badge",Object.assign(s.style,{position:"absolute",top:"3px",right:"3px",width:"7px",height:"7px",borderRadius:"50%",background:"var(--cm-danger,#DC2626)",pointerEvents:"none"}),o.style.position="relative",o.appendChild(s))}function ue(){let[a,o]=React.useState(!1),[s,u]=React.useState(null),[l,g]=React.useState(null),[N,i]=React.useState(null),[_,x]=React.useState([]),I=React.useRef(null),A=React.useRef(null);React.useEffect(()=>{if(window.sb)return window.sb.auth.getSession().then(({data:m})=>{var v,w;let p=(w=(v=m==null?void 0:m.session)==null?void 0:v.user)==null?void 0:w.id;p&&(g(p),window.CM_I18N&&window.CM_I18N.setCloudSaver(async r=>{let{data:h}=await window.sb.from("profiles").select("settings").eq("id",p).single(),y={...(h==null?void 0:h.settings)||{},language:r};await window.sb.from("profiles").update({settings:y}).eq("id",p)}),window.getClub&&window.getClub().then(r=>{r&&window.CM_I18N&&window.CM_I18N.setClubCountry(r.country)}),window.sb.from("profiles").select("settings, notification_settings").eq("id",p).single().then(({data:r})=>{if(!r)return;window.CM_I18N&&r.settings&&r.settings.language&&window.CM_I18N.setUserPref(r.settings.language);let h={...r.settings||{},notif:r.notification_settings||{}};(Object.keys(r.settings||{}).length>0||Object.keys(r.notification_settings||{}).length>0)&&i(h)}),window.sb.from("notifications").select("id",{count:"exact",head:!0}).eq("user_id",p).eq("read",!1).then(({count:r})=>{r>0&&G(r)}),A.current=window.sb.channel("cm-notif-"+p).on("postgres_changes",{event:"INSERT",schema:"public",table:"notifications",filter:`user_id=eq.${p}`},r=>{let h=r.new,y=Date.now()+Math.random();x(R=>[...R,{...h,_popupId:y}]);let k=document.querySelector('[title="Notifications"],[aria-label="Notifications"]'),F=k?parseInt(k.dataset.unread||"0",10):0;k&&(k.dataset.unread=F+1),G(F+1)}).subscribe())}),()=>{A.current&&window.sb.removeChannel(A.current)}},[]),React.useEffect(()=>(window.openCMSettings=()=>o(!0),()=>{window.openCMSettings=null}),[]),React.useEffect(()=>{!a||s||window.getProfile&&window.getProfile().then(m=>u(m))},[a]);function C(m){!l||!window.sb||(clearTimeout(I.current),I.current=setTimeout(async()=>{let{notif:p,...v}=m,w;try{w=localStorage.getItem("cm_lang")}catch{}window.CM_I18N&&w?v.language=window.CM_I18N.current:delete v.language;let{error:r}=await window.sb.from("profiles").update({settings:v,notification_settings:p||{}}).eq("id",l);r&&console.warn("[settings] cloud save failed:",r.message)},800))}function c(m){x(p=>p.filter(v=>v._popupId!==m))}return React.createElement(React.Fragment,null,React.createElement(V,{open:a,onClose:()=>o(!1),profile:s,userId:l,setProfile:u,supabaseSettings:N,onSettingsChange:C}),React.createElement("div",{className:"cm-notif-stack"},_.map(m=>React.createElement(pe,{key:m._popupId,notif:m,onDismiss:()=>c(m._popupId)}))))}(function(){M();let o=document.getElementById("settings-host")||(()=>{let s=document.createElement("div");return s.id="settings-host",document.body.appendChild(s),s})();ReactDOM.createRoot(o).render(React.createElement(ue,null)),document.addEventListener("click",s=>{s.target.closest("[data-open-settings]")&&(s.preventDefault(),window.openCMSettings&&window.openCMSettings())})})();})();
