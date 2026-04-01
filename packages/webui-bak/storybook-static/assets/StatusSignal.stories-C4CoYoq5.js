import{j as r}from"./jsx-runtime-u17CrQMm.js";import{W as p,B as m,S as s}from"./StatusSignal-Bit7BTh5.js";import"./utils-VtdL_sx5.js";import"./iframe-BA9U4A2Q.js";import"./preload-helper-PPVm8Dsz.js";import"./tooltip-CiUFOqZ4.js";import"./useBaseUiId-7OVNNPuG.js";import"./index-DGd7USjR.js";import"./index-vzGptKfy.js";import"./popupStateMapping-CkY0FYKf.js";import"./owner-CK4ouegI.js";import"./stateAttributesMapping-BTajHoEL.js";import"./index-w1ompkCd.js";import"./getDisabledMountTransitionStyles-DYKgFN9P.js";import"./floating-ui.utils-BMThB9Km.js";import"./DirectionContext-5qgCtuu1.js";const{expect:i,userEvent:d,waitFor:g,within:o}=__STORYBOOK_MODULE_TEST__,D={title:"Features/Shell/StatusSignal",component:s,args:{label:"AI ready",icon:m,tone:"muted"},render:e=>r.jsx("div",{className:"bg-white p-6",children:r.jsx(s,{...e})})},a={play:async({canvasElement:e})=>{const t=o(e),c=o(document.body),l=t.getByLabelText("AI ready");await d.hover(l),await g(()=>{i(c.getByText("AI ready")).toBeInTheDocument()})}},n={args:{label:"Offline",icon:p,tone:"danger"},play:async({canvasElement:e})=>{const t=o(e);await i(t.getByLabelText("Offline")).toBeInTheDocument()}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const portal = within(document.body);
    const signal = canvas.getByLabelText("AI ready");
    await userEvent.hover(signal);
    await waitFor(() => {
      expect(portal.getByText("AI ready")).toBeInTheDocument();
    });
  }
}`,...a.parameters?.docs?.source}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    label: "Offline",
    icon: WifiOff,
    tone: "danger"
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByLabelText("Offline")).toBeInTheDocument();
  }
}`,...n.parameters?.docs?.source}}};const K=["ReadySignalKeepsTooltipAndAria","OfflineSignalKeepsDangerTone"];export{n as OfflineSignalKeepsDangerTone,a as ReadySignalKeepsTooltipAndAria,K as __namedExportsOrder,D as default};
