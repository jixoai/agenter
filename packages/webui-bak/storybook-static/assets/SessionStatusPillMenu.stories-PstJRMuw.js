import{j as u}from"./jsx-runtime-u17CrQMm.js";import{S as p}from"./SessionStatusPillMenu-COHekaIu.js";import"./button-2keny9to.js";import"./inline-affordance-BLl3bR6J.js";import"./utils-VtdL_sx5.js";import"./iframe-BA9U4A2Q.js";import"./preload-helper-PPVm8Dsz.js";import"./dropdown-menu-B3aKSIUC.js";import"./chevron-right-BEfTCuPR.js";import"./index-DGd7USjR.js";import"./index-vzGptKfy.js";import"./popupStateMapping-CkY0FYKf.js";import"./useBaseUiId-7OVNNPuG.js";import"./owner-CK4ouegI.js";import"./stateAttributesMapping-BTajHoEL.js";import"./index-w1ompkCd.js";import"./useOpenInteractionType-DOymnJq-.js";import"./DirectionContext-5qgCtuu1.js";import"./useCompositeItem-u8z3oOTd.js";import"./floating-ui.utils-BMThB9Km.js";import"./composite-C55Tsz_h.js";import"./CompositeList-D94vPhhQ.js";import"./getDisabledMountTransitionStyles-DYKgFN9P.js";import"./chevron-down-Da227ukw.js";import"./loader-circle-BDXf0OYg.js";import"./square-BrHEXLLO.js";const{expect:t,fn:s,userEvent:a,waitFor:b,within:i}=__STORYBOOK_MODULE_TEST__,U={title:"Features/Shell/SessionStatusPillMenu",component:p,args:{statusLabel:"Session running",tone:"active",primaryActionLabel:"Stop session",onPrimaryAction:s(),onAbort:s()},render:n=>u.jsx("div",{className:"bg-white p-6",children:u.jsx(p,{...n})})},m={play:async({args:n,canvasElement:r})=>{const o=i(r),e=i(document.body);await a.click(o.getByRole("button",{name:"Session status: Session running"})),await a.click(await e.findByRole("menuitem",{name:"Stop session"})),await a.click(o.getByRole("button",{name:"Session status: Session running"})),await a.click(await e.findByRole("menuitem",{name:"Abort session"})),await t(n.onPrimaryAction).toHaveBeenCalledTimes(1),await t(n.onAbort).toHaveBeenCalledTimes(1)}},c={args:{statusLabel:"Session paused",tone:"warning",primaryActionLabel:"Resume session",onPrimaryAction:s(),onAbort:s()},play:async({args:n,canvasElement:r})=>{const o=i(r),e=i(document.body);await a.click(o.getByRole("button",{name:"Session status: Session paused"})),await a.click(await e.findByRole("menuitem",{name:"Resume session"})),await t(n.onPrimaryAction).toHaveBeenCalledTimes(1)}},l={args:{primaryActionPending:!0,abortPending:!0,onPrimaryAction:s(),onAbort:s()},play:async({args:n,canvasElement:r})=>{const o=i(r),e=i(document.body);await a.click(o.getByRole("button",{name:"Session status: Session running"}));const d=await e.findByRole("menuitem",{name:"Stop session"}),y=await e.findByRole("menuitem",{name:"Abort session"});await b(()=>{t(d).toHaveAttribute("aria-disabled","true"),t(y).toHaveAttribute("aria-disabled","true")}),await t(n.onPrimaryAction).not.toHaveBeenCalled(),await t(n.onAbort).not.toHaveBeenCalled()}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  play: async ({
    args,
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const portal = within(document.body);
    await userEvent.click(canvas.getByRole("button", {
      name: "Session status: Session running"
    }));
    await userEvent.click(await portal.findByRole("menuitem", {
      name: "Stop session"
    }));
    await userEvent.click(canvas.getByRole("button", {
      name: "Session status: Session running"
    }));
    await userEvent.click(await portal.findByRole("menuitem", {
      name: "Abort session"
    }));
    await expect(args.onPrimaryAction).toHaveBeenCalledTimes(1);
    await expect(args.onAbort).toHaveBeenCalledTimes(1);
  }
}`,...m.parameters?.docs?.source}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    statusLabel: "Session paused",
    tone: "warning",
    primaryActionLabel: "Resume session",
    onPrimaryAction: fn(),
    onAbort: fn()
  },
  play: async ({
    args,
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const portal = within(document.body);
    await userEvent.click(canvas.getByRole("button", {
      name: "Session status: Session paused"
    }));
    await userEvent.click(await portal.findByRole("menuitem", {
      name: "Resume session"
    }));
    await expect(args.onPrimaryAction).toHaveBeenCalledTimes(1);
  }
}`,...c.parameters?.docs?.source}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    primaryActionPending: true,
    abortPending: true,
    onPrimaryAction: fn(),
    onAbort: fn()
  },
  play: async ({
    args,
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const portal = within(document.body);
    await userEvent.click(canvas.getByRole("button", {
      name: "Session status: Session running"
    }));
    const stopItem = await portal.findByRole("menuitem", {
      name: "Stop session"
    });
    const abortItem = await portal.findByRole("menuitem", {
      name: "Abort session"
    });
    await waitFor(() => {
      expect(stopItem).toHaveAttribute("aria-disabled", "true");
      expect(abortItem).toHaveAttribute("aria-disabled", "true");
    });
    await expect(args.onPrimaryAction).not.toHaveBeenCalled();
    await expect(args.onAbort).not.toHaveBeenCalled();
  }
}`,...l.parameters?.docs?.source}}};const Y=["RunningMenuStopsOrAborts","PausedMenuResumesSession","PendingMenuDisablesActions"];export{c as PausedMenuResumesSession,l as PendingMenuDisablesActions,m as RunningMenuStopsOrAborts,Y as __namedExportsOrder,U as default};
