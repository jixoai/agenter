import{j as t}from"./jsx-runtime-u17CrQMm.js";import{r}from"./iframe-BA9U4A2Q.js";import{a as E,b as O,f as w,D as B}from"./dropdown-menu-B3aKSIUC.js";import{P as H}from"./profile-image-DCTEHzfl.js";import{c as M,a as l}from"./utils-VtdL_sx5.js";import{M as V}from"./tool-structured-view-Be99XAPJ.js";import{A as U,r as Y}from"./AssistantMarkdown-BRd3mpcZ.js";import{C as $}from"./ChatAttachmentStrip-CNmJgMJl.js";import{E as X}from"./ellipsis-D8eZY63e.js";import{T as F}from"./triangle-alert-DpleOF06.js";import{L as G}from"./loader-circle-BDXf0OYg.js";import{S as z}from"./sparkles-D7ne4up4.js";const J=[["rect",{width:"14",height:"14",x:"8",y:"8",rx:"2",ry:"2",key:"17jyea"}],["path",{d:"M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2",key:"zix9uf"}]],k=M("copy",J);const K=[["path",{d:"M15 3h6v6",key:"1q9fwt"}],["path",{d:"M10 14 21 3",key:"gplh6r"}],["path",{d:"M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6",key:"a6xqqp"}]],Q=M("external-link",K),T=({message:e,presentation:n,onPreviewAttachment:o})=>{const i=e.attachments??[],u=e.content.trim().length>0;return t.jsxs("div",{className:"min-w-0 space-y-2",children:[i.length>0?t.jsx($,{attachments:i,onPreview:o}):null,u?e.role==="assistant"?t.jsx(U,{content:e.content,channel:e.channel,tool:e.tool}):t.jsx(V,{value:e.content,mode:"preview",usage:"chat",surface:n.markdownSurface,syntaxTone:n.syntaxTone,className:"text-[13px] text-current"}):null]})},N=r.memo(T,(e,n)=>e.message===n.message&&e.presentation.bubbleClassName===n.presentation.bubbleClassName&&e.presentation.markdownSurface===n.presentation.markdownSurface&&e.presentation.syntaxTone===n.presentation.syntaxTone&&e.onPreviewAttachment===n.onPreviewAttachment);N.displayName="ChatMessageBody";T.__docgenInfo={description:"",methods:[],displayName:"ChatMessageBodyComponent",props:{message:{required:!0,tsType:{name:"ProjectedConversationMessage"},description:""},presentation:{required:!0,tsType:{name:"ReturnType",elements:[{name:"resolveChatMessagePresentation"}],raw:"ReturnType<typeof resolveChatMessagePresentation>"},description:""},onPreviewAttachment:{required:!0,tsType:{name:"signature",type:"function",raw:"(assetId: string) => void",signature:{arguments:[{type:{name:"string"},name:"assetId"}],return:{name:"void"}}},description:""}}};const W=e=>e.replace(/```[^\n]*\n?/g,"").replace(/```/g,"").replace(/`([^`]+)`/g,"$1").replace(/!\[([^\]]*)\]\([^)]+\)/g,"$1").replace(/\[([^\]]+)\]\([^)]+\)/g,"$1").replace(/^>\s?/gm,"").replace(/^#{1,6}\s+/gm,"").replace(/[*_~]/g,""),j=async e=>{typeof navigator>"u"||!navigator.clipboard||await navigator.clipboard.writeText(e)},P=({message:e,onOpenDevtools:n,triggerRef:o})=>{const i=typeof e.cycleId=="number"&&Number.isFinite(e.cycleId)?e.cycleId:null,u=i!==null,y=e.role==="user"?"text-white/82 hover:bg-white/12":"text-slate-500 hover:bg-slate-100";return t.jsxs(t.Fragment,{children:[t.jsx(E,{ref:o,"aria-label":"Message actions",title:"Message actions","data-message-actions-trigger":"true",className:l("absolute top-2 right-2 h-7 w-7 rounded-full p-0 opacity-100 transition-opacity md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100",y),children:t.jsx(X,{className:"h-4 w-4"})}),t.jsxs(O,{align:"end",children:[t.jsxs(w,{onClick:()=>{j(e.content)},children:[t.jsx(k,{className:"h-4 w-4"}),"Copy Markdown"]}),t.jsxs(w,{onClick:()=>{j(W(e.content))},children:[t.jsx(k,{className:"h-4 w-4"}),"Copy Text"]}),t.jsxs(w,{disabled:!u,onClick:()=>{i!==null&&n&&n(i)},children:[t.jsx(Q,{className:"h-4 w-4"}),"View In Devtools"]})]})]})};P.__docgenInfo={description:"",methods:[],displayName:"ChatMessageActions",props:{message:{required:!0,tsType:{name:"ProjectedConversationMessage"},description:""},onOpenDevtools:{required:!1,tsType:{name:"signature",type:"function",raw:"(cycleId: number) => void",signature:{arguments:[{type:{name:"number"},name:"cycleId"}],return:{name:"void"}}},description:""},triggerRef:{required:!1,tsType:{name:"RefObject",elements:[{name:"union",raw:"HTMLButtonElement | null",elements:[{name:"HTMLButtonElement"},{name:"null"}]}],raw:"RefObject<HTMLButtonElement | null>"},description:""}}};const I="group min-w-0 w-fit max-w-[92%] md:max-w-[44rem]",C=420,q=10,R=({message:e,assistantAvatarUrl:n,assistantAvatarLabel:o="Assistant",userAvatarLabel:i="You",onPreviewAttachment:u,onOpenDevtools:y})=>{const m=r.useRef(null),c=r.useRef(null),d=r.useRef(null),p=r.useRef(0),[D,v]=r.useState(!1),x=e.role==="user"?"end":"start",f=Y({role:e.role,channel:e.channel}),s=r.useCallback(()=>{c.current!==null&&(clearTimeout(c.current),c.current=null),d.current=null,v(!1)},[]),b=r.useCallback(()=>{p.current=Date.now()+C,v(!1),m.current?.focus({preventScroll:!0}),m.current?.click()},[]);r.useEffect(()=>s,[s]);const S=r.useCallback(a=>{a.target.closest("[data-message-actions-trigger='true']")||a.pointerType!=="touch"&&a.pointerType!=="pen"||(s(),p.current=0,d.current={pointerId:a.pointerId,x:a.clientX,y:a.clientY},v(!0),c.current=setTimeout(()=>{c.current=null,d.current=null,b()},C))},[s,b]),L=r.useCallback(a=>{const g=d.current;!g||g.pointerId!==a.pointerId||(Math.abs(a.clientX-g.x)>q||Math.abs(a.clientY-g.y)>q)&&s()},[s]),h=r.useCallback(()=>{s()},[s]);return t.jsx("div",{className:l("flex w-full py-1.5",x==="end"?"justify-end":"justify-start"),"data-chat-row":"message","data-chat-align":x,"data-message-id":e.id,"data-message-role":e.role,"data-message-channel":e.channel??"","data-message-transient":e.transient?"true":"false",children:t.jsxs("div",{className:l("flex min-w-0 max-w-full items-end gap-2.5",x==="end"?"flex-row-reverse":"flex-row"),children:[t.jsx(H,{src:e.role==="assistant"?n:null,label:e.role==="assistant"?o:i,className:"h-8 w-8 shrink-0 rounded-2xl"}),t.jsxs("article",{"data-chat-bubble":"true",className:l(I,"relative min-w-0 rounded-2xl px-3 py-2.5 pr-10 text-[13px] transition-shadow",f.bubbleClassName,D?"ring-2 ring-teal-200/70":""),onClickCapture:a=>{a.target.closest("[data-message-actions-trigger='true']")||Date.now()>p.current||(p.current=0,a.preventDefault(),a.stopPropagation())},onPointerDown:S,onPointerMove:L,onPointerUp:h,onPointerCancel:h,onPointerLeave:h,onContextMenu:a=>{a.preventDefault(),s(),m.current?.focus({preventScroll:!0}),m.current?.click()},children:[t.jsx(B,{children:t.jsx(P,{message:e,onOpenDevtools:y,triggerRef:m})}),t.jsx(N,{message:e,presentation:f,onPreviewAttachment:u})]})]})})},Z=r.memo(R,(e,n)=>e.message===n.message&&e.assistantAvatarUrl===n.assistantAvatarUrl&&e.assistantAvatarLabel===n.assistantAvatarLabel&&e.userAvatarLabel===n.userAvatarLabel&&e.onPreviewAttachment===n.onPreviewAttachment&&e.onOpenDevtools===n.onOpenDevtools);Z.displayName="ChatMessageRow";const A=r.memo(({row:e})=>{const n=e.tone==="danger"?"bg-rose-50 text-rose-700 ring-1 ring-rose-200":e.tone==="active"?"bg-teal-50 text-teal-700 ring-1 ring-teal-200":"bg-slate-100 text-slate-600",o=e.tone==="danger"?t.jsx(F,{className:"h-3.5 w-3.5"}):e.tone==="active"?t.jsx(G,{className:"h-3.5 w-3.5 animate-spin"}):t.jsx(z,{className:"h-3.5 w-3.5"});return t.jsx("div",{className:"flex w-full justify-start py-1","data-chat-row":"status",children:t.jsxs("div",{className:l(I,"inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs",n),children:[o,t.jsx("span",{children:e.text})]})})});A.displayName="StatusRow";const _=r.memo(({row:e})=>t.jsx("div",{className:"flex w-full items-center justify-center py-3","data-chat-row":"time-divider",children:t.jsxs("div",{className:"flex min-w-0 items-center gap-3 text-[11px] text-slate-400",children:[t.jsx("span",{className:"h-px w-8 bg-slate-200"}),t.jsx("span",{className:l("tracking-[0.08em]",e.emphasis==="date"?"font-semibold text-slate-500 uppercase":""),children:e.label}),t.jsx("span",{className:"h-px w-8 bg-slate-200"})]})}));_.displayName="TimeDividerRow";R.__docgenInfo={description:"",methods:[],displayName:"ChatMessageRowComponent",props:{message:{required:!0,tsType:{name:"ProjectedConversationMessage"},description:""},assistantAvatarUrl:{required:!1,tsType:{name:"union",raw:"string | null",elements:[{name:"string"},{name:"null"}]},description:""},assistantAvatarLabel:{required:!1,tsType:{name:"string"},description:"",defaultValue:{value:'"Assistant"',computed:!1}},userAvatarLabel:{required:!1,tsType:{name:"string"},description:"",defaultValue:{value:'"You"',computed:!1}},onPreviewAttachment:{required:!0,tsType:{name:"signature",type:"function",raw:"(assetId: string) => void",signature:{arguments:[{type:{name:"string"},name:"assetId"}],return:{name:"void"}}},description:""},onOpenDevtools:{required:!1,tsType:{name:"signature",type:"function",raw:"(cycleId: number) => void",signature:{arguments:[{type:{name:"number"},name:"cycleId"}],return:{name:"void"}}},description:""}}};A.__docgenInfo={description:"",methods:[],displayName:"StatusRow",props:{row:{required:!0,tsType:{name:"Extract",elements:[{name:"union",raw:`| {
    key: string;
    type: "message";
    message: ProjectedConversationMessage;
  }
| {
    key: string;
    type: "status";
    cycleId: number | null;
    text: string;
    tone: "muted" | "active" | "danger";
    timestamp: number;
  }
| {
    key: string;
    type: "time-divider";
    label: string;
    timestamp: number;
    emphasis: "time" | "date";
  }`,elements:[{name:"signature",type:"object",raw:`{
  key: string;
  type: "message";
  message: ProjectedConversationMessage;
}`,signature:{properties:[{key:"key",value:{name:"string",required:!0}},{key:"type",value:{name:"literal",value:'"message"',required:!0}},{key:"message",value:{name:"ProjectedConversationMessage",required:!0}}]}},{name:"signature",type:"object",raw:`{
  key: string;
  type: "status";
  cycleId: number | null;
  text: string;
  tone: "muted" | "active" | "danger";
  timestamp: number;
}`,signature:{properties:[{key:"key",value:{name:"string",required:!0}},{key:"type",value:{name:"literal",value:'"status"',required:!0}},{key:"cycleId",value:{name:"union",raw:"number | null",elements:[{name:"number"},{name:"null"}],required:!0}},{key:"text",value:{name:"string",required:!0}},{key:"tone",value:{name:"union",raw:'"muted" | "active" | "danger"',elements:[{name:"literal",value:'"muted"'},{name:"literal",value:'"active"'},{name:"literal",value:'"danger"'}],required:!0}},{key:"timestamp",value:{name:"number",required:!0}}]}},{name:"signature",type:"object",raw:`{
  key: string;
  type: "time-divider";
  label: string;
  timestamp: number;
  emphasis: "time" | "date";
}`,signature:{properties:[{key:"key",value:{name:"string",required:!0}},{key:"type",value:{name:"literal",value:'"time-divider"',required:!0}},{key:"label",value:{name:"string",required:!0}},{key:"timestamp",value:{name:"number",required:!0}},{key:"emphasis",value:{name:"union",raw:'"time" | "date"',elements:[{name:"literal",value:'"time"'},{name:"literal",value:'"date"'}],required:!0}}]}}]},{name:"signature",type:"object",raw:'{ type: "status" }',signature:{properties:[{key:"type",value:{name:"literal",value:'"status"',required:!0}}]}}],raw:'Extract<ConversationRow, { type: "status" }>'},description:""}}};_.__docgenInfo={description:"",methods:[],displayName:"TimeDividerRow",props:{row:{required:!0,tsType:{name:"Extract",elements:[{name:"union",raw:`| {
    key: string;
    type: "message";
    message: ProjectedConversationMessage;
  }
| {
    key: string;
    type: "status";
    cycleId: number | null;
    text: string;
    tone: "muted" | "active" | "danger";
    timestamp: number;
  }
| {
    key: string;
    type: "time-divider";
    label: string;
    timestamp: number;
    emphasis: "time" | "date";
  }`,elements:[{name:"signature",type:"object",raw:`{
  key: string;
  type: "message";
  message: ProjectedConversationMessage;
}`,signature:{properties:[{key:"key",value:{name:"string",required:!0}},{key:"type",value:{name:"literal",value:'"message"',required:!0}},{key:"message",value:{name:"ProjectedConversationMessage",required:!0}}]}},{name:"signature",type:"object",raw:`{
  key: string;
  type: "status";
  cycleId: number | null;
  text: string;
  tone: "muted" | "active" | "danger";
  timestamp: number;
}`,signature:{properties:[{key:"key",value:{name:"string",required:!0}},{key:"type",value:{name:"literal",value:'"status"',required:!0}},{key:"cycleId",value:{name:"union",raw:"number | null",elements:[{name:"number"},{name:"null"}],required:!0}},{key:"text",value:{name:"string",required:!0}},{key:"tone",value:{name:"union",raw:'"muted" | "active" | "danger"',elements:[{name:"literal",value:'"muted"'},{name:"literal",value:'"active"'},{name:"literal",value:'"danger"'}],required:!0}},{key:"timestamp",value:{name:"number",required:!0}}]}},{name:"signature",type:"object",raw:`{
  key: string;
  type: "time-divider";
  label: string;
  timestamp: number;
  emphasis: "time" | "date";
}`,signature:{properties:[{key:"key",value:{name:"string",required:!0}},{key:"type",value:{name:"literal",value:'"time-divider"',required:!0}},{key:"label",value:{name:"string",required:!0}},{key:"timestamp",value:{name:"number",required:!0}},{key:"emphasis",value:{name:"union",raw:'"time" | "date"',elements:[{name:"literal",value:'"time"'},{name:"literal",value:'"date"'}],required:!0}}]}}]},{name:"signature",type:"object",raw:'{ type: "time-divider" }',signature:{properties:[{key:"type",value:{name:"literal",value:'"time-divider"',required:!0}}]}}],raw:'Extract<ConversationRow, { type: "time-divider" }>'},description:""}}};export{Z as C,A as S,_ as T};
