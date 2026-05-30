import type { CliRenderer, KeyEvent, Selection } from "@opentui/core";

export type ShellClipboardTarget = NonNullable<Parameters<CliRenderer["copyToClipboardOSC52"]>[1]>;

export const SHELL_CLIPBOARD_TARGETS = {
  clipboard: 0 as ShellClipboardTarget,
  primary: 1 as ShellClipboardTarget,
} as const;

export const isShellCopyKey = (key: KeyEvent): boolean =>
  ((key.meta || key.super) && key.name === "c") || (key.ctrl && key.shift && key.name === "c");

const readSelectionText = (selection: Selection | null | undefined): string => selection?.getSelectedText() ?? "";

const copyTextToTargets = (input: {
  renderer: CliRenderer;
  text: string;
  targets: readonly ShellClipboardTarget[];
}): boolean => {
  if (input.text.length === 0) {
    return false;
  }
  return input.targets
    .map((target) => input.renderer.copyToClipboardOSC52(input.text, target))
    .some((copied) => copied);
};

export const copyRendererSelection = (
  renderer: CliRenderer,
  targets: readonly ShellClipboardTarget[] = [SHELL_CLIPBOARD_TARGETS.clipboard],
): boolean => {
  const text = readSelectionText(renderer.getSelection());
  return copyTextToTargets({ renderer, text, targets });
};

export const copyFinishedRendererSelectionToPrimary = (renderer: CliRenderer, selection: Selection): boolean => {
  if (selection.isStart || selection.isDragging) {
    return false;
  }
  const text = selection?.getSelectedText() ?? "";
  return copyTextToTargets({ renderer, text, targets: [SHELL_CLIPBOARD_TARGETS.primary] });
};
