import{j as n}from"./jsx-runtime-u17CrQMm.js";import{C as s}from"./ChatConversationRows-BP_Rleh6.js";import"./iframe-BA9U4A2Q.js";import"./preload-helper-PPVm8Dsz.js";import"./dropdown-menu-B3aKSIUC.js";import"./utils-VtdL_sx5.js";import"./inline-affordance-BLl3bR6J.js";import"./chevron-right-BEfTCuPR.js";import"./index-DGd7USjR.js";import"./index-vzGptKfy.js";import"./popupStateMapping-CkY0FYKf.js";import"./useBaseUiId-7OVNNPuG.js";import"./owner-CK4ouegI.js";import"./stateAttributesMapping-BTajHoEL.js";import"./index-w1ompkCd.js";import"./useOpenInteractionType-DOymnJq-.js";import"./DirectionContext-5qgCtuu1.js";import"./useCompositeItem-u8z3oOTd.js";import"./floating-ui.utils-BMThB9Km.js";import"./composite-C55Tsz_h.js";import"./CompositeList-D94vPhhQ.js";import"./getDisabledMountTransitionStyles-DYKgFN9P.js";import"./profile-image-DCTEHzfl.js";import"./overflow-surface-Cav6wYq5.js";import"./tool-structured-view-Be99XAPJ.js";import"./index-MMW-HMpx.js";import"./AssistantMarkdown-BRd3mpcZ.js";import"./accordion-CbxGKyEs.js";import"./chevron-down-Da227ukw.js";import"./isElementDisabled-DAIqf-Ux.js";import"./loader-circle-BDXf0OYg.js";import"./ChatAttachmentStrip-CNmJgMJl.js";import"./video-Cv162eWI.js";import"./ellipsis-D8eZY63e.js";import"./triangle-alert-DpleOF06.js";import"./sparkles-D7ne4up4.js";const{expect:r,fireEvent:l,fn:m,userEvent:d,waitFor:u,within:p}=__STORYBOOK_MODULE_TEST__,b=`data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" rx="20" fill="#0f766e"/></svg>')}`,Q={title:"Features/Chat/ChatMessageRow",component:s,args:{message:{id:"assistant-message-1",role:"assistant",cycleId:12,channel:"to_user",content:"Please inspect the latest build output and attached diagram.",timestamp:12,attachments:[{assetId:"assistant-image",kind:"image",mimeType:"image/png",name:"build-diagram.png",sizeBytes:4096,url:"https://placehold.co/160x160/png"}]},assistantAvatarUrl:b,assistantAvatarLabel:"Agenter",userAvatarLabel:"You",onPreviewAttachment:m(),onOpenDevtools:m()},render:e=>n.jsx("div",{className:"w-[min(720px,100vw)] rounded-[1.6rem] bg-slate-50 p-6",children:n.jsx(s,{...e})})},t={play:async({args:e,canvasElement:a})=>{const o=p(a),c=p(a.ownerDocument.body),i=o.getByText("Please inspect the latest build output and attached diagram.").closest("[data-chat-bubble='true']");if(!(i instanceof HTMLElement))throw new Error("Chat bubble not found");await r(o.getByRole("img",{name:"Agenter"})).toBeInTheDocument(),l.contextMenu(i),await d.click(await c.findByText("View In Devtools")),await u(()=>{r(e.onOpenDevtools).toHaveBeenCalledWith(12)})}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  play: async ({
    args,
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const portal = within(canvasElement.ownerDocument.body);
    const bubble = canvas.getByText("Please inspect the latest build output and attached diagram.").closest("[data-chat-bubble='true']");
    if (!(bubble instanceof HTMLElement)) {
      throw new Error("Chat bubble not found");
    }
    await expect(canvas.getByRole("img", {
      name: "Agenter"
    })).toBeInTheDocument();
    fireEvent.contextMenu(bubble);
    await userEvent.click(await portal.findByText("View In Devtools"));
    await waitFor(() => {
      expect(args.onOpenDevtools).toHaveBeenCalledWith(12);
    });
  }
}`,...t.parameters?.docs?.source}}};const X=["AssistantBubbleActionsRemainReachable"];export{t as AssistantBubbleActionsRemainReachable,X as __namedExportsOrder,Q as default};
