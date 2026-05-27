import type { CliRenderer, KeyEvent } from "@opentui/core";

export const isShellNextCopyKey = (key: KeyEvent): boolean => key.meta && key.name === "c";

export const copyRendererSelection = (renderer: CliRenderer): boolean => {
  const selection = renderer.getSelection();
  const text = selection?.getSelectedText() ?? "";
  if (text.length === 0) {
    return false;
  }
  return renderer.copyToClipboardOSC52(text);
};
