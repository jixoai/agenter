import{j as i}from"./jsx-runtime-u17CrQMm.js";import{A as s}from"./AIInputPendingAssets-B_LfGE5Q.js";import"./overflow-surface-Cav6wYq5.js";import"./iframe-BA9U4A2Q.js";import"./preload-helper-PPVm8Dsz.js";import"./utils-VtdL_sx5.js";import"./x-DMkXTevi.js";import"./video-Cv162eWI.js";const{expect:n,fn:r,userEvent:o,waitFor:m,within:l}=__STORYBOOK_MODULE_TEST__,p=[{id:"asset-image",kind:"image",file:new File([new Uint8Array([1,2,3,4])],"wireframe.png",{type:"image/png"}),previewUrl:"https://placehold.co/96x96/png"},{id:"asset-video",kind:"video",file:new File([new Uint8Array([5,6,7,8])],"walkthrough.mp4",{type:"video/mp4"}),previewUrl:"https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4"},{id:"asset-file",kind:"file",file:new File([new Uint8Array([9,10,11])],"brief.md",{type:"text/markdown"}),previewUrl:"blob://brief-md"}],A={title:"Features/Chat/AIInputPendingAssets",component:s,args:{pendingAssets:p,onPreviewAsset:r(),onRemoveAsset:r()},render:e=>i.jsx("div",{className:"w-[min(720px,100vw)] rounded-[1.4rem] bg-white shadow-sm ring-1 ring-slate-200",children:i.jsx(s,{...e})})},a={play:async({args:e,canvasElement:c})=>{const t=l(c);await n(t.getByText("Pending attachments")).toBeInTheDocument(),await n(t.getByText("3 queued")).toBeInTheDocument(),await o.click(t.getByAltText("wireframe.png")),await m(()=>{n(e.onPreviewAsset).toHaveBeenCalledWith("asset-image")}),await o.click(t.getByRole("button",{name:"Remove brief.md"})),await m(()=>{n(e.onRemoveAsset).toHaveBeenCalledWith("asset-file")})}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  play: async ({
    args,
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Pending attachments")).toBeInTheDocument();
    await expect(canvas.getByText("3 queued")).toBeInTheDocument();
    await userEvent.click(canvas.getByAltText("wireframe.png"));
    await waitFor(() => {
      expect(args.onPreviewAsset).toHaveBeenCalledWith("asset-image");
    });
    await userEvent.click(canvas.getByRole("button", {
      name: "Remove brief.md"
    }));
    await waitFor(() => {
      expect(args.onRemoveAsset).toHaveBeenCalledWith("asset-file");
    });
  }
}`,...a.parameters?.docs?.source}}};const y=["PendingAssetsRemainOperable"];export{a as PendingAssetsRemainOperable,y as __namedExportsOrder,A as default};
