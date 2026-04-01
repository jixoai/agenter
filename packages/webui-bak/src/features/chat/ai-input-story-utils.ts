export const getEditorSurface = (root: ParentNode): HTMLElement => {
  const editor = root.querySelector(".cm-content[contenteditable='true']");
  if (!(editor instanceof HTMLElement)) {
    throw new Error("CodeMirror editor surface not found");
  }
  return editor;
};

export const focusEditorSurface = async (root: ParentNode, click: (target: HTMLElement) => Promise<void>): Promise<HTMLElement> => {
  const editor = getEditorSurface(root);
  await click(editor);
  return editor;
};

const createFileTransfer = (file: File): DataTransfer => {
  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(file);
  return dataTransfer;
};

export const dispatchClipboardImage = (target: HTMLElement, file: File) => {
  const event = new ClipboardEvent("paste", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "clipboardData", {
    configurable: true,
    value: createFileTransfer(file),
  });
  target.dispatchEvent(event);
};

export const dispatchDropImage = (target: HTMLElement, file: File) => {
  const dataTransfer = createFileTransfer(file);
  for (const type of ["dragenter", "dragover", "drop"] as const) {
    const event = new DragEvent(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, "dataTransfer", {
      configurable: true,
      value: dataTransfer,
    });
    target.dispatchEvent(event);
  }
};
