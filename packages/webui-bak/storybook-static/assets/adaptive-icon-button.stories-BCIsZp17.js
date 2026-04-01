import{j as s}from"./jsx-runtime-u17CrQMm.js";import{P as u,A as m}from"./adaptive-icon-button-CQ5eDh91.js";import"./utils-VtdL_sx5.js";import"./iframe-BA9U4A2Q.js";import"./preload-helper-PPVm8Dsz.js";import"./button-2keny9to.js";import"./inline-affordance-BLl3bR6J.js";import"./tooltip-CiUFOqZ4.js";import"./useBaseUiId-7OVNNPuG.js";import"./index-DGd7USjR.js";import"./index-vzGptKfy.js";import"./popupStateMapping-CkY0FYKf.js";import"./owner-CK4ouegI.js";import"./stateAttributesMapping-BTajHoEL.js";import"./index-w1ompkCd.js";import"./getDisabledMountTransitionStyles-DYKgFN9P.js";import"./floating-ui.utils-BMThB9Km.js";import"./DirectionContext-5qgCtuu1.js";const{expect:i,userEvent:l,waitFor:p,within:e}=__STORYBOOK_MODULE_TEST__,C={title:"Components/UI/AdaptiveIconButton",component:m,args:{icon:u,label:"Attach",tooltip:"Attach files, images, or videos",variant:"outline",size:"sm",onClick:()=>{}}},o={render:t=>s.jsx("div",{className:"w-[220px] bg-white p-6",children:s.jsx(m,{...t})}),play:async({canvasElement:t})=>{const c=e(t),r=e(document.body),n=c.getByRole("button",{name:"Attach"});await i(e(n).getByText("Attach")).toBeInTheDocument(),await l.hover(n),await p(()=>{i(r.getByText("Attach files, images, or videos")).toBeInTheDocument()})}},a={render:t=>s.jsx("div",{className:"w-[72px] bg-white p-4",children:s.jsx(m,{...t})}),play:async({canvasElement:t})=>{const c=e(t),r=e(document.body),n=c.getByRole("button",{name:"Attach"});await p(()=>{i(e(n).queryByText("Attach")).not.toBeInTheDocument()}),await l.hover(n),await p(()=>{i(r.getByText("Attach files, images, or videos")).toBeInTheDocument()})}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  render: args => <div className="w-[220px] bg-white p-6">
      <AdaptiveIconButton {...args} />
    </div>,
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const portal = within(document.body);
    const button = canvas.getByRole("button", {
      name: "Attach"
    });
    await expect(within(button).getByText("Attach")).toBeInTheDocument();
    await userEvent.hover(button);
    await waitFor(() => {
      expect(portal.getByText("Attach files, images, or videos")).toBeInTheDocument();
    });
  }
}`,...o.parameters?.docs?.source}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  render: args => <div className="w-[72px] bg-white p-4">
      <AdaptiveIconButton {...args} />
    </div>,
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const portal = within(document.body);
    const button = canvas.getByRole("button", {
      name: "Attach"
    });
    await waitFor(() => {
      expect(within(button).queryByText("Attach")).not.toBeInTheDocument();
    });
    await userEvent.hover(button);
    await waitFor(() => {
      expect(portal.getByText("Attach files, images, or videos")).toBeInTheDocument();
    });
  }
}`,...a.parameters?.docs?.source}}};const R=["WideButtonKeepsLabel","CompactButtonCollapsesToIconOnly"];export{a as CompactButtonCollapsesToIconOnly,o as WideButtonKeepsLabel,R as __namedExportsOrder,C as default};
