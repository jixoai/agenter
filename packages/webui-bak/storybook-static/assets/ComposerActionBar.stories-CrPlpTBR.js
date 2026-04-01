import{j as l}from"./jsx-runtime-u17CrQMm.js";import{r as R}from"./iframe-BA9U4A2Q.js";import{C as d}from"./ComposerActionBar-iiPo3j8t.js";import"./preload-helper-PPVm8Dsz.js";import"./adaptive-icon-button-CQ5eDh91.js";import"./utils-VtdL_sx5.js";import"./button-2keny9to.js";import"./inline-affordance-BLl3bR6J.js";import"./tooltip-CiUFOqZ4.js";import"./useBaseUiId-7OVNNPuG.js";import"./index-DGd7USjR.js";import"./index-vzGptKfy.js";import"./popupStateMapping-CkY0FYKf.js";import"./owner-CK4ouegI.js";import"./stateAttributesMapping-BTajHoEL.js";import"./index-w1ompkCd.js";import"./getDisabledMountTransitionStyles-DYKgFN9P.js";import"./floating-ui.utils-BMThB9Km.js";import"./DirectionContext-5qgCtuu1.js";import"./image-plus-Dt0i74Vu.js";import"./loader-circle-BDXf0OYg.js";const{expect:t,fn:h,userEvent:u,waitFor:g,within:o}=__STORYBOOK_MODULE_TEST__,T=n=>c=>{const e=R.useRef(null);return l.jsx("div",{className:`bg-white p-6 ${n}`,children:l.jsx(d,{...c,fileInputRef:e})})},N={title:"Features/Chat/ComposerActionBar",component:d,args:{disabled:!1,submitting:!1,canSubmit:!0,imageEnabled:!0,screenshotSupported:!0,submitLabel:"Send",onFileInputChange:h(),onCaptureScreenshot:h(),onSubmit:h()}},i={render:T("w-[720px]"),play:async({args:n,canvasElement:c})=>{const e=o(c),m=e.getByTestId("composer-action-bar"),r=e.getByRole("button",{name:"Attach"}),a=e.getByRole("button",{name:"Screenshot"}),s=e.getByRole("button",{name:"Send"});await g(()=>{const w=r.getBoundingClientRect(),p=a.getBoundingClientRect(),y=s.getBoundingClientRect();t(Math.abs(w.top-p.top)).toBeLessThanOrEqual(1),t(Math.abs(y.top-p.top)).toBeLessThanOrEqual(2),t(m.getBoundingClientRect().height).toBeLessThan(64)}),await t(o(r).getByText("Attach")).toBeInTheDocument(),await t(o(a).getByText("Screenshot")).toBeInTheDocument(),await u.click(a),await u.click(s),await t(n.onCaptureScreenshot).toHaveBeenCalledTimes(1),await t(n.onSubmit).toHaveBeenCalledTimes(1)}},B={render:T("w-[320px]"),play:async({args:n,canvasElement:c})=>{const e=o(c),m=e.getByTestId("composer-action-bar"),r=e.getByRole("button",{name:"Attach"}),a=e.getByRole("button",{name:"Screenshot"}),s=e.getByRole("button",{name:"Send"});await g(()=>{t(o(r).queryByText("Attach")).not.toBeInTheDocument(),t(o(a).queryByText("Screenshot")).not.toBeInTheDocument(),t(o(s).getByText("Send")).toBeInTheDocument(),t(m.getBoundingClientRect().height).toBeLessThan(64)}),await u.click(a),await u.click(s),await t(n.onCaptureScreenshot).toHaveBeenCalledTimes(1),await t(n.onSubmit).toHaveBeenCalledTimes(1)}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  render: renderActionBar("w-[720px]"),
  play: async ({
    args,
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const actionBar = canvas.getByTestId("composer-action-bar");
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
      const attachRect = attachButton.getBoundingClientRect();
      const screenshotRect = screenshotButton.getBoundingClientRect();
      const sendRect = sendButton.getBoundingClientRect();
      expect(Math.abs(attachRect.top - screenshotRect.top)).toBeLessThanOrEqual(1);
      expect(Math.abs(sendRect.top - screenshotRect.top)).toBeLessThanOrEqual(2);
      expect(actionBar.getBoundingClientRect().height).toBeLessThan(64);
    });
    await expect(within(attachButton).getByText("Attach")).toBeInTheDocument();
    await expect(within(screenshotButton).getByText("Screenshot")).toBeInTheDocument();
    await userEvent.click(screenshotButton);
    await userEvent.click(sendButton);
    await expect(args.onCaptureScreenshot).toHaveBeenCalledTimes(1);
    await expect(args.onSubmit).toHaveBeenCalledTimes(1);
  }
}`,...i.parameters?.docs?.source}}};B.parameters={...B.parameters,docs:{...B.parameters?.docs,source:{originalSource:`{
  render: renderActionBar("w-[320px]"),
  play: async ({
    args,
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const actionBar = canvas.getByTestId("composer-action-bar");
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
      expect(within(attachButton).queryByText("Attach")).not.toBeInTheDocument();
      expect(within(screenshotButton).queryByText("Screenshot")).not.toBeInTheDocument();
      expect(within(sendButton).getByText("Send")).toBeInTheDocument();
      expect(actionBar.getBoundingClientRect().height).toBeLessThan(64);
    });
    await userEvent.click(screenshotButton);
    await userEvent.click(sendButton);
    await expect(args.onCaptureScreenshot).toHaveBeenCalledTimes(1);
    await expect(args.onSubmit).toHaveBeenCalledTimes(1);
  }
}`,...B.parameters?.docs?.source}}};const U=["WideActionBarKeepsLabelsOnOneRow","CompactActionBarCollapsesSecondaryLabels"];export{B as CompactActionBarCollapsesSecondaryLabels,i as WideActionBarKeepsLabelsOnOneRow,U as __namedExportsOrder,N as default};
