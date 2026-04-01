import{j as e}from"./jsx-runtime-u17CrQMm.js";import{f as W,d as _}from"./ai-input-story-utils-0bqZ7u0d.js";import{r as H}from"./iframe-BA9U4A2Q.js";import{A as O,r as F}from"./async-surface-CwnBr4KY.js";import{B as v}from"./badge-BuZNKfRS.js";import{B as S,a as b,b as k}from"./button-2keny9to.js";import{S as L}from"./overflow-surface-Cav6wYq5.js";import{S as f}from"./skeleton-D3ZGd0h7.js";import{A as V}from"./AIInput-DKraBPL5.js";import{S as M}from"./SessionItem-y1qzyWoF.js";import{c as B}from"./utils-VtdL_sx5.js";import"./preload-helper-PPVm8Dsz.js";import"./loader-circle-BDXf0OYg.js";import"./inline-affordance-BLl3bR6J.js";import"./index-MMW-HMpx.js";import"./AIInputPendingAssets-B_LfGE5Q.js";import"./x-DMkXTevi.js";import"./video-Cv162eWI.js";import"./dialog-CvvgVQqk.js";import"./DialogTitle-sL7T0N-8.js";import"./useBaseUiId-7OVNNPuG.js";import"./popupStateMapping-CkY0FYKf.js";import"./index-DGd7USjR.js";import"./index-vzGptKfy.js";import"./owner-CK4ouegI.js";import"./stateAttributesMapping-BTajHoEL.js";import"./index-w1ompkCd.js";import"./composite-C55Tsz_h.js";import"./useOpenInteractionType-DOymnJq-.js";import"./AIInputToolbar-CeUr_Lvu.js";import"./ComposerActionBar-iiPo3j8t.js";import"./adaptive-icon-button-CQ5eDh91.js";import"./tooltip-CiUFOqZ4.js";import"./getDisabledMountTransitionStyles-DYKgFN9P.js";import"./floating-ui.utils-BMThB9Km.js";import"./DirectionContext-5qgCtuu1.js";import"./image-plus-Dt0i74Vu.js";import"./ComposerStatusBar-BgkXM5tD.js";import"./dropdown-menu-B3aKSIUC.js";import"./chevron-right-BEfTCuPR.js";import"./useCompositeItem-u8z3oOTd.js";import"./CompositeList-D94vPhhQ.js";import"./status-meta-Nw4SQ9xE.js";import"./message-square-CmkkqTCj.js";import"./square-BrHEXLLO.js";import"./trash-2-i7CCEBiG.js";const Q=[["path",{d:"M9 9.003a1 1 0 0 1 1.517-.859l4.997 2.997a1 1 0 0 1 0 1.718l-4.997 2.997A1 1 0 0 1 9 14.996z",key:"kmsa83"}],["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}]],U=B("circle-play",Q);const $=[["path",{d:"M10.7 20H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H20a2 2 0 0 1 2 2v4.1",key:"1bw5m7"}],["path",{d:"m21 21-1.9-1.9",key:"1g2n9r"}],["circle",{cx:"17",cy:"17",r:"3",key:"18b49y"}]],G=B("folder-search",$),m=({workspacePath:t,draftResolution:a,recentSessions:n,loadingDraft:o,starting:p,onOpenWorkspacePicker:d,onEnterWorkspace:y,onSubmit:j,onSearchPaths:E,onResumeSession:C})=>{const[N,A]=H.useState(null),R=a?[a.provider.vendor??a.provider.providerId,a.provider.apiStandard,a.provider.model].filter(i=>typeof i=="string"&&i.length>0).join(" · "):o?"Resolving provider...":"Provider unavailable",u=a?.modelCapabilities.imageInput??!1,q=u?"Describe the task, use @ to reference files, or paste images...":"Describe the task and use @ to reference files...",D=e.jsx("div",{className:"space-y-3",children:Array.from({length:3},(i,P)=>e.jsxs("div",{className:"rounded-xl border border-slate-200 bg-slate-50 p-3",children:[e.jsx(f,{className:"h-4 w-1/2"}),e.jsx(f,{className:"mt-3 h-3 w-full"}),e.jsx(f,{className:"mt-2 h-3 w-5/6"})]},P))});return e.jsx("section",{className:"grid h-full grid-rows-[minmax(0,1fr)]",children:e.jsx(L,{"data-testid":"quickstart-scroll-viewport",className:"h-full pr-1",children:e.jsxs("div",{className:"mx-auto flex min-h-full w-full max-w-4xl flex-col gap-4 pb-2",children:[e.jsxs("section",{className:"rounded-[1.5rem] bg-white/96 p-4 shadow-sm ring-1 ring-slate-200/80 md:p-5",children:[e.jsxs("div",{className:"flex flex-wrap items-start justify-between gap-3",children:[e.jsxs("div",{className:"space-y-2",children:[e.jsx("h2",{className:"typo-title-2 text-slate-900",children:"Quick Start"}),e.jsx("p",{className:"text-sm text-slate-600",children:"Choose a workspace, then start a new session with one prompt."})]}),e.jsxs("div",{className:"flex flex-wrap items-center gap-2",children:[e.jsxs(S,{variant:"outline",onClick:d,title:"Choose workspace",children:[e.jsx(b,{children:e.jsx(G,{className:"h-4 w-4"})}),e.jsx(k,{children:"Change"})]}),e.jsxs(S,{variant:"secondary",onClick:y,disabled:p,title:"Enter workspace without a first message",children:[e.jsx(b,{children:e.jsx(U,{className:"h-4 w-4"})}),e.jsx(k,{children:"Enter"})]})]})]}),e.jsx("div",{className:"mt-4",children:e.jsx(V,{workspacePath:t,disabled:p||o,imageEnabled:!0,imageCompatible:u,submitLabel:"Start",submitTitle:"Create session and send the first message",placeholder:q,onSubmit:j,onSearchPaths:E})}),e.jsxs("div",{className:"mt-3 space-y-2 rounded-2xl bg-slate-50/85 px-3 py-3 ring-1 ring-slate-200/70",children:[e.jsxs("div",{children:[e.jsx("p",{className:"text-[11px] uppercase tracking-[0.18em] text-slate-500",children:"Workspace"}),e.jsx("p",{className:"mt-1 text-sm font-medium text-slate-900",children:t.split(/[\\/]+/).filter(Boolean).at(-1)??t}),e.jsx("p",{className:"mt-1 hidden break-all text-xs text-slate-500 sm:block",children:t})]}),e.jsxs("div",{className:"flex flex-wrap items-center gap-2 text-xs text-slate-500",children:[e.jsx(v,{variant:"secondary",children:R}),e.jsx(v,{variant:u?"success":"secondary",children:u?"Image input ready":"Image upload ready"})]})]})]}),e.jsxs("section",{className:"rounded-[1.5rem] bg-white/94 p-4 shadow-sm ring-1 ring-slate-200/80",children:[e.jsxs("div",{className:"mb-3 flex items-center justify-between gap-3",children:[e.jsxs("div",{children:[e.jsx("h3",{className:"typo-title-3 text-slate-900",children:"Recent Sessions"}),e.jsx("p",{className:"text-xs text-slate-500",children:"Up to the latest three sessions from this workspace."})]}),e.jsx(v,{variant:"secondary",children:n.length})]}),e.jsx(O,{state:F({loading:o,hasData:n.length>0}),loadingOverlayLabel:"Refreshing recent sessions...",skeleton:D,empty:e.jsx("p",{className:"rounded-xl bg-slate-50 px-3 py-4 text-sm text-slate-500",children:"No recent sessions for this workspace yet."}),children:e.jsx("div",{className:"space-y-3",children:n.map(i=>e.jsx(M,{session:i,selected:N===i.sessionId,mode:"quickstart",onSelect:A,onActivate:C},i.sessionId))})})]})]})})})};m.__docgenInfo={description:"",methods:[],displayName:"QuickStartView",props:{workspacePath:{required:!0,tsType:{name:"string"},description:""},draftResolution:{required:!0,tsType:{name:"union",raw:"DraftResolutionOutput | null",elements:[{name:"DraftResolutionOutput"},{name:"null"}]},description:""},recentSessions:{required:!0,tsType:{name:"Array",elements:[{name:"WorkspaceSessionEntry"}],raw:"WorkspaceSessionEntry[]"},description:""},loadingDraft:{required:!0,tsType:{name:"boolean"},description:""},starting:{required:!0,tsType:{name:"boolean"},description:""},onOpenWorkspacePicker:{required:!0,tsType:{name:"signature",type:"function",raw:"() => void",signature:{arguments:[],return:{name:"void"}}},description:""},onEnterWorkspace:{required:!0,tsType:{name:"signature",type:"function",raw:"() => void",signature:{arguments:[],return:{name:"void"}}},description:""},onSubmit:{required:!0,tsType:{name:"signature",type:"function",raw:"(payload: AIInputSubmitPayload) => Promise<void>",signature:{arguments:[{type:{name:"AIInputSubmitPayload"},name:"payload"}],return:{name:"Promise",elements:[{name:"void"}],raw:"Promise<void>"}}},description:""},onSearchPaths:{required:!0,tsType:{name:"signature",type:"function",raw:"(input: { cwd: string; query: string; limit?: number }) => Promise<AIInputSuggestion[]>",signature:{arguments:[{type:{name:"signature",type:"object",raw:"{ cwd: string; query: string; limit?: number }",signature:{properties:[{key:"cwd",value:{name:"string",required:!0}},{key:"query",value:{name:"string",required:!0}},{key:"limit",value:{name:"number",required:!1}}]}},name:"input"}],return:{name:"Promise",elements:[{name:"Array",elements:[{name:"AIInputSuggestion"}],raw:"AIInputSuggestion[]"}],raw:"Promise<AIInputSuggestion[]>"}}},description:""},onResumeSession:{required:!0,tsType:{name:"signature",type:"function",raw:"(sessionId: string) => void",signature:{arguments:[{type:{name:"string"},name:"sessionId"}],return:{name:"void"}}},description:""}}};const{expect:s,fn:c,userEvent:r,waitFor:l,within:x}=__STORYBOOK_MODULE_TEST__,T={sessionId:"session-recent-001",name:"Contract review",status:"running",storageState:"active",favorite:!1,createdAt:"2026-03-06T10:00:00.000Z",updatedAt:"2026-03-06T10:01:00.000Z",preview:{firstUserMessage:"Audit the chat workflow",latestMessages:["Collected runtime state","Need a UI fix"]}},I=t=>({...T,sessionId:`session-recent-${String(t+1).padStart(3,"0")}`,name:`Contract review ${t+1}`,createdAt:`2026-03-06T10:${String(t).padStart(2,"0")}:00.000Z`,updatedAt:`2026-03-06T10:${String(t+1).padStart(2,"0")}:30.000Z`,preview:{firstUserMessage:`Audit workspace flow ${t+1}`,latestMessages:[`Collected runtime state ${t+1}`,`Need a UI fix ${t+1}`]}}),Z=c(async({query:t})=>t==="@"?[{label:"src/",path:"src/",isDirectory:!0},{label:"README.md",path:"README.md",isDirectory:!1}]:t==="@src/"?[{label:"src/index.ts",path:"src/index.ts",isDirectory:!1}]:[]),Le={title:"Features/QuickStart/QuickStartView",component:m,args:{workspacePath:"/repo/demo",draftResolution:{cwd:"/repo/demo",provider:{providerId:"openai",apiStandard:"openai-responses",vendor:"openai",model:"gpt-4.1-mini"},modelCapabilities:{streaming:!0,tools:!0,imageInput:!0,nativeCompact:!0,summarizeFallback:!0,fileUpload:!1,mcpCatalog:!1}},recentSessions:[T],loadingDraft:!1,starting:!1,onOpenWorkspacePicker:c(),onEnterWorkspace:c(),onSubmit:c(async()=>{}),onSearchPaths:Z,onResumeSession:c()},render:t=>e.jsx("div",{className:"h-[860px] p-6",children:e.jsx(m,{...t})})},w={play:async({args:t,canvasElement:a})=>{const n=x(a),o=x(a.ownerDocument.body);await s(n.getByText("Quick Start")).toBeInTheDocument(),await s(n.getByText("openai · openai-responses · gpt-4.1-mini")).toBeInTheDocument(),await s(n.getByText("Image input ready")).toBeInTheDocument(),await r.click(n.getByRole("button",{name:"Change"})),await s(t.onOpenWorkspacePicker).toHaveBeenCalledTimes(1),await r.click(n.getByRole("button",{name:"Enter"})),await s(t.onEnterWorkspace).toHaveBeenCalledTimes(1);const p=await W(a,async y=>{await r.click(y)});await r.keyboard("Audit @"),await l(()=>{s(t.onSearchPaths).toHaveBeenCalledWith({cwd:"/repo/demo",query:"@",limit:8})}),await r.click(await o.findByText("src/")),await l(()=>{s(t.onSearchPaths).toHaveBeenCalledWith({cwd:"/repo/demo",query:"@src/",limit:8})}),await r.click(await o.findByText("src/index.ts"));const d=new File([new Uint8Array([1,2,3,4])],"quickstart-brief.png",{type:"image/png"});_(p,d),await s(await n.findByAltText("quickstart-brief.png")).toBeInTheDocument(),await r.click(n.getByRole("button",{name:"Start"})),await l(()=>{s(t.onSubmit).toHaveBeenCalledWith({text:"Audit @src/index.ts",assets:[d]})}),await r.click(n.getByRole("button",{name:"Resume Contract review · session-recent-001"})),await s(t.onResumeSession).toHaveBeenCalledWith("session-recent-001")}},g={args:{recentSessions:Array.from({length:12},(t,a)=>I(a))},render:t=>e.jsx("div",{className:"h-[520px] p-6",children:e.jsx(m,{...t})}),play:async({canvasElement:t})=>{const n=await x(t).findByTestId("quickstart-scroll-viewport");await l(()=>{s(n.scrollHeight).toBeGreaterThan(n.clientHeight)}),n.scrollTop=240,n.dispatchEvent(new Event("scroll")),await l(()=>{s(n.scrollTop).toBeGreaterThan(0)})}},h={args:{recentSessions:Array.from({length:5},(t,a)=>I(a))},render:t=>e.jsx("div",{className:"h-[780px] max-w-[390px] p-4",children:e.jsx(m,{...t})}),play:async({canvasElement:t})=>{const a=x(t),n=await a.findByTestId("quickstart-scroll-viewport");await s(a.getByRole("button",{name:"Change"})).toBeInTheDocument(),await s(a.getByRole("button",{name:"Enter"})).toBeInTheDocument(),await s(a.getByRole("button",{name:"Start"})).toBeInTheDocument(),await s(a.getByText("Recent Sessions")).toBeInTheDocument(),await s(n.scrollWidth).toBeLessThanOrEqual(n.clientWidth+1)}};w.parameters={...w.parameters,docs:{...w.parameters?.docs,source:{originalSource:`{
  play: async ({
    args,
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const portal = within(canvasElement.ownerDocument.body);
    await expect(canvas.getByText("Quick Start")).toBeInTheDocument();
    await expect(canvas.getByText("openai · openai-responses · gpt-4.1-mini")).toBeInTheDocument();
    await expect(canvas.getByText("Image input ready")).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", {
      name: "Change"
    }));
    await expect(args.onOpenWorkspacePicker).toHaveBeenCalledTimes(1);
    await userEvent.click(canvas.getByRole("button", {
      name: "Enter"
    }));
    await expect(args.onEnterWorkspace).toHaveBeenCalledTimes(1);
    const editor = await focusEditorSurface(canvasElement, async target => {
      await userEvent.click(target);
    });
    await userEvent.keyboard("Audit @");
    await waitFor(() => {
      expect(args.onSearchPaths).toHaveBeenCalledWith({
        cwd: "/repo/demo",
        query: "@",
        limit: 8
      });
    });
    await userEvent.click(await portal.findByText("src/"));
    await waitFor(() => {
      expect(args.onSearchPaths).toHaveBeenCalledWith({
        cwd: "/repo/demo",
        query: "@src/",
        limit: 8
      });
    });
    await userEvent.click(await portal.findByText("src/index.ts"));
    const image = new File([new Uint8Array([1, 2, 3, 4])], "quickstart-brief.png", {
      type: "image/png"
    });
    dispatchClipboardImage(editor, image);
    await expect(await canvas.findByAltText("quickstart-brief.png")).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", {
      name: "Start"
    }));
    await waitFor(() => {
      expect(args.onSubmit).toHaveBeenCalledWith({
        text: "Audit @src/index.ts",
        assets: [image]
      });
    });
    await userEvent.click(canvas.getByRole("button", {
      name: "Resume Contract review · session-recent-001"
    }));
    await expect(args.onResumeSession).toHaveBeenCalledWith("session-recent-001");
  }
}`,...w.parameters?.docs?.source}}};g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  args: {
    recentSessions: Array.from({
      length: 12
    }, (_, index) => buildRecentSession(index))
  },
  render: args => <div className="h-[520px] p-6">
      <QuickStartView {...args} />
    </div>,
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const viewport = await canvas.findByTestId("quickstart-scroll-viewport");
    await waitFor(() => {
      expect(viewport.scrollHeight).toBeGreaterThan(viewport.clientHeight);
    });
    viewport.scrollTop = 240;
    viewport.dispatchEvent(new Event("scroll"));
    await waitFor(() => {
      expect(viewport.scrollTop).toBeGreaterThan(0);
    });
  }
}`,...g.parameters?.docs?.source}}};h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  args: {
    recentSessions: Array.from({
      length: 5
    }, (_, index) => buildRecentSession(index))
  },
  render: args => <div className="h-[780px] max-w-[390px] p-4">
      <QuickStartView {...args} />
    </div>,
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const viewport = await canvas.findByTestId("quickstart-scroll-viewport");
    await expect(canvas.getByRole("button", {
      name: "Change"
    })).toBeInTheDocument();
    await expect(canvas.getByRole("button", {
      name: "Enter"
    })).toBeInTheDocument();
    await expect(canvas.getByRole("button", {
      name: "Start"
    })).toBeInTheDocument();
    await expect(canvas.getByText("Recent Sessions")).toBeInTheDocument();
    await expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.clientWidth + 1);
  }
}`,...h.parameters?.docs?.source}}};const Ve=["StartAndResumeFlow","ScrollViewportOwnsLongContent","CompactViewportKeepsPrimaryEntryPath"];export{h as CompactViewportKeepsPrimaryEntryPath,g as ScrollViewportOwnsLongContent,w as StartAndResumeFlow,Ve as __namedExportsOrder,Le as default};
