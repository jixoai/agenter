import{j as x}from"./jsx-runtime-u17CrQMm.js";import{f as c,d as E,a as S}from"./ai-input-story-utils-0bqZ7u0d.js";import{A as v}from"./AIInput-DKraBPL5.js";import"./iframe-BA9U4A2Q.js";import"./preload-helper-PPVm8Dsz.js";import"./inline-affordance-BLl3bR6J.js";import"./utils-VtdL_sx5.js";import"./index-MMW-HMpx.js";import"./AIInputPendingAssets-B_LfGE5Q.js";import"./overflow-surface-Cav6wYq5.js";import"./x-DMkXTevi.js";import"./video-Cv162eWI.js";import"./dialog-CvvgVQqk.js";import"./DialogTitle-sL7T0N-8.js";import"./useBaseUiId-7OVNNPuG.js";import"./popupStateMapping-CkY0FYKf.js";import"./index-DGd7USjR.js";import"./index-vzGptKfy.js";import"./owner-CK4ouegI.js";import"./stateAttributesMapping-BTajHoEL.js";import"./index-w1ompkCd.js";import"./composite-C55Tsz_h.js";import"./useOpenInteractionType-DOymnJq-.js";import"./AIInputToolbar-CeUr_Lvu.js";import"./ComposerActionBar-iiPo3j8t.js";import"./adaptive-icon-button-CQ5eDh91.js";import"./button-2keny9to.js";import"./tooltip-CiUFOqZ4.js";import"./getDisabledMountTransitionStyles-DYKgFN9P.js";import"./floating-ui.utils-BMThB9Km.js";import"./DirectionContext-5qgCtuu1.js";import"./image-plus-Dt0i74Vu.js";import"./loader-circle-BDXf0OYg.js";import"./ComposerStatusBar-BgkXM5tD.js";import"./dropdown-menu-B3aKSIUC.js";import"./chevron-right-BEfTCuPR.js";import"./useCompositeItem-u8z3oOTd.js";import"./CompositeList-D94vPhhQ.js";const{expect:a,fn:B,userEvent:r,waitFor:i,within:s}=__STORYBOOK_MODULE_TEST__,b=B(async({query:e})=>e==="@"?[{label:"src/",path:"src/",isDirectory:!0},{label:"README.md",path:"README.md",isDirectory:!1}]:e==="@src/"?[{label:"src/index.ts",path:"src/index.ts",isDirectory:!1}]:[]),T=B(async({query:e})=>e==="@"?[{label:"src/",path:"src/",isDirectory:!0},{label:"docs/",path:"docs/",isDirectory:!0}]:e==="@r"||e==="@re"||e==="@rea"?[{label:"README.md",path:"README.md",isDirectory:!1}]:[]),k=B(async({query:e})=>e==="@node_"?[{label:"node_modules/",path:"node_modules/",isDirectory:!0,ignored:!0},{label:"node_tools.md",path:"node_tools.md",isDirectory:!1}]:[]),pe={title:"Features/Chat/AIInput",component:v,args:{workspacePath:"/repo/demo",imageEnabled:!1,onSubmit:B(async()=>{}),onSearchPaths:b},render:e=>x.jsx("div",{className:"mx-auto w-[min(720px,100vw)] p-6",children:x.jsx(v,{...e})})},p={play:async({args:e,canvasElement:n})=>{const t=s(n);await c(n,async o=>{await r.click(o)}),await r.keyboard("Ship it"),await r.keyboard("{Enter}"),await i(()=>{a(e.onSubmit).toHaveBeenCalledTimes(1)}),await i(()=>{a(t.getByRole("button",{name:"Send"})).toBeDisabled()})}},l={play:async({args:e,canvasElement:n})=>{const o=s(n).getByRole("button",{name:"Send"});await c(n,async m=>{await r.click(m)}),await r.keyboard("first rapid draft"),await r.click(o),await i(()=>{a(e.onSubmit).toHaveBeenNthCalledWith(1,{text:"first rapid draft",assets:[]})}),await c(n,async m=>{await r.click(m)}),await r.keyboard("second rapid draft"),await r.click(o),await i(()=>{a(e.onSubmit).toHaveBeenNthCalledWith(2,{text:"second rapid draft",assets:[]})});const d=s(n).getByRole("textbox");await i(()=>{a((d.textContent??"").replace("Message Agenter...","").trim()).toBe("")})}},w={args:{onSearchPaths:b},play:async({args:e,canvasElement:n})=>{const t=s(n.ownerDocument.body),o=await c(n,async d=>{await r.click(d)});await r.keyboard("Open @"),await i(()=>{a(e.onSearchPaths).toHaveBeenCalledWith({cwd:"/repo/demo",query:"@",limit:8})}),await r.click(await t.findByText("src/")),await i(()=>{a(o.textContent??"").toContain("Open @src/")}),await i(()=>{a(e.onSearchPaths).toHaveBeenCalledWith({cwd:"/repo/demo",query:"@src/",limit:8})}),await r.click(await t.findByText("src/index.ts")),await i(()=>{a(o.textContent??"").toContain("Open @src/index.ts")})}},u={args:{onSearchPaths:T},play:async({args:e,canvasElement:n})=>{const t=s(n.ownerDocument.body);await c(n,async o=>{await r.click(o)}),await r.keyboard("Open @"),await i(()=>{a(e.onSearchPaths).toHaveBeenCalledWith({cwd:"/repo/demo",query:"@",limit:8})}),await a(t.getByText("src/")).toBeInTheDocument(),await a(t.getByText("docs/")).toBeInTheDocument(),await r.keyboard("rea"),await i(()=>{a(e.onSearchPaths).toHaveBeenCalledWith({cwd:"/repo/demo",query:"@rea",limit:8})}),await a(await t.findByText("README.md")).toBeInTheDocument(),await i(()=>{a(t.queryByText("src/")).not.toBeInTheDocument(),a(t.queryByText("docs/")).not.toBeInTheDocument()})}},g={args:{onSearchPaths:k},play:async({args:e,canvasElement:n})=>{const t=s(n.ownerDocument.body);await c(n,async o=>{await r.click(o)}),await r.keyboard("Install @node_"),await i(()=>{a(e.onSearchPaths).toHaveBeenCalledWith({cwd:"/repo/demo",query:"@node_",limit:8})}),await a(await t.findByText("node_modules/")).toBeInTheDocument(),await a(await t.findByText("ignored")).toBeInTheDocument(),await a(await t.findByText("node_tools.md")).toBeInTheDocument()}},y={args:{imageEnabled:!0},play:async({canvasElement:e})=>{const n=s(e),t=await c(e,async m=>{await r.click(m)}),o=new File([new Uint8Array([1,2,3,4])],"pasted-diagram.png",{type:"image/png"});E(t,o);const d=await n.findByAltText("pasted-diagram.png");await r.click(d),await a(s(e.ownerDocument.body).getByRole("dialog",{name:"pasted-diagram.png"})).toBeInTheDocument()}},h={args:{imageEnabled:!0},play:async({canvasElement:e})=>{const n=s(e),t=e.querySelector("section");if(!(t instanceof HTMLElement))throw new Error("AIInput surface not found");const o=new File([new Uint8Array([5,6,7,8])],"dropped-reference.png",{type:"image/png"});S(t,o),await a(await n.findByAltText("dropped-reference.png")).toBeInTheDocument()}},f={args:{imageEnabled:!0,imageCompatible:!1},play:async({args:e,canvasElement:n})=>{const t=s(n),o=await c(n,async m=>{await r.click(m)}),d=new File([new Uint8Array([1,2,3,4])],"blocked-image.png",{type:"image/png"});E(o,d),await r.keyboard("Please inspect this image"),await r.click(t.getByRole("button",{name:"Send"})),await a(e.onSubmit).not.toHaveBeenCalled(),await a(t.getByText("The current model cannot consume image input yet. Remove the image or switch to an image-capable model.")).toBeInTheDocument(),await a(t.getByAltText("blocked-image.png")).toBeInTheDocument()}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  play: async ({
    args,
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await focusEditorSurface(canvasElement, async target => {
      await userEvent.click(target);
    });
    await userEvent.keyboard("Ship it");
    await userEvent.keyboard("{Enter}");
    await waitFor(() => {
      expect(args.onSubmit).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(canvas.getByRole("button", {
        name: "Send"
      })).toBeDisabled();
    });
  }
}`,...p.parameters?.docs?.source}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  play: async ({
    args,
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const sendButton = canvas.getByRole("button", {
      name: "Send"
    });
    await focusEditorSurface(canvasElement, async target => {
      await userEvent.click(target);
    });
    await userEvent.keyboard("first rapid draft");
    await userEvent.click(sendButton);
    await waitFor(() => {
      expect(args.onSubmit).toHaveBeenNthCalledWith(1, {
        text: "first rapid draft",
        assets: []
      });
    });
    await focusEditorSurface(canvasElement, async target => {
      await userEvent.click(target);
    });
    await userEvent.keyboard("second rapid draft");
    await userEvent.click(sendButton);
    await waitFor(() => {
      expect(args.onSubmit).toHaveBeenNthCalledWith(2, {
        text: "second rapid draft",
        assets: []
      });
    });
    const currentEditor = within(canvasElement).getByRole("textbox");
    await waitFor(() => {
      expect((currentEditor.textContent ?? "").replace("Message Agenter...", "").trim()).toBe("");
    });
  }
}`,...l.parameters?.docs?.source}}};w.parameters={...w.parameters,docs:{...w.parameters?.docs,source:{originalSource:`{
  args: {
    onSearchPaths: searchPaths
  } satisfies Partial<AIInputProps>,
  play: async ({
    args,
    canvasElement
  }) => {
    const portal = within(canvasElement.ownerDocument.body);
    const editor = await focusEditorSurface(canvasElement, async target => {
      await userEvent.click(target);
    });
    await userEvent.keyboard("Open @");
    await waitFor(() => {
      expect(args.onSearchPaths).toHaveBeenCalledWith({
        cwd: "/repo/demo",
        query: "@",
        limit: 8
      });
    });
    await userEvent.click(await portal.findByText("src/"));
    await waitFor(() => {
      expect(editor.textContent ?? "").toContain("Open @src/");
    });
    await waitFor(() => {
      expect(args.onSearchPaths).toHaveBeenCalledWith({
        cwd: "/repo/demo",
        query: "@src/",
        limit: 8
      });
    });
    await userEvent.click(await portal.findByText("src/index.ts"));
    await waitFor(() => {
      expect(editor.textContent ?? "").toContain("Open @src/index.ts");
    });
  }
}`,...w.parameters?.docs?.source}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  args: {
    onSearchPaths: refinedSearchPaths
  } satisfies Partial<AIInputProps>,
  play: async ({
    args,
    canvasElement
  }) => {
    const portal = within(canvasElement.ownerDocument.body);
    await focusEditorSurface(canvasElement, async target => {
      await userEvent.click(target);
    });
    await userEvent.keyboard("Open @");
    await waitFor(() => {
      expect(args.onSearchPaths).toHaveBeenCalledWith({
        cwd: "/repo/demo",
        query: "@",
        limit: 8
      });
    });
    await expect(portal.getByText("src/")).toBeInTheDocument();
    await expect(portal.getByText("docs/")).toBeInTheDocument();
    await userEvent.keyboard("rea");
    await waitFor(() => {
      expect(args.onSearchPaths).toHaveBeenCalledWith({
        cwd: "/repo/demo",
        query: "@rea",
        limit: 8
      });
    });
    await expect(await portal.findByText("README.md")).toBeInTheDocument();
    await waitFor(() => {
      expect(portal.queryByText("src/")).not.toBeInTheDocument();
      expect(portal.queryByText("docs/")).not.toBeInTheDocument();
    });
  }
}`,...u.parameters?.docs?.source}}};g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  args: {
    onSearchPaths: ignoredSearchPaths
  } satisfies Partial<AIInputProps>,
  play: async ({
    args,
    canvasElement
  }) => {
    const portal = within(canvasElement.ownerDocument.body);
    await focusEditorSurface(canvasElement, async target => {
      await userEvent.click(target);
    });
    await userEvent.keyboard("Install @node_");
    await waitFor(() => {
      expect(args.onSearchPaths).toHaveBeenCalledWith({
        cwd: "/repo/demo",
        query: "@node_",
        limit: 8
      });
    });
    await expect(await portal.findByText("node_modules/")).toBeInTheDocument();
    await expect(await portal.findByText("ignored")).toBeInTheDocument();
    await expect(await portal.findByText("node_tools.md")).toBeInTheDocument();
  }
}`,...g.parameters?.docs?.source}}};y.parameters={...y.parameters,docs:{...y.parameters?.docs,source:{originalSource:`{
  args: {
    imageEnabled: true
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const editor = await focusEditorSurface(canvasElement, async target => {
      await userEvent.click(target);
    });
    const image = new File([new Uint8Array([1, 2, 3, 4])], "pasted-diagram.png", {
      type: "image/png"
    });
    dispatchClipboardImage(editor, image);
    const thumbnail = await canvas.findByAltText("pasted-diagram.png");
    await userEvent.click(thumbnail);
    await expect(within(canvasElement.ownerDocument.body).getByRole("dialog", {
      name: "pasted-diagram.png"
    })).toBeInTheDocument();
  }
}`,...y.parameters?.docs?.source}}};h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  args: {
    imageEnabled: true
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const surface = canvasElement.querySelector("section");
    if (!(surface instanceof HTMLElement)) {
      throw new Error("AIInput surface not found");
    }
    const image = new File([new Uint8Array([5, 6, 7, 8])], "dropped-reference.png", {
      type: "image/png"
    });
    dispatchDropImage(surface, image);
    await expect(await canvas.findByAltText("dropped-reference.png")).toBeInTheDocument();
  }
}`,...h.parameters?.docs?.source}}};f.parameters={...f.parameters,docs:{...f.parameters?.docs,source:{originalSource:`{
  args: {
    imageEnabled: true,
    imageCompatible: false
  },
  play: async ({
    args,
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const editor = await focusEditorSurface(canvasElement, async target => {
      await userEvent.click(target);
    });
    const image = new File([new Uint8Array([1, 2, 3, 4])], "blocked-image.png", {
      type: "image/png"
    });
    dispatchClipboardImage(editor, image);
    await userEvent.keyboard("Please inspect this image");
    await userEvent.click(canvas.getByRole("button", {
      name: "Send"
    }));
    await expect(args.onSubmit).not.toHaveBeenCalled();
    await expect(canvas.getByText("The current model cannot consume image input yet. Remove the image or switch to an image-capable model.")).toBeInTheDocument();
    await expect(canvas.getByAltText("blocked-image.png")).toBeInTheDocument();
  }
}`,...f.parameters?.docs?.source}}};const le=["SubmitDraft","SubmitRapidDraftsSeparately","CompleteWorkspacePath","RefreshWorkspacePathResults","ShowIgnoredWorkspacePath","PastePendingImage","DropPendingImage","BlockIncompatibleImageSend"];export{f as BlockIncompatibleImageSend,w as CompleteWorkspacePath,h as DropPendingImage,y as PastePendingImage,u as RefreshWorkspacePathResults,g as ShowIgnoredWorkspacePath,p as SubmitDraft,l as SubmitRapidDraftsSeparately,le as __namedExportsOrder,pe as default};
