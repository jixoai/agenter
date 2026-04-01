import{j as s}from"./jsx-runtime-u17CrQMm.js";import{C as R,c as v}from"./real-session-history-fixture-nPeL_OLy.js";import{S as w}from"./SessionStatusPillMenu-COHekaIu.js";import{W as l,S as x}from"./WorkspaceShellFrame-Maw8hQJt.js";import"./iframe-BA9U4A2Q.js";import"./preload-helper-PPVm8Dsz.js";import"./AIInput-DKraBPL5.js";import"./inline-affordance-BLl3bR6J.js";import"./utils-VtdL_sx5.js";import"./index-MMW-HMpx.js";import"./AIInputPendingAssets-B_LfGE5Q.js";import"./overflow-surface-Cav6wYq5.js";import"./x-DMkXTevi.js";import"./video-Cv162eWI.js";import"./dialog-CvvgVQqk.js";import"./DialogTitle-sL7T0N-8.js";import"./useBaseUiId-7OVNNPuG.js";import"./popupStateMapping-CkY0FYKf.js";import"./index-DGd7USjR.js";import"./index-vzGptKfy.js";import"./owner-CK4ouegI.js";import"./stateAttributesMapping-BTajHoEL.js";import"./index-w1ompkCd.js";import"./composite-C55Tsz_h.js";import"./useOpenInteractionType-DOymnJq-.js";import"./AIInputToolbar-CeUr_Lvu.js";import"./ComposerActionBar-iiPo3j8t.js";import"./adaptive-icon-button-CQ5eDh91.js";import"./button-2keny9to.js";import"./tooltip-CiUFOqZ4.js";import"./getDisabledMountTransitionStyles-DYKgFN9P.js";import"./floating-ui.utils-BMThB9Km.js";import"./DirectionContext-5qgCtuu1.js";import"./image-plus-Dt0i74Vu.js";import"./loader-circle-BDXf0OYg.js";import"./ComposerStatusBar-BgkXM5tD.js";import"./dropdown-menu-B3aKSIUC.js";import"./chevron-right-BEfTCuPR.js";import"./useCompositeItem-u8z3oOTd.js";import"./CompositeList-D94vPhhQ.js";import"./virtualizer-DwzOHpwu.js";import"./ChatConversationRows-BP_Rleh6.js";import"./profile-image-DCTEHzfl.js";import"./tool-structured-view-Be99XAPJ.js";import"./AssistantMarkdown-BRd3mpcZ.js";import"./accordion-CbxGKyEs.js";import"./chevron-down-Da227ukw.js";import"./isElementDisabled-DAIqf-Ux.js";import"./ChatAttachmentStrip-CNmJgMJl.js";import"./ellipsis-D8eZY63e.js";import"./triangle-alert-DpleOF06.js";import"./sparkles-D7ne4up4.js";import"./cycle-facts-BEtDU-MN.js";import"./square-BrHEXLLO.js";import"./TopHeader-Bt08K1Oy.js";import"./tabs-BaIc53z-.js";import"./surface-CTeFSOED.js";import"./StatusSignal-Bit7BTh5.js";const{expect:e,waitFor:d,within:n}=__STORYBOOK_MODULE_TEST__,I=v({turns:10,unreadCount:2}),B=o=>t=>s.jsx(x,{value:{showNavigationTrigger:o.compact,connectionStatus:"connected",aiStatus:o.compact?"ready":"working",onOpenNavigation:()=>{}},children:s.jsx("div",{className:`bg-slate-100 ${o.heightClassName} ${o.widthClassName}`,"data-testid":"chat-route-assembly-root",children:s.jsx(l,{workspacePath:t.workspacePath,activeTab:t.activeTab,onNavigate:()=>{},children:s.jsx(R,{workspacePath:t.workspacePath,messages:I.messages,cycles:[],aiStatus:"idle",sessionStateLabel:"Session running",statusSlot:s.jsx(w,{statusLabel:"Session running",tone:"active",primaryActionLabel:"Stop session",onPrimaryAction:()=>{},onAbort:()=>{}}),disabled:!1,imageEnabled:!0,imageCompatible:!0,onSubmit:async()=>{}})})})}),Et={title:"Features/Shell/ChatRouteAssembly",component:l,args:{workspacePath:"/repo/demo/project-alpha",activeTab:"chat"}},i={render:B({widthClassName:"w-[1180px]",heightClassName:"h-[860px]",compact:!1}),play:async({canvasElement:o})=>{const t=n(o),c=t.getByTestId("top-header"),a=t.getByTestId("chat-route-assembly-root"),r=t.getByRole("button",{name:"Attach"}),m=t.getByTestId("composer-action-bar"),h=t.getByTestId("composer-status-bar");await e(n(c).queryByRole("button",{name:/Session status:/i})).not.toBeInTheDocument(),await e(t.getByRole("button",{name:"Session status: Session running"})).toBeInTheDocument(),await e(t.getByTestId("workspace-basename-chip")).toHaveTextContent("project-alpha"),await e(t.getByTestId("workspace-basename-chip")).toHaveAttribute("title","/repo/demo/project-alpha"),await e(n(r).getByText("Attach")).toBeInTheDocument(),await d(()=>{e(a.scrollWidth).toBeLessThanOrEqual(a.clientWidth+1),e(m.getBoundingClientRect().height).toBeGreaterThan(h.getBoundingClientRect().height)})}},p={render:B({widthClassName:"w-[375px]",heightClassName:"h-[667px]",compact:!0}),play:async({canvasElement:o})=>{const t=n(o),c=t.getByTestId("top-header"),a=t.getByTestId("chat-route-assembly-root"),r=t.getByRole("button",{name:"Attach"}),m=t.getByRole("button",{name:"Screenshot"}),h=t.getByRole("button",{name:"Send"}),g=t.getByTestId("composer-action-bar"),y=t.getByTestId("composer-status-bar");await d(()=>{const T=r.getBoundingClientRect(),u=m.getBoundingClientRect(),b=h.getBoundingClientRect();e(n(c).queryByRole("button",{name:/Session status:/i})).not.toBeInTheDocument(),e(t.getByRole("button",{name:"Session status: Session running"})).toBeInTheDocument(),e(t.getByRole("button",{name:"Open navigation"})).toBeInTheDocument(),e(n(c).queryByTestId("workspace-basename-chip")).not.toBeInTheDocument(),e(t.getByLabelText("Workspace /repo/demo/project-alpha")).toBeInTheDocument(),e(t.getByTestId("composer-local-status")).toHaveTextContent("Images and screenshots ready"),e(Math.abs(T.top-u.top)).toBeLessThanOrEqual(1),e(Math.abs(b.top-u.top)).toBeLessThanOrEqual(2),e(a.scrollWidth).toBeLessThanOrEqual(a.clientWidth+1),e(g.getBoundingClientRect().height).toBeGreaterThan(y.getBoundingClientRect().height)}),await e(n(r).getByText("Attach")).toBeInTheDocument()}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  render: buildRouteStory({
    widthClassName: "w-[1180px]",
    heightClassName: "h-[860px]",
    compact: false
  }),
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const header = canvas.getByTestId("top-header");
    const root = canvas.getByTestId("chat-route-assembly-root");
    const attachButton = canvas.getByRole("button", {
      name: "Attach"
    });
    const actionBar = canvas.getByTestId("composer-action-bar");
    const statusBar = canvas.getByTestId("composer-status-bar");
    await expect(within(header).queryByRole("button", {
      name: /Session status:/i
    })).not.toBeInTheDocument();
    await expect(canvas.getByRole("button", {
      name: "Session status: Session running"
    })).toBeInTheDocument();
    await expect(canvas.getByTestId("workspace-basename-chip")).toHaveTextContent("project-alpha");
    await expect(canvas.getByTestId("workspace-basename-chip")).toHaveAttribute("title", "/repo/demo/project-alpha");
    await expect(within(attachButton).getByText("Attach")).toBeInTheDocument();
    await waitFor(() => {
      expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth + 1);
      expect(actionBar.getBoundingClientRect().height).toBeGreaterThan(statusBar.getBoundingClientRect().height);
    });
  }
}`,...i.parameters?.docs?.source}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  render: buildRouteStory({
    widthClassName: "w-[375px]",
    heightClassName: "h-[667px]",
    compact: true
  }),
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const header = canvas.getByTestId("top-header");
    const root = canvas.getByTestId("chat-route-assembly-root");
    const attachButton = canvas.getByRole("button", {
      name: "Attach"
    });
    const screenshotButton = canvas.getByRole("button", {
      name: "Screenshot"
    });
    const sendButton = canvas.getByRole("button", {
      name: "Send"
    });
    const actionBar = canvas.getByTestId("composer-action-bar");
    const statusBar = canvas.getByTestId("composer-status-bar");
    await waitFor(() => {
      const attachRect = attachButton.getBoundingClientRect();
      const screenshotRect = screenshotButton.getBoundingClientRect();
      const sendRect = sendButton.getBoundingClientRect();
      expect(within(header).queryByRole("button", {
        name: /Session status:/i
      })).not.toBeInTheDocument();
      expect(canvas.getByRole("button", {
        name: "Session status: Session running"
      })).toBeInTheDocument();
      expect(canvas.getByRole("button", {
        name: "Open navigation"
      })).toBeInTheDocument();
      expect(within(header).queryByTestId("workspace-basename-chip")).not.toBeInTheDocument();
      expect(canvas.getByLabelText("Workspace /repo/demo/project-alpha")).toBeInTheDocument();
      expect(canvas.getByTestId("composer-local-status")).toHaveTextContent("Images and screenshots ready");
      expect(Math.abs(attachRect.top - screenshotRect.top)).toBeLessThanOrEqual(1);
      expect(Math.abs(sendRect.top - screenshotRect.top)).toBeLessThanOrEqual(2);
      expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth + 1);
      expect(actionBar.getBoundingClientRect().height).toBeGreaterThan(statusBar.getBoundingClientRect().height);
    });
    await expect(within(attachButton).getByText("Attach")).toBeInTheDocument();
  }
}`,...p.parameters?.docs?.source}}};const Lt=["DesktopRouteKeepsPassiveHeaderAndRouteLocalStatus","CompactRouteCollapsesSecondaryChromeFirst"];export{p as CompactRouteCollapsesSecondaryChromeFirst,i as DesktopRouteKeepsPassiveHeaderAndRouteLocalStatus,Lt as __namedExportsOrder,Et as default};
