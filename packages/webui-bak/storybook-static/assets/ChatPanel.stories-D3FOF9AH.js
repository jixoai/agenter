import{j as o}from"./jsx-runtime-u17CrQMm.js";import{S as b}from"./SessionStatusPillMenu-COHekaIu.js";import{f as D}from"./ai-input-story-utils-0bqZ7u0d.js";import{C as m,c as E}from"./real-session-history-fixture-nPeL_OLy.js";import"./button-2keny9to.js";import"./inline-affordance-BLl3bR6J.js";import"./utils-VtdL_sx5.js";import"./iframe-BA9U4A2Q.js";import"./preload-helper-PPVm8Dsz.js";import"./dropdown-menu-B3aKSIUC.js";import"./chevron-right-BEfTCuPR.js";import"./index-DGd7USjR.js";import"./index-vzGptKfy.js";import"./popupStateMapping-CkY0FYKf.js";import"./useBaseUiId-7OVNNPuG.js";import"./owner-CK4ouegI.js";import"./stateAttributesMapping-BTajHoEL.js";import"./index-w1ompkCd.js";import"./useOpenInteractionType-DOymnJq-.js";import"./DirectionContext-5qgCtuu1.js";import"./useCompositeItem-u8z3oOTd.js";import"./floating-ui.utils-BMThB9Km.js";import"./composite-C55Tsz_h.js";import"./CompositeList-D94vPhhQ.js";import"./getDisabledMountTransitionStyles-DYKgFN9P.js";import"./chevron-down-Da227ukw.js";import"./loader-circle-BDXf0OYg.js";import"./square-BrHEXLLO.js";import"./AIInput-DKraBPL5.js";import"./index-MMW-HMpx.js";import"./AIInputPendingAssets-B_LfGE5Q.js";import"./overflow-surface-Cav6wYq5.js";import"./x-DMkXTevi.js";import"./video-Cv162eWI.js";import"./dialog-CvvgVQqk.js";import"./DialogTitle-sL7T0N-8.js";import"./AIInputToolbar-CeUr_Lvu.js";import"./ComposerActionBar-iiPo3j8t.js";import"./adaptive-icon-button-CQ5eDh91.js";import"./tooltip-CiUFOqZ4.js";import"./image-plus-Dt0i74Vu.js";import"./ComposerStatusBar-BgkXM5tD.js";import"./virtualizer-DwzOHpwu.js";import"./ChatConversationRows-BP_Rleh6.js";import"./profile-image-DCTEHzfl.js";import"./tool-structured-view-Be99XAPJ.js";import"./AssistantMarkdown-BRd3mpcZ.js";import"./accordion-CbxGKyEs.js";import"./isElementDisabled-DAIqf-Ux.js";import"./ChatAttachmentStrip-CNmJgMJl.js";import"./ellipsis-D8eZY63e.js";import"./triangle-alert-DpleOF06.js";import"./sparkles-D7ne4up4.js";import"./cycle-facts-BEtDU-MN.js";const{expect:t,fireEvent:v,fn:p,userEvent:r,waitFor:l,within:i}=__STORYBOOK_MODULE_TEST__,C=p(async({query:n})=>n==="@"?[{label:"README.md",path:"README.md",isDirectory:!1},{label:"src/",path:"src/",isDirectory:!0}]:[]),S=(n,e,a)=>o.jsx(b,{statusLabel:n,tone:e,primaryActionLabel:a,onPrimaryAction:p(),onAbort:p()}),x=(n=[])=>[...[{id:"101",role:"user",content:"Inspect the terminal state and attached diagram.",timestamp:7,cycleId:null,attachments:[{assetId:"image-1",kind:"image",mimeType:"image/png",name:"diagram.png",sizeBytes:2048,url:"https://placehold.co/320x240/png"}]},{id:"102",role:"assistant",channel:"to_user",content:"Ready to inspect the terminal output with you.",timestamp:10,cycleId:7}],...n],f=["Decision: Since the automatic upgrade has failed twice, manual upgrade is required.","","Next:","","1. Current version: 0.5.15","2. Available version: 0.5.18","3. Status: Automatic upgrade failed twice","4. Recommended action: `npm i -g @iflow/cli@latest`"].join(`
`),I=n=>({id:"cycle:7",cycleId:7,seq:7,createdAt:7,wakeSource:"user",kind:"model",status:"done",clientMessageIds:["client-7"],inputs:[{source:"message",role:"user",name:"User",parts:[{type:"text",text:"Inspect the terminal state and attached diagram."},{type:"image",assetId:"image-1",kind:"image",mimeType:"image/png",name:"diagram.png",sizeBytes:2048,url:"https://placehold.co/320x240/png"}],meta:{clientMessageId:"client-7"}}],outputs:[{id:"msg-tool-call",role:"assistant",channel:"tool_call",content:["```yaml+tool_call","tool: terminal_read","input:","  terminalId: iflow","```"].join(`
`),timestamp:8,cycleId:7,tool:{name:"terminal_read"}},{id:"msg-tool-result",role:"assistant",channel:"tool_result",content:["```yaml+tool_result","tool: terminal_read","ok: true","output:","  kind: terminal-snapshot","  terminalId: iflow","```"].join(`
`),timestamp:9,cycleId:7,tool:{name:"terminal_read",ok:!0}},{id:"msg-thought",role:"assistant",channel:"self_talk",content:"hidden internal note",timestamp:9,cycleId:7},{id:"msg-assistant-1",role:"assistant",channel:"to_user",content:"Ready to inspect the terminal output with you.",timestamp:10,cycleId:7}],liveMessages:[],streaming:null,modelCallId:11,...n}),Ae={title:"Features/Chat/ChatPanel",component:m,args:{workspacePath:"/repo/demo",aiStatus:"idle",sessionStateLabel:"Session running",statusSlot:S("Session running","active","Stop session"),disabled:!1,imageEnabled:!0,onSubmit:p(async()=>{}),onSearchPaths:C,onOpenDevtools:p(),messages:x(),cycles:[I()]},render:n=>o.jsx("div",{className:"h-[720px] p-6",children:o.jsx(m,{...n})})},d={play:async({args:n,canvasElement:e})=>{const a=i(e),s=i(e.ownerDocument.body);await t(a.getByRole("button",{name:/Session status: Session running/})).toBeInTheDocument(),await t(a.getAllByText("Inspect the terminal state and attached diagram.").length).toBeGreaterThan(0),await t(a.getAllByText("Ready to inspect the terminal output with you.").length).toBeGreaterThan(0),await t(a.queryByText(/Cycle 7/i)).not.toBeInTheDocument(),await t(a.queryByText("terminal_read")).not.toBeInTheDocument(),await t(a.queryByText("hidden internal note")).not.toBeInTheDocument(),await r.click(a.getByAltText("diagram.png")),await t(s.getByRole("dialog",{name:"diagram.png"})).toBeInTheDocument(),await r.click(s.getByRole("button",{name:"Close dialog"}));const c=await D(e,async u=>{await r.click(u)});await r.keyboard("Check @"),await l(()=>{t(n.onSearchPaths).toHaveBeenCalledWith({cwd:"/repo/demo",query:"@",limit:8})}),await r.click(await s.findByText("README.md")),await l(()=>{t(c.textContent??"").toContain("Check @README.md")}),await r.click(a.getByRole("button",{name:"Send"})),await l(()=>{t(n.onSubmit).toHaveBeenCalledWith({text:"Check @README.md",assets:[]})})}},y={args:{aiStatus:"waiting model",messages:x(),cycles:[I({id:"cycle:8",cycleId:8,seq:8,status:"streaming",outputs:[],liveMessages:[{id:"live-thought-1",role:"assistant",channel:"self_talk",content:"hidden streaming trace",timestamp:11,cycleId:8}],streaming:{content:"I am still collecting terminal updates."}})]},play:async({canvasElement:n})=>{const e=i(n);await t(e.getAllByText("I am still collecting terminal updates.").length).toBeGreaterThan(0),await t(e.queryByText(/Cycle 8/i)).not.toBeInTheDocument(),await t(e.queryByText("hidden streaming trace")).not.toBeInTheDocument(),await t(e.queryByText("terminal_read")).not.toBeInTheDocument()}},h={play:async({args:n,canvasElement:e})=>{const a=i(e),s=i(e.ownerDocument.body);await r.click(a.getAllByRole("button",{name:"Message actions"})[1]),await r.click(await s.findByText("View In Devtools")),await l(()=>{t(n.onOpenDevtools).toHaveBeenCalledWith(7)})}},g={render:n=>o.jsx("div",{className:"h-[760px] w-[390px] p-4",children:o.jsx(m,{...n})}),play:async({canvasElement:n})=>{const a=n.querySelector("[data-message-role='assistant']")?.querySelector("article");if(!(a instanceof HTMLElement))throw new Error("Assistant bubble not found");const s=i(n.ownerDocument.body);v.pointerDown(a,{pointerId:7,pointerType:"touch",button:0,clientX:32,clientY:48}),await new Promise(c=>window.setTimeout(c,430)),v.pointerUp(a,{pointerId:7,pointerType:"touch",button:0,clientX:32,clientY:48}),await t(await s.findByText("View In Devtools")).toBeInTheDocument()}},w={args:{sessionStateLabel:"Session stopped",statusSlot:S("Session stopped","neutral","Start session"),messages:[],cycles:[],routeNotice:null},play:async({canvasElement:n})=>{const e=i(n);await t(e.getByRole("button",{name:/Session status: Session stopped/})).toBeInTheDocument(),await t(e.queryByText("Session is stopped. Start it to continue.")).not.toBeInTheDocument(),await t(e.getByText("Session stopped. Use the primary session action to begin or continue working.")).toBeInTheDocument()}},B={args:{messages:x([{id:"103",role:"assistant",channel:"to_user",content:f,timestamp:11,cycleId:7}]),cycles:[I()]},render:n=>o.jsx("div",{className:"h-[667px] w-[375px] bg-slate-100",children:o.jsx(m,{...n})}),play:async({canvasElement:n})=>{const e=i(n),a=e.getByTestId("chat-panel"),s=e.getByTestId("chat-scroll-viewport");e.getByTestId("composer-toolbar");const c=e.getByTestId("composer-action-bar"),u=e.getByTestId("composer-status-bar");await t(e.getByTestId("chat-route-status-strip")).toBeInTheDocument(),await t(e.getByRole("button",{name:/Session status: Session running/})).toBeInTheDocument(),await t(e.queryByText(/Cycle 7/i)).not.toBeInTheDocument(),await t(e.getByTestId("composer-action-bar")).toBeInTheDocument(),await t(e.getByTestId("composer-status-bar")).toBeInTheDocument(),await t(e.getAllByRole("button",{name:"Message actions"}).length).toBeGreaterThan(0),await t(e.getAllByText("Ready to inspect the terminal output with you.").length).toBeGreaterThan(0),await t(e.getByText("Decision: Since the automatic upgrade has failed twice, manual upgrade is required.")).toBeInTheDocument(),await l(()=>{t(a.scrollWidth).toBeLessThanOrEqual(a.clientWidth+1),t(s.scrollWidth).toBeLessThanOrEqual(s.clientWidth+1),t(c.scrollWidth).toBeLessThanOrEqual(c.clientWidth+1),t(u.scrollWidth).toBeLessThanOrEqual(u.clientWidth+1)})}},T={args:{messages:E().messages,cycles:[],sessionStateLabel:"Session running"},render:n=>o.jsx("div",{className:"h-[760px] p-6",children:o.jsx(m,{...n})}),play:async({canvasElement:n})=>{const e=i(n),a=await e.findByTestId("chat-scroll-viewport");await t(e.getByText("Assistant reply 14: completed the visible conversation turn 14.")).toBeInTheDocument(),await t(a).toHaveClass("h-full"),await t(e.queryByText(/Cycle 14/i)).not.toBeInTheDocument(),a.scrollTop=0,v.scroll(a),await l(()=>{t(e.getByAltText("briefing.png")).toBeInTheDocument()})}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  play: async ({
    args,
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const portal = within(canvasElement.ownerDocument.body);
    await expect(canvas.getByRole("button", {
      name: /Session status: Session running/
    })).toBeInTheDocument();
    await expect(canvas.getAllByText("Inspect the terminal state and attached diagram.").length).toBeGreaterThan(0);
    await expect(canvas.getAllByText("Ready to inspect the terminal output with you.").length).toBeGreaterThan(0);
    await expect(canvas.queryByText(/Cycle 7/i)).not.toBeInTheDocument();
    await expect(canvas.queryByText("terminal_read")).not.toBeInTheDocument();
    await expect(canvas.queryByText("hidden internal note")).not.toBeInTheDocument();
    await userEvent.click(canvas.getByAltText("diagram.png"));
    await expect(portal.getByRole("dialog", {
      name: "diagram.png"
    })).toBeInTheDocument();
    await userEvent.click(portal.getByRole("button", {
      name: "Close dialog"
    }));
    const editor = await focusEditorSurface(canvasElement, async target => {
      await userEvent.click(target);
    });
    await userEvent.keyboard("Check @");
    await waitFor(() => {
      expect(args.onSearchPaths).toHaveBeenCalledWith({
        cwd: "/repo/demo",
        query: "@",
        limit: 8
      });
    });
    await userEvent.click(await portal.findByText("README.md"));
    await waitFor(() => {
      expect(editor.textContent ?? "").toContain("Check @README.md");
    });
    await userEvent.click(canvas.getByRole("button", {
      name: "Send"
    }));
    await waitFor(() => {
      expect(args.onSubmit).toHaveBeenCalledWith({
        text: "Check @README.md",
        assets: []
      });
    });
  }
}`,...d.parameters?.docs?.source}}};y.parameters={...y.parameters,docs:{...y.parameters?.docs,source:{originalSource:`{
  args: {
    aiStatus: "waiting model",
    messages: buildMessages(),
    cycles: [buildCycle({
      id: "cycle:8",
      cycleId: 8,
      seq: 8,
      status: "streaming",
      outputs: [],
      liveMessages: [{
        id: "live-thought-1",
        role: "assistant",
        channel: "self_talk",
        content: "hidden streaming trace",
        timestamp: 11,
        cycleId: 8
      }],
      streaming: {
        content: "I am still collecting terminal updates."
      }
    })]
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByText("I am still collecting terminal updates.").length).toBeGreaterThan(0);
    await expect(canvas.queryByText(/Cycle 8/i)).not.toBeInTheDocument();
    await expect(canvas.queryByText("hidden streaming trace")).not.toBeInTheDocument();
    await expect(canvas.queryByText("terminal_read")).not.toBeInTheDocument();
  }
}`,...y.parameters?.docs?.source}}};h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  play: async ({
    args,
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const portal = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getAllByRole("button", {
      name: "Message actions"
    })[1]!);
    await userEvent.click(await portal.findByText("View In Devtools"));
    await waitFor(() => {
      expect(args.onOpenDevtools).toHaveBeenCalledWith(7);
    });
  }
}`,...h.parameters?.docs?.source}}};g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  render: args => <div className="h-[760px] w-[390px] p-4">
      <ChatPanel {...args} />
    </div>,
  play: async ({
    canvasElement
  }) => {
    const assistantRow = canvasElement.querySelector("[data-message-role='assistant']");
    const assistantBubble = assistantRow?.querySelector("article");
    if (!(assistantBubble instanceof HTMLElement)) {
      throw new Error("Assistant bubble not found");
    }
    const portal = within(canvasElement.ownerDocument.body);
    fireEvent.pointerDown(assistantBubble, {
      pointerId: 7,
      pointerType: "touch",
      button: 0,
      clientX: 32,
      clientY: 48
    });
    await new Promise(resolve => window.setTimeout(resolve, 430));
    fireEvent.pointerUp(assistantBubble, {
      pointerId: 7,
      pointerType: "touch",
      button: 0,
      clientX: 32,
      clientY: 48
    });
    await expect(await portal.findByText("View In Devtools")).toBeInTheDocument();
  }
}`,...g.parameters?.docs?.source}}};w.parameters={...w.parameters,docs:{...w.parameters?.docs,source:{originalSource:`{
  args: {
    sessionStateLabel: "Session stopped",
    statusSlot: renderSessionPill("Session stopped", "neutral", "Start session"),
    messages: [],
    cycles: [],
    routeNotice: null
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", {
      name: /Session status: Session stopped/
    })).toBeInTheDocument();
    await expect(canvas.queryByText("Session is stopped. Start it to continue.")).not.toBeInTheDocument();
    await expect(canvas.getByText("Session stopped. Use the primary session action to begin or continue working.")).toBeInTheDocument();
  }
}`,...w.parameters?.docs?.source}}};B.parameters={...B.parameters,docs:{...B.parameters?.docs,source:{originalSource:`{
  args: {
    messages: buildMessages([{
      id: "103",
      role: "assistant",
      channel: "to_user",
      content: MOBILE_ASSISTANT_REPLY,
      timestamp: 11,
      cycleId: 7
    }]),
    cycles: [buildCycle()]
  },
  render: args => <div className="h-[667px] w-[375px] bg-slate-100">
      <ChatPanel {...args} />
    </div>,
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const panel = canvas.getByTestId("chat-panel");
    const viewport = canvas.getByTestId("chat-scroll-viewport");
    const toolbar = canvas.getByTestId("composer-toolbar");
    const actionBar = canvas.getByTestId("composer-action-bar");
    const statusBar = canvas.getByTestId("composer-status-bar");
    await expect(canvas.getByTestId("chat-route-status-strip")).toBeInTheDocument();
    await expect(canvas.getByRole("button", {
      name: /Session status: Session running/
    })).toBeInTheDocument();
    await expect(canvas.queryByText(/Cycle 7/i)).not.toBeInTheDocument();
    await expect(canvas.getByTestId("composer-action-bar")).toBeInTheDocument();
    await expect(canvas.getByTestId("composer-status-bar")).toBeInTheDocument();
    await expect(canvas.getAllByRole("button", {
      name: "Message actions"
    }).length).toBeGreaterThan(0);
    await expect(canvas.getAllByText("Ready to inspect the terminal output with you.").length).toBeGreaterThan(0);
    await expect(canvas.getByText("Decision: Since the automatic upgrade has failed twice, manual upgrade is required.")).toBeInTheDocument();
    await waitFor(() => {
      expect(panel.scrollWidth).toBeLessThanOrEqual(panel.clientWidth + 1);
      expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.clientWidth + 1);
      expect(actionBar.scrollWidth).toBeLessThanOrEqual(actionBar.clientWidth + 1);
      expect(statusBar.scrollWidth).toBeLessThanOrEqual(statusBar.clientWidth + 1);
    });
  }
}`,...B.parameters?.docs?.source}}};T.parameters={...T.parameters,docs:{...T.parameters?.docs,source:{originalSource:`{
  args: {
    messages: createRealSessionHistoryFixture().messages,
    cycles: [],
    sessionStateLabel: "Session running"
  },
  render: args => <div className="h-[760px] p-6">
      <ChatPanel {...args} />
    </div>,
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const viewport = await canvas.findByTestId("chat-scroll-viewport");
    await expect(canvas.getByText("Assistant reply 14: completed the visible conversation turn 14.")).toBeInTheDocument();
    await expect(viewport).toHaveClass("h-full");
    await expect(canvas.queryByText(/Cycle 14/i)).not.toBeInTheDocument();
    viewport.scrollTop = 0;
    fireEvent.scroll(viewport);
    await waitFor(() => {
      expect(canvas.getByAltText("briefing.png")).toBeInTheDocument();
    });
  }
}`,...T.parameters?.docs?.source}}};const Re=["ConversationFirstHistory","StreamingReply","MessageActionsOpenDevtools","LongPressShowsMessageActions","ActionableStoppedNotice","CompactConversationKeepsNavigationAndComposerStable","VirtualizedPersistedHistory"];export{w as ActionableStoppedNotice,B as CompactConversationKeepsNavigationAndComposerStable,d as ConversationFirstHistory,g as LongPressShowsMessageActions,h as MessageActionsOpenDevtools,y as StreamingReply,T as VirtualizedPersistedHistory,Re as __namedExportsOrder,Ae as default};
