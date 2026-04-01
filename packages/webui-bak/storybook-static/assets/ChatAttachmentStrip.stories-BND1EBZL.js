import{j as s}from"./jsx-runtime-u17CrQMm.js";import{C as m}from"./ChatAttachmentStrip-CNmJgMJl.js";import"./overflow-surface-Cav6wYq5.js";import"./iframe-BA9U4A2Q.js";import"./preload-helper-PPVm8Dsz.js";import"./utils-VtdL_sx5.js";import"./video-Cv162eWI.js";const{expect:n,fn:r,userEvent:o,waitFor:c,within:p}=__STORYBOOK_MODULE_TEST__,d=[{assetId:"persisted-image",kind:"image",mimeType:"image/png",name:"diagram.png",sizeBytes:2048,url:"https://placehold.co/160x160/png"},{assetId:"persisted-file",kind:"file",mimeType:"text/markdown",name:"summary.md",sizeBytes:1024,url:"https://example.com/summary.md"}],v={title:"Features/Chat/ChatAttachmentStrip",component:m,args:{attachments:d,onPreview:r()},render:t=>s.jsx("div",{className:"w-[min(720px,100vw)] rounded-[1.4rem] bg-slate-50 p-6",children:s.jsx(m,{...t})})},e={play:async({args:t,canvasElement:i})=>{const a=p(i);await n(a.getByText("diagram.png")).toBeInTheDocument(),await n(a.getByText("summary.md")).toBeInTheDocument(),await o.click(a.getByRole("button",{name:/diagram\.png/i})),await c(()=>{n(t.onPreview).toHaveBeenCalledWith("persisted-image")})}};e.parameters={...e.parameters,docs:{...e.parameters?.docs,source:{originalSource:`{
  play: async ({
    args,
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("diagram.png")).toBeInTheDocument();
    await expect(canvas.getByText("summary.md")).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", {
      name: /diagram\\.png/i
    }));
    await waitFor(() => {
      expect(args.onPreview).toHaveBeenCalledWith("persisted-image");
    });
  }
}`,...e.parameters?.docs?.source}}};const B=["PersistedAttachmentsRemainOperable"];export{e as PersistedAttachmentsRemainOperable,B as __namedExportsOrder,v as default};
