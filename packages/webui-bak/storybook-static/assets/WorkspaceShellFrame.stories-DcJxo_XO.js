import{j as o}from"./jsx-runtime-u17CrQMm.js";import{r as d}from"./iframe-BA9U4A2Q.js";import{W as p,S as g}from"./WorkspaceShellFrame-Maw8hQJt.js";import"./preload-helper-PPVm8Dsz.js";import"./overflow-surface-Cav6wYq5.js";import"./utils-VtdL_sx5.js";import"./TopHeader-Bt08K1Oy.js";import"./tabs-BaIc53z-.js";import"./isElementDisabled-DAIqf-Ux.js";import"./useBaseUiId-7OVNNPuG.js";import"./CompositeList-D94vPhhQ.js";import"./DirectionContext-5qgCtuu1.js";import"./composite-C55Tsz_h.js";import"./useCompositeItem-u8z3oOTd.js";import"./floating-ui.utils-BMThB9Km.js";import"./owner-CK4ouegI.js";import"./tooltip-CiUFOqZ4.js";import"./index-DGd7USjR.js";import"./index-vzGptKfy.js";import"./popupStateMapping-CkY0FYKf.js";import"./stateAttributesMapping-BTajHoEL.js";import"./index-w1ompkCd.js";import"./getDisabledMountTransitionStyles-DYKgFN9P.js";import"./surface-CTeFSOED.js";import"./button-2keny9to.js";import"./inline-affordance-BLl3bR6J.js";import"./StatusSignal-Bit7BTh5.js";import"./triangle-alert-DpleOF06.js";import"./loader-circle-BDXf0OYg.js";const{expect:t,fn:m,userEvent:i,within:h}=__STORYBOOK_MODULE_TEST__,v=(a=!1)=>n=>{const[e,s]=d.useState(n.activeTab);return o.jsx(g,{value:{showNavigationTrigger:a,connectionStatus:"connected",aiStatus:a?"ready":"working",onOpenNavigation:m()},children:o.jsx("div",{className:a?"w-[320px] bg-slate-100":"h-[860px] p-6","data-testid":a?"compact-workspace-shell":void 0,children:o.jsx(p,{...n,activeTab:e,onNavigate:l=>{s(l),n.onNavigate(l)}})})})},Y={title:"Features/Shell/WorkspaceShellFrame",component:p,args:{workspacePath:"/repo/demo/project-alpha",activeTab:"chat",onNavigate:m(),children:o.jsx("section",{className:"flex h-full items-center justify-center rounded-2xl bg-white p-4 shadow-sm",children:o.jsx("p",{className:"text-sm text-slate-600",children:"Workspace body"})})}},c={render:v(!1),play:async({args:a,canvasElement:n})=>{const e=h(n);await t(e.getByText("project-alpha")).toBeInTheDocument(),await t(e.queryByText("/repo/demo/project-alpha")).not.toBeInTheDocument(),await t(e.getByRole("tab",{name:"Chat"})).toBeInTheDocument(),await i.click(e.getByRole("tab",{name:"Devtools"})),await i.click(e.getByRole("tab",{name:"Settings"})),await i.click(e.getByRole("tab",{name:"Chat"})),await t(a.onNavigate).toHaveBeenNthCalledWith(1,"devtools"),await t(a.onNavigate).toHaveBeenNthCalledWith(2,"settings"),await t(a.onNavigate).toHaveBeenNthCalledWith(3,"chat")}},r={render:v(!0),play:async({args:a,canvasElement:n})=>{const e=h(n),s=e.getByTestId("compact-workspace-shell");await t(e.getByRole("button",{name:"Open navigation"})).toBeInTheDocument(),await t(e.queryByTestId("workspace-basename-chip")).not.toBeInTheDocument(),await t(e.getByLabelText("Workspace /repo/demo/project-alpha")).toBeInTheDocument(),await t(e.getByRole("tab",{name:"Chat"})).toBeInTheDocument(),await t(s.scrollWidth).toBeLessThanOrEqual(s.clientWidth+1),await i.click(e.getByRole("tab",{name:"Devtools"})),await i.click(e.getByRole("tab",{name:"Settings"})),await t(a.onNavigate).toHaveBeenNthCalledWith(1,"devtools"),await t(a.onNavigate).toHaveBeenNthCalledWith(2,"settings")}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  render: renderFrame(false),
  play: async ({
    args,
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("project-alpha")).toBeInTheDocument();
    await expect(canvas.queryByText("/repo/demo/project-alpha")).not.toBeInTheDocument();
    await expect(canvas.getByRole("tab", {
      name: "Chat"
    })).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("tab", {
      name: "Devtools"
    }));
    await userEvent.click(canvas.getByRole("tab", {
      name: "Settings"
    }));
    await userEvent.click(canvas.getByRole("tab", {
      name: "Chat"
    }));
    await expect(args.onNavigate).toHaveBeenNthCalledWith(1, "devtools");
    await expect(args.onNavigate).toHaveBeenNthCalledWith(2, "settings");
    await expect(args.onNavigate).toHaveBeenNthCalledWith(3, "chat");
  }
}`,...c.parameters?.docs?.source}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  render: renderFrame(true),
  play: async ({
    args,
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const shell = canvas.getByTestId("compact-workspace-shell");
    await expect(canvas.getByRole("button", {
      name: "Open navigation"
    })).toBeInTheDocument();
    await expect(canvas.queryByTestId("workspace-basename-chip")).not.toBeInTheDocument();
    await expect(canvas.getByLabelText("Workspace /repo/demo/project-alpha")).toBeInTheDocument();
    await expect(canvas.getByRole("tab", {
      name: "Chat"
    })).toBeInTheDocument();
    await expect(shell.scrollWidth).toBeLessThanOrEqual(shell.clientWidth + 1);
    await userEvent.click(canvas.getByRole("tab", {
      name: "Devtools"
    }));
    await userEvent.click(canvas.getByRole("tab", {
      name: "Settings"
    }));
    await expect(args.onNavigate).toHaveBeenNthCalledWith(1, "devtools");
    await expect(args.onNavigate).toHaveBeenNthCalledWith(2, "settings");
  }
}`,...r.parameters?.docs?.source}}};const z=["SwitchTabsWithinUnifiedTopHeader","CompactShellStillKeepsTopTabs"];export{r as CompactShellStillKeepsTopTabs,c as SwitchTabsWithinUnifiedTopHeader,z as __namedExportsOrder,Y as default};
