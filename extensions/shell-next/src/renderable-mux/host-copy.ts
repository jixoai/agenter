import type { CliRenderer, KeyEvent, Selection } from "@opentui/core";

export type ShellNextClipboardTarget = NonNullable<Parameters<CliRenderer["copyToClipboardOSC52"]>[1]>;

export const SHELL_NEXT_CLIPBOARD_TARGETS = {
  clipboard: 0 as ShellNextClipboardTarget,
  primary: 1 as ShellNextClipboardTarget,
} as const;

export const isShellNextCopyKey = (key: KeyEvent): boolean =>
  ((key.meta || key.super) && key.name === "c") || (key.ctrl && key.shift && key.name === "c");

const readSelectionText = (selection: Selection | null | undefined): string => selection?.getSelectedText() ?? "";

const copyTextToTargets = (input: {
  renderer: CliRenderer;
  text: string;
  targets: readonly ShellNextClipboardTarget[];
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
  targets: readonly ShellNextClipboardTarget[] = [SHELL_NEXT_CLIPBOARD_TARGETS.clipboard],
): boolean => {
  const text = readSelectionText(renderer.getSelection());
  return copyTextToTargets({ renderer, text, targets });
};

export const copyFinishedRendererSelectionToPrimary = (renderer: CliRenderer, selection: Selection): boolean => {
  if (selection.isStart || selection.isDragging) {
    return false;
  }
  const text = selection?.getSelectedText() ?? "";
  return copyTextToTargets({ renderer, text, targets: [SHELL_NEXT_CLIPBOARD_TARGETS.primary] });
};
