import{j as e}from"./jsx-runtime-u17CrQMm.js";import{r as c}from"./iframe-BA9U4A2Q.js";import{A as W,r as K}from"./async-surface-CwnBr4KY.js";import{B as S}from"./badge-BuZNKfRS.js";import{B}from"./button-2keny9to.js";import{I as T}from"./input-C9VRqnf1.js";import{S as Y}from"./overflow-surface-Cav6wYq5.js";import{S as $}from"./sheet-ZVklUhfZ.js";import{S as y}from"./skeleton-D3ZGd0h7.js";import{T as F}from"./tabs-BaIc53z-.js";import{T as _}from"./textarea-DbU48OXm.js";import{a as G}from"./utils-VtdL_sx5.js";import"./preload-helper-PPVm8Dsz.js";import"./loader-circle-BDXf0OYg.js";import"./inline-affordance-BLl3bR6J.js";import"./x-DMkXTevi.js";import"./DialogTitle-sL7T0N-8.js";import"./useBaseUiId-7OVNNPuG.js";import"./popupStateMapping-CkY0FYKf.js";import"./index-DGd7USjR.js";import"./index-vzGptKfy.js";import"./owner-CK4ouegI.js";import"./stateAttributesMapping-BTajHoEL.js";import"./index-w1ompkCd.js";import"./composite-C55Tsz_h.js";import"./useOpenInteractionType-DOymnJq-.js";import"./isElementDisabled-DAIqf-Ux.js";import"./CompositeList-D94vPhhQ.js";import"./DirectionContext-5qgCtuu1.js";import"./useCompositeItem-u8z3oOTd.js";import"./floating-ui.utils-BMThB9Km.js";const Q=[{id:"effective",label:"Effective"},{id:"layers",label:"Layer Sources"}],U=t=>t==="user"?"user":t==="project"?"project":t==="local"?"local":"source",X=t=>{try{const a=JSON.parse(t);if(a&&typeof a=="object"&&!Array.isArray(a))return a}catch{}return null},I=(t,a)=>{let s=t;for(const o of a){if(!s||typeof s!="object"||Array.isArray(s))return"";s=s[o]}return typeof s=="string"?s:""},Z=(t,a,s)=>{const o=structuredClone(t);let l=o;for(let m=0;m<a.length-1;m+=1){const i=a[m],x=l[i];(!x||typeof x!="object"||Array.isArray(x))&&(l[i]={}),l=l[i]}const n=a[a.length-1];return s.trim().length===0?delete l[n]:l[n]=s,o},ee=()=>e.jsxs("div",{className:"space-y-3",children:[e.jsxs("div",{className:"rounded-xl border border-slate-200 bg-slate-50 p-3",children:[e.jsx(y,{className:"h-4 w-1/4"}),e.jsx(y,{className:"mt-3 h-10 w-full"}),e.jsx(y,{className:"mt-2 h-10 w-full"}),e.jsx(y,{className:"mt-2 h-10 w-full"})]}),e.jsxs("div",{className:"rounded-xl border border-slate-200 bg-slate-50 p-3",children:[e.jsx(y,{className:"h-4 w-1/3"}),e.jsx(y,{className:"mt-3 h-48 w-full"})]})]}),C=({disabled:t,loading:a,status:s,effectiveContent:o,layers:l,selectedLayerId:n,layerContent:m,detailMode:i="split",onSelectLayer:x,onLayerContentChange:E,onRefreshLayers:O,onLoadLayer:A,onSaveLayer:P})=>{const[d,D]=c.useState("effective"),[H,j]=c.useState(!1),h=c.useMemo(()=>l.find(r=>r.layerId===n)??null,[l,n]),p=c.useMemo(()=>X(m),[m]),R=i==="split",V=r=>{x(r),i==="sheet"&&j(!0)},N=(r,J)=>{if(!p)return;const M=Z(p,r,J);E(`${JSON.stringify(M,null,2)}
`)},z=d==="effective"?o.trim().length>0:l.length>0;c.useEffect(()=>{if(d!=="layers"||i!=="sheet"){j(!1);return}n&&j(!0)},[d,i,n]);const k=e.jsxs("section",{className:"grid h-full grid-rows-[auto_minmax(0,1fr)_auto] gap-2 rounded-xl border border-slate-200 p-2",children:[e.jsxs("div",{className:"flex flex-wrap items-center justify-between gap-2",children:[e.jsxs("div",{children:[e.jsx("p",{className:"typo-emphasis text-xs text-slate-700",children:"Layer editor"}),e.jsx("p",{className:"max-w-[60ch] truncate text-[11px] text-slate-500",children:h?.path??"Select a source layer"})]}),e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx(B,{size:"sm",variant:"secondary",onClick:A,disabled:t||!n,children:"Load"}),e.jsx(B,{size:"sm",onClick:P,disabled:t||!h?.editable,children:"Save"})]})]}),e.jsx(_,{value:m,onChange:r=>E(r.target.value),placeholder:"Select a layer and load content",readOnly:!h?.editable,className:"h-full resize-none font-mono text-xs"}),h?.editable?e.jsxs("section",{className:"space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-2",children:[e.jsx("p",{className:"typo-emphasis text-xs text-slate-700",children:"Quick fields"}),p?e.jsxs("div",{className:"grid grid-cols-1 gap-2 lg:grid-cols-2",children:[e.jsxs("label",{className:"space-y-1",children:[e.jsx("span",{className:"text-[11px] text-slate-600",children:"lang"}),e.jsx(T,{value:I(p,["lang"]),onChange:r=>N(["lang"],r.target.value),placeholder:"en"})]}),e.jsxs("label",{className:"space-y-1",children:[e.jsx("span",{className:"text-[11px] text-slate-600",children:"ai.activeProvider"}),e.jsx(T,{value:I(p,["ai","activeProvider"]),onChange:r=>N(["ai","activeProvider"],r.target.value),placeholder:"default"})]}),e.jsxs("label",{className:"space-y-1 lg:col-span-2",children:[e.jsx("span",{className:"text-[11px] text-slate-600",children:"terminal.outputRoot"}),e.jsx(T,{value:I(p,["terminal","outputRoot"]),onChange:r=>N(["terminal","outputRoot"],r.target.value),placeholder:"./tmp"})]})]}):e.jsx("p",{className:"text-[11px] text-slate-500",children:"Visual fields require valid JSON content in the editor."})]}):null]});return e.jsxs("section",{className:"grid h-full grid-rows-[auto_auto_minmax(0,1fr)] gap-3 rounded-2xl border border-slate-200 bg-white/96 p-4 shadow-sm",children:[e.jsxs("div",{className:"flex flex-wrap items-center justify-between gap-3",children:[e.jsxs("div",{className:"space-y-1",children:[e.jsx("h2",{className:"typo-title-3 text-slate-900",children:"Settings"}),e.jsx("p",{className:"text-xs text-slate-500",children:"Merged settings stay read-only. Each source layer remains editable independently."})]}),e.jsx(S,{variant:"secondary",className:"max-w-[48ch] truncate",children:s})]}),e.jsx(F,{items:Q,value:d,onValueChange:r=>D(r)}),e.jsx(W,{state:K({loading:a,hasData:z}),loadingOverlayLabel:d==="effective"?"Refreshing settings...":"Refreshing layers...",skeleton:e.jsx(ee,{}),empty:e.jsx("div",{className:"flex h-full items-center justify-center rounded-2xl bg-slate-50 px-4 text-sm text-slate-500",children:d==="effective"?"No merged settings available yet.":"No settings sources discovered for this workspace."}),className:"h-full",children:d==="effective"?e.jsx("div",{className:"h-full",children:e.jsx(_,{value:o,readOnly:!0,className:"h-full resize-none font-mono text-xs"})}):e.jsxs("div",{className:G("grid h-full grid-cols-1 grid-rows-[minmax(0,1fr)] gap-3",R?"xl:grid-cols-[320px_minmax(0,1fr)]":""),children:[e.jsxs("section",{className:"grid grid-rows-[auto_minmax(0,1fr)] rounded-xl border border-slate-200 bg-slate-50 p-2",children:[e.jsxs("div",{className:"mb-2 flex items-center justify-between gap-2",children:[e.jsx("p",{className:"typo-emphasis text-xs text-slate-700",children:"Sources"}),e.jsx(B,{size:"sm",variant:"secondary",onClick:O,disabled:t,children:"Refresh"})]}),e.jsx(Y,{"data-testid":"settings-sources-scroll-viewport",className:"h-full space-y-1",children:l.map(r=>e.jsxs("button",{type:"button",onClick:()=>V(r.layerId),className:r.layerId===n?"w-full rounded-md border border-teal-300 bg-teal-50 px-2 py-2 text-left":"w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-left hover:bg-slate-100",children:[e.jsxs("div",{className:"mb-1 flex items-center gap-1",children:[e.jsx(S,{variant:"secondary",children:U(r.sourceId)}),r.editable?e.jsx(S,{variant:"success",children:"editable"}):e.jsx(S,{variant:"warning",children:"readonly"})]}),e.jsx("p",{className:"line-clamp-2 text-[11px] break-all text-slate-700",children:r.path}),!r.editable&&r.readonlyReason?e.jsx("p",{className:"mt-1 text-[11px] text-amber-700",children:r.readonlyReason}):null]},r.layerId))})]}),R?k:null]})}),i==="sheet"&&d==="layers"?e.jsx($,{open:H,onOpenChange:j,side:"right",title:h?"Layer editor":"Layer source",children:e.jsx("div",{className:"h-full min-h-[40dvh]",children:k})}):null]})};C.__docgenInfo={description:"",methods:[],displayName:"SettingsPanel",props:{disabled:{required:!0,tsType:{name:"boolean"},description:""},loading:{required:!0,tsType:{name:"boolean"},description:""},status:{required:!0,tsType:{name:"string"},description:""},effectiveContent:{required:!0,tsType:{name:"string"},description:""},layers:{required:!0,tsType:{name:"Array",elements:[{name:"SettingsLayerItem"}],raw:"SettingsLayerItem[]"},description:""},selectedLayerId:{required:!0,tsType:{name:"union",raw:"string | null",elements:[{name:"string"},{name:"null"}]},description:""},layerContent:{required:!0,tsType:{name:"string"},description:""},detailMode:{required:!1,tsType:{name:"union",raw:'"split" | "sheet"',elements:[{name:"literal",value:'"split"'},{name:"literal",value:'"sheet"'}]},description:"",defaultValue:{value:'"split"',computed:!1}},onSelectLayer:{required:!0,tsType:{name:"signature",type:"function",raw:"(layerId: string) => void",signature:{arguments:[{type:{name:"string"},name:"layerId"}],return:{name:"void"}}},description:""},onLayerContentChange:{required:!0,tsType:{name:"signature",type:"function",raw:"(content: string) => void",signature:{arguments:[{type:{name:"string"},name:"content"}],return:{name:"void"}}},description:""},onRefreshLayers:{required:!0,tsType:{name:"signature",type:"function",raw:"() => void",signature:{arguments:[],return:{name:"void"}}},description:""},onLoadLayer:{required:!0,tsType:{name:"signature",type:"function",raw:"() => void",signature:{arguments:[],return:{name:"void"}}},description:""},onSaveLayer:{required:!0,tsType:{name:"signature",type:"function",raw:"() => void",signature:{arguments:[],return:{name:"void"}}},description:""}}};const{expect:u,fireEvent:te,fn:v,userEvent:g,within:f}=__STORYBOOK_MODULE_TEST__,ae=[{layerId:"0:user",sourceId:"user",path:"~/.agenter/settings.json",exists:!0,editable:!0},{layerId:"1:project",sourceId:"project",path:"/repo/demo/.agenter/settings.json",exists:!0,editable:!0}],q=Array.from({length:40},(t,a)=>({layerId:`${a}:project`,sourceId:a%2===0?"project":"user",path:`/repo/demo/.agenter/settings-${a+1}.json`,exists:!0,editable:!0})),qe={title:"Features/Settings/SettingsPanel",component:C,args:{disabled:!1,loading:!1,status:"layers refreshed",detailMode:"split",effectiveContent:`{
  "lang": "en"
}
`,layers:ae,selectedLayerId:"1:project",layerContent:`{
  "lang": "en"
}
`,onSelectLayer:v(),onLayerContentChange:v(),onRefreshLayers:v(),onLoadLayer:v(),onSaveLayer:v()},render:t=>{const[a,s]=c.useState(t.selectedLayerId),[o,l]=c.useState(t.layerContent);return e.jsx("div",{className:"h-[860px] p-6",children:e.jsx(C,{...t,selectedLayerId:a,layerContent:o,onSelectLayer:n=>{s(n),t.onSelectLayer(n)},onLayerContentChange:n=>{l(n),t.onLayerContentChange(n)}})})}},L={play:async({args:t,canvasElement:a})=>{const s=f(a);await g.click(s.getByRole("tab",{name:"Layer Sources"})),await g.click(s.getByRole("button",{name:/project/i})),await g.click(s.getByRole("button",{name:"Load"}));const o=s.getByPlaceholderText("Select a layer and load content");te.change(o,{target:{value:`{
  "lang": "ja"
}`}}),await g.click(s.getByRole("button",{name:"Save"})),await u(t.onSelectLayer).toHaveBeenCalledWith("1:project"),await u(t.onLoadLayer).toHaveBeenCalledTimes(1),await u(t.onLayerContentChange).toHaveBeenCalled(),await u(t.onSaveLayer).toHaveBeenCalledTimes(1)}},b={args:{layers:q,selectedLayerId:q[0]?.layerId??null,layerContent:`{
  "lang": "en"
}
`},render:t=>{const[a,s]=c.useState(t.selectedLayerId),[o,l]=c.useState(t.layerContent);return e.jsx("div",{className:"h-[520px] p-4",children:e.jsx(C,{...t,selectedLayerId:a,layerContent:o,onSelectLayer:n=>{s(n),t.onSelectLayer(n)},onLayerContentChange:n=>{l(n),t.onLayerContentChange(n)}})})},play:async({canvasElement:t})=>{const a=f(t);await g.click(a.getByRole("tab",{name:"Layer Sources"}));const s=a.getByTestId("settings-sources-scroll-viewport");await u(["auto","scroll"]).toContain(getComputedStyle(s).overflowY)}},w={args:{detailMode:"sheet"},play:async({canvasElement:t})=>{const a=f(t);await g.click(a.getByRole("tab",{name:"Layer Sources"}));const s=f(document.body).getByRole("dialog");await u(s).toBeInTheDocument(),await u(f(s).getByRole("heading",{name:"Layer editor"})).toBeInTheDocument()}};L.parameters={...L.parameters,docs:{...L.parameters?.docs,source:{originalSource:`{
  play: async ({
    args,
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("tab", {
      name: "Layer Sources"
    }));
    await userEvent.click(canvas.getByRole("button", {
      name: /project/i
    }));
    await userEvent.click(canvas.getByRole("button", {
      name: "Load"
    }));
    const textarea = canvas.getByPlaceholderText("Select a layer and load content");
    fireEvent.change(textarea, {
      target: {
        value: '{\\n  "lang": "ja"\\n}'
      }
    });
    await userEvent.click(canvas.getByRole("button", {
      name: "Save"
    }));
    await expect(args.onSelectLayer).toHaveBeenCalledWith("1:project");
    await expect(args.onLoadLayer).toHaveBeenCalledTimes(1);
    await expect(args.onLayerContentChange).toHaveBeenCalled();
    await expect(args.onSaveLayer).toHaveBeenCalledTimes(1);
  }
}`,...L.parameters?.docs?.source}}};b.parameters={...b.parameters,docs:{...b.parameters?.docs,source:{originalSource:`{
  args: {
    layers: longLayers,
    selectedLayerId: longLayers[0]?.layerId ?? null,
    layerContent: '{\\n  "lang": "en"\\n}\\n'
  },
  render: args => {
    const [selectedLayerId, setSelectedLayerId] = useState<string | null>(args.selectedLayerId);
    const [layerContent, setLayerContent] = useState(args.layerContent);
    return <div className="h-[520px] p-4">
        <SettingsPanel {...args} selectedLayerId={selectedLayerId} layerContent={layerContent} onSelectLayer={layerId => {
        setSelectedLayerId(layerId);
        args.onSelectLayer(layerId);
      }} onLayerContentChange={content => {
        setLayerContent(content);
        args.onLayerContentChange(content);
      }} />
      </div>;
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("tab", {
      name: "Layer Sources"
    }));
    const viewport = canvas.getByTestId("settings-sources-scroll-viewport");
    await expect(["auto", "scroll"]).toContain(getComputedStyle(viewport).overflowY);
  }
}`,...b.parameters?.docs?.source}}};w.parameters={...w.parameters,docs:{...w.parameters?.docs,source:{originalSource:`{
  args: {
    detailMode: "sheet"
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("tab", {
      name: "Layer Sources"
    }));
    const dialog = within(document.body).getByRole("dialog");
    await expect(dialog).toBeInTheDocument();
    await expect(within(dialog).getByRole("heading", {
      name: "Layer editor"
    })).toBeInTheDocument();
  }
}`,...w.parameters?.docs?.source}}};const Oe=["EditWorkspaceLayer","LayerSourcesKeepExplicitScrollViewport","CompactLayerEditorSheet"];export{w as CompactLayerEditorSheet,L as EditWorkspaceLayer,b as LayerSourcesKeepExplicitScrollViewport,Oe as __namedExportsOrder,qe as default};
