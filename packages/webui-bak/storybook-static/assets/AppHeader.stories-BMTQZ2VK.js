import{j as l}from"./jsx-runtime-u17CrQMm.js";import{T as m}from"./TopHeader-Bt08K1Oy.js";import"./iframe-BA9U4A2Q.js";import"./preload-helper-PPVm8Dsz.js";import"./tabs-BaIc53z-.js";import"./utils-VtdL_sx5.js";import"./isElementDisabled-DAIqf-Ux.js";import"./useBaseUiId-7OVNNPuG.js";import"./CompositeList-D94vPhhQ.js";import"./DirectionContext-5qgCtuu1.js";import"./composite-C55Tsz_h.js";import"./useCompositeItem-u8z3oOTd.js";import"./floating-ui.utils-BMThB9Km.js";import"./owner-CK4ouegI.js";import"./tooltip-CiUFOqZ4.js";import"./index-DGd7USjR.js";import"./index-vzGptKfy.js";import"./popupStateMapping-CkY0FYKf.js";import"./stateAttributesMapping-BTajHoEL.js";import"./index-w1ompkCd.js";import"./getDisabledMountTransitionStyles-DYKgFN9P.js";import"./surface-CTeFSOED.js";import"./button-2keny9to.js";import"./inline-affordance-BLl3bR6J.js";import"./StatusSignal-Bit7BTh5.js";import"./triangle-alert-DpleOF06.js";import"./loader-circle-BDXf0OYg.js";const{expect:e,fn:g,userEvent:h,within:o}=__STORYBOOK_MODULE_TEST__,G={title:"Features/Shell/TopHeader",component:m,args:{locationLabel:"Chat",showNavigationTrigger:!1,connectionStatus:"connected",aiStatus:"working",onOpenNavigation:g()},render:t=>l.jsx("div",{className:"w-[800px] p-6",children:l.jsx(m,{...t})})},s={args:{},play:async({canvasElement:t})=>{const a=o(t);await e(a.getByText("agenter")).toBeInTheDocument(),await e(a.getByText("Chat")).toBeInTheDocument(),await e(a.getByLabelText("Connected")).toBeInTheDocument(),await e(a.getByLabelText("AI working")).toBeInTheDocument(),await e(a.queryByRole("button",{name:"Open global settings"})).not.toBeInTheDocument()}},c={args:{showNavigationTrigger:!0,aiStatus:null},render:t=>l.jsx("div",{className:"w-[320px] p-4","data-testid":"compact-top-header-shell",children:l.jsx(m,{...t})}),play:async({args:t,canvasElement:a})=>{const n=o(a),u=n.getByTestId("compact-top-header-shell");await e(n.getByRole("button",{name:"Open navigation"})).toBeInTheDocument(),await e(n.queryByLabelText(/AI /)).not.toBeInTheDocument(),await e(u.scrollWidth).toBeLessThanOrEqual(u.clientWidth+1),await e(t.onOpenNavigation).not.toHaveBeenCalled()}},r={args:{locationLabel:"Workspace",workspace:{workspacePath:"/repo/demo/project-alpha",activeTab:"chat",onNavigate:g()}},play:async({args:t,canvasElement:a})=>{const n=o(a);await e(n.getByText("project-alpha")).toBeInTheDocument(),await e(n.queryByText("/repo/demo/project-alpha")).not.toBeInTheDocument(),await e(n.getByTitle("/repo/demo/project-alpha")).toBeInTheDocument(),await e(n.getByRole("tab",{name:"Chat"})).toBeInTheDocument(),await e(n.queryByRole("button",{name:"Start"})).not.toBeInTheDocument(),await h.click(n.getByRole("tab",{name:"Devtools"})),await e(t.workspace?.onNavigate).toHaveBeenCalledWith("devtools"),await e(n.queryByRole("button",{name:"Global Settings"})).not.toBeInTheDocument()}},i={args:{connectionStatus:"offline",aiStatus:null},play:async({canvasElement:t})=>{const a=o(t);await e(a.getByLabelText("Offline")).toBeInTheDocument()}},p={args:{connectionStatus:"reconnecting",aiStatus:null},play:async({canvasElement:t})=>{const a=o(t);await e(a.getByLabelText("Reconnecting")).toBeInTheDocument()}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {},
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("agenter")).toBeInTheDocument();
    await expect(canvas.getByText("Chat")).toBeInTheDocument();
    await expect(canvas.getByLabelText("Connected")).toBeInTheDocument();
    await expect(canvas.getByLabelText("AI working")).toBeInTheDocument();
    await expect(canvas.queryByRole("button", {
      name: "Open global settings"
    })).not.toBeInTheDocument();
  }
}`,...s.parameters?.docs?.source}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    showNavigationTrigger: true,
    aiStatus: null
  },
  render: args => <div className="w-[320px] p-4" data-testid="compact-top-header-shell">
      <TopHeader {...args} />
    </div>,
  play: async ({
    args,
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const shell = canvas.getByTestId("compact-top-header-shell");
    await expect(canvas.getByRole("button", {
      name: "Open navigation"
    })).toBeInTheDocument();
    await expect(canvas.queryByLabelText(/AI /)).not.toBeInTheDocument();
    await expect(shell.scrollWidth).toBeLessThanOrEqual(shell.clientWidth + 1);
    await expect(args.onOpenNavigation).not.toHaveBeenCalled();
  }
}`,...c.parameters?.docs?.source}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    locationLabel: "Workspace",
    workspace: {
      workspacePath: "/repo/demo/project-alpha",
      activeTab: "chat",
      onNavigate: fn()
    }
  },
  play: async ({
    args,
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("project-alpha")).toBeInTheDocument();
    await expect(canvas.queryByText("/repo/demo/project-alpha")).not.toBeInTheDocument();
    await expect(canvas.getByTitle("/repo/demo/project-alpha")).toBeInTheDocument();
    await expect(canvas.getByRole("tab", {
      name: "Chat"
    })).toBeInTheDocument();
    await expect(canvas.queryByRole("button", {
      name: "Start"
    })).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("tab", {
      name: "Devtools"
    }));
    await expect(args.workspace?.onNavigate).toHaveBeenCalledWith("devtools");
    await expect(canvas.queryByRole("button", {
      name: "Global Settings"
    })).not.toBeInTheDocument();
  }
}`,...r.parameters?.docs?.source}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    connectionStatus: "offline",
    aiStatus: null
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByLabelText("Offline")).toBeInTheDocument();
  }
}`,...i.parameters?.docs?.source}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    connectionStatus: "reconnecting",
    aiStatus: null
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByLabelText("Reconnecting")).toBeInTheDocument();
  }
}`,...p.parameters?.docs?.source}}};const F=["PassiveDesktopHeader","CompactHeaderKeepsOnlyNavigationTrigger","WorkspaceHeaderKeepsTabsAndBasenameOnly","OfflineHeaderShowsTransportState","ReconnectingHeaderShowsTransportState"];export{c as CompactHeaderKeepsOnlyNavigationTrigger,i as OfflineHeaderShowsTransportState,s as PassiveDesktopHeader,p as ReconnectingHeaderShowsTransportState,r as WorkspaceHeaderKeepsTabsAndBasenameOnly,F as __namedExportsOrder,G as default};
