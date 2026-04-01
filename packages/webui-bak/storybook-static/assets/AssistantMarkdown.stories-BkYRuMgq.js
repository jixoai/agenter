import{j as o}from"./jsx-runtime-u17CrQMm.js";import{A as r}from"./AssistantMarkdown-BRd3mpcZ.js";import"./iframe-BA9U4A2Q.js";import"./preload-helper-PPVm8Dsz.js";import"./tool-structured-view-Be99XAPJ.js";import"./index-MMW-HMpx.js";import"./overflow-surface-Cav6wYq5.js";import"./utils-VtdL_sx5.js";import"./accordion-CbxGKyEs.js";import"./chevron-down-Da227ukw.js";import"./isElementDisabled-DAIqf-Ux.js";import"./useBaseUiId-7OVNNPuG.js";import"./CompositeList-D94vPhhQ.js";import"./DirectionContext-5qgCtuu1.js";import"./stateAttributesMapping-BTajHoEL.js";import"./index-DGd7USjR.js";import"./index-vzGptKfy.js";import"./composite-C55Tsz_h.js";import"./inline-affordance-BLl3bR6J.js";import"./loader-circle-BDXf0OYg.js";const{expect:e,userEvent:s,within:l}=__STORYBOOK_MODULE_TEST__,O={title:"Features/Chat/AssistantMarkdown",component:r,args:{content:"Observation: terminal idle",channel:"self_talk"},render:a=>o.jsx("div",{className:"mx-auto w-[min(720px,100vw)] p-6",children:o.jsx(r,{...a})})},n={args:{content:"",toolTrace:{id:"tool-terminal-read",toolName:"terminal_read",status:"done",meta:"iflow · terminal-snapshot · #30 · 80x24",callContent:["tool: terminal_read","input:","  terminalId: iflow"].join(`
`),resultContent:["tool: terminal_read","output:","  kind: terminal-snapshot"].join(`
`)}},play:async({canvasElement:a})=>{const t=l(a),i=t.getByRole("button",{name:/terminal_read/i});await e(t.getByText("iflow · terminal-snapshot · #30 · 80x24")).toBeInTheDocument(),await e(t.queryByText("call")).not.toBeInTheDocument(),await s.click(i),await e(t.getByText("call")).toBeInTheDocument(),await e(t.getByText("result")).toBeInTheDocument(),await e(t.getByText("terminal-snapshot")).toBeInTheDocument()}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    content: "",
    toolTrace: {
      id: "tool-terminal-read",
      toolName: "terminal_read",
      status: "done",
      meta: "iflow · terminal-snapshot · #30 · 80x24",
      callContent: ["tool: terminal_read", "input:", "  terminalId: iflow"].join("\\n"),
      resultContent: ["tool: terminal_read", "output:", "  kind: terminal-snapshot"].join("\\n")
    }
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", {
      name: /terminal_read/i
    });
    await expect(canvas.getByText("iflow · terminal-snapshot · #30 · 80x24")).toBeInTheDocument();
    await expect(canvas.queryByText("call")).not.toBeInTheDocument();
    await userEvent.click(trigger);
    await expect(canvas.getByText("call")).toBeInTheDocument();
    await expect(canvas.getByText("result")).toBeInTheDocument();
    await expect(canvas.getByText("terminal-snapshot")).toBeInTheDocument();
  }
}`,...n.parameters?.docs?.source}}};const A=["ToolTraceAccordion"];export{n as ToolTraceAccordion,A as __namedExportsOrder,O as default};
