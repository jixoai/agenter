import{j as o}from"./jsx-runtime-u17CrQMm.js";import{C as i}from"./ComposerStatusBar-BgkXM5tD.js";import"./iframe-BA9U4A2Q.js";import"./preload-helper-PPVm8Dsz.js";import"./dropdown-menu-B3aKSIUC.js";import"./utils-VtdL_sx5.js";import"./inline-affordance-BLl3bR6J.js";import"./chevron-right-BEfTCuPR.js";import"./index-DGd7USjR.js";import"./index-vzGptKfy.js";import"./popupStateMapping-CkY0FYKf.js";import"./useBaseUiId-7OVNNPuG.js";import"./owner-CK4ouegI.js";import"./stateAttributesMapping-BTajHoEL.js";import"./index-w1ompkCd.js";import"./useOpenInteractionType-DOymnJq-.js";import"./DirectionContext-5qgCtuu1.js";import"./useCompositeItem-u8z3oOTd.js";import"./floating-ui.utils-BMThB9Km.js";import"./composite-C55Tsz_h.js";import"./CompositeList-D94vPhhQ.js";import"./getDisabledMountTransitionStyles-DYKgFN9P.js";import"./tooltip-CiUFOqZ4.js";import"./loader-circle-BDXf0OYg.js";import"./image-plus-Dt0i74Vu.js";const{expect:t,userEvent:l,waitFor:m,within:s}=__STORYBOOK_MODULE_TEST__,K={title:"Features/Chat/ComposerStatusBar",component:i,args:{disabled:!1,submitting:!1,imageEnabled:!0,screenshotSupported:!0}},r={render:e=>o.jsx("div",{className:"w-[720px] bg-white p-6",children:o.jsx(i,{...e})}),play:async({canvasElement:e})=>{const a=s(e),n=a.getByTestId("composer-status-bar");await t(a.getByTestId("composer-local-status")).toHaveTextContent("Images and screenshots ready"),await t(s(n).getByText("path")).toBeInTheDocument(),await t(s(n).getByText("newline")).toBeInTheDocument(),await t(a.queryByRole("button",{name:"Composer help"})).not.toBeInTheDocument()}},p={render:e=>o.jsx("div",{className:"w-[375px] bg-white p-4",children:o.jsx(i,{...e})}),play:async({canvasElement:e})=>{const a=s(e),n=s(document.body);await m(()=>{t(a.queryByText("path")).not.toBeInTheDocument(),t(a.getByRole("button",{name:"Composer help"})).toHaveTextContent("?")}),await l.click(a.getByRole("button",{name:"Composer help"})),await m(()=>{t(n.getByText("Composer help")).toBeInTheDocument(),t(n.getByText("path")).toBeInTheDocument(),t(n.getByText("files")).toBeInTheDocument()})}},c={args:{submitting:!0},render:e=>o.jsx("div",{className:"w-[520px] bg-white p-4",children:o.jsx(i,{...e})}),play:async({canvasElement:e})=>{const a=s(e);await t(a.getByTestId("composer-local-status")).toHaveTextContent("Sending message")}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  render: args => <div className="w-[720px] bg-white p-6">
      <ComposerStatusBar {...args} />
    </div>,
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const statusBar = canvas.getByTestId("composer-status-bar");
    await expect(canvas.getByTestId("composer-local-status")).toHaveTextContent("Images and screenshots ready");
    await expect(within(statusBar).getByText("path")).toBeInTheDocument();
    await expect(within(statusBar).getByText("newline")).toBeInTheDocument();
    await expect(canvas.queryByRole("button", {
      name: "Composer help"
    })).not.toBeInTheDocument();
  }
}`,...r.parameters?.docs?.source}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  render: args => <div className="w-[375px] bg-white p-4">
      <ComposerStatusBar {...args} />
    </div>,
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const portal = within(document.body);
    await waitFor(() => {
      expect(canvas.queryByText("path")).not.toBeInTheDocument();
      expect(canvas.getByRole("button", {
        name: "Composer help"
      })).toHaveTextContent("?");
    });
    await userEvent.click(canvas.getByRole("button", {
      name: "Composer help"
    }));
    await waitFor(() => {
      expect(portal.getByText("Composer help")).toBeInTheDocument();
      expect(portal.getByText("path")).toBeInTheDocument();
      expect(portal.getByText("files")).toBeInTheDocument();
    });
  }
}`,...p.parameters?.docs?.source}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    submitting: true
  },
  render: args => <div className="w-[520px] bg-white p-4">
      <ComposerStatusBar {...args} />
    </div>,
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId("composer-local-status")).toHaveTextContent("Sending message");
  }
}`,...c.parameters?.docs?.source}}};const M=["WideStatusBarKeepsInlineHelp","CompactStatusBarCollapsesHelpIntoMenu","SubmittingStatusBarShowsBusySignal"];export{p as CompactStatusBarCollapsesHelpIntoMenu,c as SubmittingStatusBarShowsBusySignal,r as WideStatusBarKeepsInlineHelp,M as __namedExportsOrder,K as default};
