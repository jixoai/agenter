import{j as T}from"./jsx-runtime-u17CrQMm.js";import{r as R}from"./iframe-BA9U4A2Q.js";import{A as y}from"./AIInputToolbar-CeUr_Lvu.js";import"./preload-helper-PPVm8Dsz.js";import"./ComposerActionBar-iiPo3j8t.js";import"./adaptive-icon-button-CQ5eDh91.js";import"./utils-VtdL_sx5.js";import"./button-2keny9to.js";import"./inline-affordance-BLl3bR6J.js";import"./tooltip-CiUFOqZ4.js";import"./useBaseUiId-7OVNNPuG.js";import"./index-DGd7USjR.js";import"./index-vzGptKfy.js";import"./popupStateMapping-CkY0FYKf.js";import"./owner-CK4ouegI.js";import"./stateAttributesMapping-BTajHoEL.js";import"./index-w1ompkCd.js";import"./getDisabledMountTransitionStyles-DYKgFN9P.js";import"./floating-ui.utils-BMThB9Km.js";import"./DirectionContext-5qgCtuu1.js";import"./image-plus-Dt0i74Vu.js";import"./loader-circle-BDXf0OYg.js";import"./ComposerStatusBar-BgkXM5tD.js";import"./dropdown-menu-B3aKSIUC.js";import"./chevron-right-BEfTCuPR.js";import"./useOpenInteractionType-DOymnJq-.js";import"./useCompositeItem-u8z3oOTd.js";import"./composite-C55Tsz_h.js";import"./CompositeList-D94vPhhQ.js";const{expect:t,fn:h,userEvent:w,waitFor:g,within:n}=__STORYBOOK_MODULE_TEST__,x=s=>e=>{const c=R.useRef(null);return T.jsx("div",{className:`bg-white p-6 ${s}`,children:T.jsx(y,{...e,fileInputRef:c})})},X={title:"Features/Chat/AIInputToolbar",component:y,args:{disabled:!1,submitting:!1,canSubmit:!0,imageEnabled:!0,screenshotSupported:!0,submitLabel:"Send",onFileInputChange:h(),onCaptureScreenshot:h(),onSubmit:h()}},p={args:{},render:x("w-[720px]"),play:async({canvasElement:s})=>{const e=n(s),c=e.getByTestId("composer-action-bar"),o=e.getByTestId("composer-status-bar"),i=e.getByRole("button",{name:"Attach"}),u=e.getByRole("button",{name:"Screenshot"}),m=e.getByRole("button",{name:"Send"});await g(()=>{const r=c.getBoundingClientRect(),a=o.getBoundingClientRect(),B=i.getBoundingClientRect(),d=u.getBoundingClientRect(),b=m.getBoundingClientRect();t(r.height).toBeGreaterThan(a.height),t(Math.abs(B.top-d.top)).toBeLessThanOrEqual(1),t(Math.abs(b.top-d.top)).toBeLessThanOrEqual(2)}),await t(n(i).getByText("Attach")).toBeInTheDocument(),await t(n(u).getByText("Screenshot")).toBeInTheDocument(),await t(n(o).getByText("Images and screenshots ready")).toBeInTheDocument(),await t(n(o).getByText("path")).toBeInTheDocument(),await t(n(o).getByText("newline")).toBeInTheDocument(),await t(e.queryByRole("button",{name:"Composer help"})).not.toBeInTheDocument()}},l={args:{},render:x("w-[320px]"),play:async({canvasElement:s})=>{const e=n(s),c=n(document.body),o=e.getByTestId("composer-action-bar"),i=e.getByTestId("composer-status-bar"),u=e.getByRole("button",{name:"Attach"}),m=e.getByRole("button",{name:"Screenshot"});await g(()=>{t(n(u).queryByText("Attach")).not.toBeInTheDocument(),t(n(m).queryByText("Screenshot")).not.toBeInTheDocument(),t(o.getBoundingClientRect().height).toBeGreaterThan(i.getBoundingClientRect().height)}),await t(e.getByTestId("composer-local-status")).toHaveTextContent("Images and screenshots ready"),await t(e.queryAllByText("path").some(a=>a instanceof HTMLElement&&a.offsetParent!==null)).toBe(!1),await t(e.getByRole("button",{name:"Composer help"})).toHaveTextContent("?"),await t(e.getByRole("button",{name:"Send"})).toBeInTheDocument(),await w.click(e.getByRole("button",{name:"Composer help"}));const r=a=>c.getAllByText(a).some(B=>B instanceof HTMLElement&&B.offsetParent!==null);await g(()=>{t(r("path")).toBe(!0),t(r("send")).toBe(!0),t(r("files")).toBe(!0)})}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {},
  render: renderToolbar("w-[720px]"),
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const actionBar = canvas.getByTestId("composer-action-bar");
    const statusBar = canvas.getByTestId("composer-status-bar");
    const attachButton = canvas.getByRole("button", {
      name: "Attach"
    });
    const screenshotButton = canvas.getByRole("button", {
      name: "Screenshot"
    });
    const sendButton = canvas.getByRole("button", {
      name: "Send"
    });
    await waitFor(() => {
      const actionRect = actionBar.getBoundingClientRect();
      const statusRect = statusBar.getBoundingClientRect();
      const attachRect = attachButton.getBoundingClientRect();
      const screenshotRect = screenshotButton.getBoundingClientRect();
      const sendRect = sendButton.getBoundingClientRect();
      expect(actionRect.height).toBeGreaterThan(statusRect.height);
      expect(Math.abs(attachRect.top - screenshotRect.top)).toBeLessThanOrEqual(1);
      expect(Math.abs(sendRect.top - screenshotRect.top)).toBeLessThanOrEqual(2);
    });
    await expect(within(attachButton).getByText("Attach")).toBeInTheDocument();
    await expect(within(screenshotButton).getByText("Screenshot")).toBeInTheDocument();
    await expect(within(statusBar).getByText("Images and screenshots ready")).toBeInTheDocument();
    await expect(within(statusBar).getByText("path")).toBeInTheDocument();
    await expect(within(statusBar).getByText("newline")).toBeInTheDocument();
    await expect(canvas.queryByRole("button", {
      name: "Composer help"
    })).not.toBeInTheDocument();
  }
}`,...p.parameters?.docs?.source}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {},
  render: renderToolbar("w-[320px]"),
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const portal = within(document.body);
    const actionBar = canvas.getByTestId("composer-action-bar");
    const statusBar = canvas.getByTestId("composer-status-bar");
    const attachButton = canvas.getByRole("button", {
      name: "Attach"
    });
    const screenshotButton = canvas.getByRole("button", {
      name: "Screenshot"
    });
    await waitFor(() => {
      expect(within(attachButton).queryByText("Attach")).not.toBeInTheDocument();
      expect(within(screenshotButton).queryByText("Screenshot")).not.toBeInTheDocument();
      expect(actionBar.getBoundingClientRect().height).toBeGreaterThan(statusBar.getBoundingClientRect().height);
    });
    await expect(canvas.getByTestId("composer-local-status")).toHaveTextContent("Images and screenshots ready");
    await expect(canvas.queryAllByText("path").some(node => node instanceof HTMLElement && node.offsetParent !== null)).toBe(false);
    await expect(canvas.getByRole("button", {
      name: "Composer help"
    })).toHaveTextContent("?");
    await expect(canvas.getByRole("button", {
      name: "Send"
    })).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", {
      name: "Composer help"
    }));
    const hasVisibleText = (text: string) => portal.getAllByText(text).some(node => node instanceof HTMLElement && node.offsetParent !== null);
    await waitFor(() => {
      expect(hasVisibleText("path")).toBe(true);
      expect(hasVisibleText("send")).toBe(true);
      expect(hasVisibleText("files")).toBe(true);
    });
  }
}`,...l.parameters?.docs?.source}}};const Z=["WideToolbarKeepsLabelsAndHints","CompactToolbarCollapsesHelpAndSecondaryLabels"];export{l as CompactToolbarCollapsesHelpAndSecondaryLabels,p as WideToolbarKeepsLabelsAndHints,Z as __namedExportsOrder,X as default};
