import{j as t}from"./jsx-runtime-u17CrQMm.js";import{r as p}from"./iframe-BA9U4A2Q.js";import{B as y}from"./badge-BuZNKfRS.js";import{B as w,a as b,b as f,c as B}from"./button-2keny9to.js";import{S as k}from"./overflow-surface-Cav6wYq5.js";import{P as I}from"./profile-image-DCTEHzfl.js";import{F as j}from"./surface-CTeFSOED.js";import{T as N}from"./tooltip-CiUFOqZ4.js";import{c as T,a as i}from"./utils-VtdL_sx5.js";import{s as R}from"./status-meta-Nw4SQ9xE.js";import{S as h}from"./sparkles-D7ne4up4.js";import{M as D}from"./message-square-CmkkqTCj.js";import"./preload-helper-PPVm8Dsz.js";import"./inline-affordance-BLl3bR6J.js";import"./useBaseUiId-7OVNNPuG.js";import"./index-DGd7USjR.js";import"./index-vzGptKfy.js";import"./popupStateMapping-CkY0FYKf.js";import"./owner-CK4ouegI.js";import"./stateAttributesMapping-BTajHoEL.js";import"./index-w1ompkCd.js";import"./getDisabledMountTransitionStyles-DYKgFN9P.js";import"./floating-ui.utils-BMThB9Km.js";import"./DirectionContext-5qgCtuu1.js";const A=[["path",{d:"M14 17H5",key:"gfn3mx"}],["path",{d:"M19 7h-9",key:"6i9tg"}],["circle",{cx:"17",cy:"17",r:"3",key:"18b49y"}],["circle",{cx:"7",cy:"7",r:"3",key:"dfmy0x"}]],C=T("settings-2",A),q=e=>e==="running"||e==="starting"||e==="error"||e==="stopped",v=e=>e.split(/[\\/]+/).filter(Boolean).at(-1)??e,P=e=>{let n=0;for(let s=0;s<e.length;s+=1)n=(n*31+e.charCodeAt(s))%360;return n},W=e=>({label:v(e).slice(0,1)||"W",hue:P(e)}),g=({label:e})=>t.jsx("div",{className:"px-1",children:t.jsx("p",{className:"text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase",children:e})}),_=({avatar:e})=>t.jsx("span",{className:"inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-semibold",style:{backgroundColor:`oklch(0.85 0.09 ${e.hue})`,color:`oklch(0.32 0.08 ${e.hue})`},children:e.label.toUpperCase()}),$=({item:e,compact:n})=>{const s=e.icon;return t.jsxs(w,{type:"button",variant:e.active?"secondary":"ghost",onClick:e.onSelect,className:i("w-full justify-start rounded-xl",e.active?"bg-teal-50 text-teal-900 ring-1 ring-teal-200":"text-slate-700",n?"min-h-10":"min-h-11"),"aria-current":e.active?"page":void 0,children:[t.jsx(b,{children:t.jsx(s,{className:"h-4 w-4"})}),t.jsx(f,{children:e.label}),e.badgeCount&&e.badgeCount>0?t.jsx(B,{children:t.jsx("span",{className:"inline-flex min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-semibold text-white",children:e.badgeCount})}):null]})},E=({item:e})=>{const n=W(e.workspacePath),s=R(q(e.status)?e.status:"stopped"),o=[e.name,e.sessionId,e.workspacePath].filter(Boolean).join(" · ");return t.jsx(N,{content:t.jsxs("div",{className:"max-w-[22rem] space-y-1",children:[t.jsx("p",{className:"font-medium text-slate-900",children:e.name}),t.jsx("p",{className:"break-all text-slate-600",children:e.sessionId}),t.jsx("p",{className:"break-all text-slate-600",children:e.workspacePath})]}),children:t.jsx("button",{type:"button",onClick:e.onSelect,"aria-label":o,title:o,className:i("w-full rounded-xl px-2 py-2 text-left transition-colors",e.active?"bg-teal-50 text-slate-900 ring-1 ring-teal-200":"text-slate-700 hover:bg-slate-100"),children:t.jsxs("div",{className:"flex items-start gap-2.5",children:[e.iconUrl?t.jsx(I,{src:e.iconUrl,label:e.name,alt:e.name,className:"h-7 w-7 shrink-0 rounded-lg"}):t.jsx(_,{avatar:n}),t.jsxs("div",{className:"min-w-0 flex-1",children:[t.jsxs("div",{className:"flex items-center gap-2",children:[t.jsx("span",{className:"truncate text-sm font-medium text-slate-900",children:e.name}),e.unreadCount>0?t.jsx(y,{variant:"warning",children:e.unreadCount}):null]}),t.jsxs("div",{className:"mt-1 flex items-center gap-1.5",children:[t.jsx(D,{className:"h-3 w-3 text-slate-400"}),t.jsx("span",{className:"truncate text-[11px] text-slate-500",children:e.sessionId})]}),t.jsxs("div",{className:"mt-1 flex items-center gap-1.5",children:[t.jsx("span",{className:i("inline-flex h-2 w-2 rounded-full",s.variant==="success"?"bg-emerald-500":s.variant==="warning"?"bg-amber-500":s.variant==="destructive"?"bg-rose-500":"bg-slate-400")}),t.jsxs("span",{className:"truncate text-[11px] text-slate-500",children:[v(e.workspacePath)," · ",s.label]})]})]})]})})})},L=({compact:e})=>t.jsx("div",{className:i("rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-[11px] text-slate-500",e?"":"min-h-20"),children:"No running sessions."}),Q=()=>t.jsx("div",{className:"px-1",children:t.jsxs("div",{className:"inline-flex items-center gap-2",children:[t.jsx("span",{className:"inline-flex h-8 w-8 items-center justify-center rounded-xl bg-teal-700 text-white",children:t.jsx(h,{className:"h-4 w-4"})}),t.jsxs("div",{children:[t.jsx("p",{className:"font-nav text-sm font-semibold tracking-tight text-slate-900",children:"agenter"}),t.jsx("p",{className:"text-[11px] text-slate-500",children:"Workspace-first shell"})]})]})}),l=({primaryItems:e,runningSessions:n,compact:s=!1})=>t.jsxs("div",{className:i("grid h-full gap-4",s?"grid-rows-[auto_minmax(0,1fr)]":"grid-rows-[auto_auto_minmax(0,1fr)] px-3 py-3"),children:[s?null:t.jsx(Q,{}),t.jsxs("section",{className:"space-y-2",children:[t.jsx(g,{label:"Navigate"}),t.jsx("div",{className:"space-y-1",children:e.map(o=>t.jsx($,{item:o,compact:s},o.key))})]}),t.jsxs("section",{className:"grid grid-rows-[auto_minmax(0,1fr)] gap-2",children:[t.jsx(g,{label:"Running Sessions"}),t.jsx(k,{"data-testid":"sidebar-running-sessions-viewport",className:"h-full space-y-1 pr-1",children:n.length===0?t.jsx(L,{compact:s}):n.map(o=>t.jsx(E,{item:o},o.sessionId))})]})]}),d=e=>[{key:"quickstart",label:"Quick Start",icon:h,active:e.quickStartActive,onSelect:e.onSelectQuickStart},{key:"workspaces",label:"Workspaces",icon:j,active:e.workspacesActive,badgeCount:e.unreadWorkspaces,onSelect:e.onSelectWorkspaces},{key:"settings",label:"Global Settings",icon:C,active:e.settingsActive,onSelect:e.onSelectSettings}];l.__docgenInfo={description:"",methods:[],displayName:"SidebarNavContent",props:{primaryItems:{required:!0,tsType:{name:"Array",elements:[{name:"PrimaryNavItem"}],raw:"PrimaryNavItem[]"},description:""},runningSessions:{required:!0,tsType:{name:"Array",elements:[{name:"RunningSessionNavItem"}],raw:"RunningSessionNavItem[]"},description:""},compact:{required:!1,tsType:{name:"boolean"},description:"",defaultValue:{value:"false",computed:!1}},className:{required:!1,tsType:{name:"string"},description:""}}};const{expect:a,userEvent:M,within:S}=__STORYBOOK_MODULE_TEST__,U=`data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" rx="18" fill="#155e75"/></svg>')}`,m=[{sessionId:"session-running-1",name:"Fix layout drift",workspacePath:"/repo/agenter",iconUrl:U,active:!0,unreadCount:1,status:"running",onSelect:()=>{}},{sessionId:"session-running-2",name:"Review bugfix",workspacePath:"/repo/openspecui",active:!1,unreadCount:3,status:"starting",onSelect:()=>{}}],x=Array.from({length:24},(e,n)=>({sessionId:`session-running-${n+1}`,name:`Running task ${n+1}`,workspacePath:`/repo/group-${Math.floor(n/6)+1}/workspace-${n+1}`,active:n===0,unreadCount:n%4,status:n%3===0?"running":n%3===1?"starting":"error",onSelect:()=>{}})),de={title:"Features/Shell/SidebarNav",component:l,args:{compact:!0,primaryItems:d({quickStartActive:!0,workspacesActive:!1,settingsActive:!1,unreadWorkspaces:4,onSelectQuickStart:()=>{},onSelectWorkspaces:()=>{},onSelectSettings:()=>{}}),runningSessions:m},render:()=>{const[e,n]=p.useState("quickstart"),[s,o]=p.useState(m[0]?.sessionId??null);return t.jsx("div",{className:"w-[20rem] p-6",children:t.jsx(l,{compact:!0,primaryItems:d({quickStartActive:e==="quickstart",workspacesActive:e==="workspaces",settingsActive:e==="settings",unreadWorkspaces:4,onSelectQuickStart:()=>n("quickstart"),onSelectWorkspaces:()=>n("workspaces"),onSelectSettings:()=>n("settings")}),runningSessions:m.map(u=>({...u,active:u.sessionId===s,onSelect:()=>o(u.sessionId)}))})})}},r={args:{},play:async({canvasElement:e})=>{const n=S(e),s=n.getByRole("button",{name:/Review bugfix .*session-running-2 .*openspecui/i});await a(n.getByText("Navigate")).toBeInTheDocument(),await a(n.getByRole("button",{name:/^Quick Start$/})).toBeInTheDocument(),await a(n.getByRole("button",{name:/^Workspaces\b/i})).toBeInTheDocument(),await a(n.getByRole("button",{name:/^Global Settings$/})).toBeInTheDocument(),await a(n.getByText("Running Sessions")).toBeInTheDocument(),await a(n.getByText("session-running-1")).toBeInTheDocument(),await a(n.getByText("session-running-2")).toBeInTheDocument(),await a(n.getByRole("img",{name:"Fix layout drift"})).toBeInTheDocument(),await a(n.queryByRole("button",{name:"Chat"})).not.toBeInTheDocument(),await a(n.queryByRole("button",{name:"Devtools"})).not.toBeInTheDocument(),await a(n.queryByRole("button",{name:/^Settings$/})).not.toBeInTheDocument(),await a(n.queryByRole("button",{name:"Start session"})).not.toBeInTheDocument(),await a(n.queryByRole("button",{name:"Stop session"})).not.toBeInTheDocument(),await M.click(s),await a(s).toHaveClass("bg-teal-50")}},c={render:()=>{const[e,n]=p.useState(x[0]?.sessionId??null);return t.jsx("div",{className:"h-[480px] w-[20rem] p-6",children:t.jsx(l,{compact:!1,primaryItems:d({quickStartActive:!1,workspacesActive:!0,settingsActive:!1,unreadWorkspaces:9,onSelectQuickStart:()=>{},onSelectWorkspaces:()=>{},onSelectSettings:()=>{}}),runningSessions:x.map(s=>({...s,active:s.sessionId===e,onSelect:()=>n(s.sessionId)}))})})},play:async({canvasElement:e})=>{const n=S(e),s=n.getByTestId("sidebar-running-sessions-viewport");await a(n.getByText("Running Sessions")).toBeInTheDocument(),await a(["auto","scroll"]).toContain(getComputedStyle(s).overflowY)}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {},
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const sessionButton = canvas.getByRole("button", {
      name: /Review bugfix .*session-running-2 .*openspecui/i
    });
    await expect(canvas.getByText("Navigate")).toBeInTheDocument();
    await expect(canvas.getByRole("button", {
      name: /^Quick Start$/
    })).toBeInTheDocument();
    await expect(canvas.getByRole("button", {
      name: /^Workspaces\\b/i
    })).toBeInTheDocument();
    await expect(canvas.getByRole("button", {
      name: /^Global Settings$/
    })).toBeInTheDocument();
    await expect(canvas.getByText("Running Sessions")).toBeInTheDocument();
    await expect(canvas.getByText("session-running-1")).toBeInTheDocument();
    await expect(canvas.getByText("session-running-2")).toBeInTheDocument();
    await expect(canvas.getByRole("img", {
      name: "Fix layout drift"
    })).toBeInTheDocument();
    await expect(canvas.queryByRole("button", {
      name: "Chat"
    })).not.toBeInTheDocument();
    await expect(canvas.queryByRole("button", {
      name: "Devtools"
    })).not.toBeInTheDocument();
    await expect(canvas.queryByRole("button", {
      name: /^Settings$/
    })).not.toBeInTheDocument();
    await expect(canvas.queryByRole("button", {
      name: "Start session"
    })).not.toBeInTheDocument();
    await expect(canvas.queryByRole("button", {
      name: "Stop session"
    })).not.toBeInTheDocument();
    await userEvent.click(sessionButton);
    await expect(sessionButton).toHaveClass("bg-teal-50");
  }
}`,...r.parameters?.docs?.source}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  render: () => {
    const [activeSessionId, setActiveSessionId] = useState(longRunningSessions[0]?.sessionId ?? null);
    return <div className="h-[480px] w-[20rem] p-6">
        <SidebarNavContent compact={false} primaryItems={defaultPrimaryNavItems({
        quickStartActive: false,
        workspacesActive: true,
        settingsActive: false,
        unreadWorkspaces: 9,
        onSelectQuickStart: () => {},
        onSelectWorkspaces: () => {},
        onSelectSettings: () => {}
      })} runningSessions={longRunningSessions.map(item => ({
        ...item,
        active: item.sessionId === activeSessionId,
        onSelect: () => setActiveSessionId(item.sessionId)
      }))} />
      </div>;
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const viewport = canvas.getByTestId("sidebar-running-sessions-viewport");
    await expect(canvas.getByText("Running Sessions")).toBeInTheDocument();
    await expect(["auto", "scroll"]).toContain(getComputedStyle(viewport).overflowY);
  }
}`,...c.parameters?.docs?.source}}};const ge=["SidebarShowsPrimaryAndRunningSessions","SidebarLongRunningSessionListKeepsViewport"];export{c as SidebarLongRunningSessionListKeepsViewport,r as SidebarShowsPrimaryAndRunningSessions,ge as __namedExportsOrder,de as default};
