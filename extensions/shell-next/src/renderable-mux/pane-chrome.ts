import type { BoxRenderable, MouseEvent } from "@opentui/core";

import type { LayoutRect } from "./layout";

export type ShellNextPaneTitleActionId = "close" | (string & {});

export interface ShellNextPaneTitleAction {
  readonly id: ShellNextPaneTitleActionId;
  readonly label: string;
}

export interface ShellNextPaneChromeState {
  readonly title: string;
  readonly actions?: readonly ShellNextPaneTitleAction[];
}

export interface ShellNextPaneChromeClick {
  readonly actionId: ShellNextPaneTitleActionId;
  readonly event: MouseEvent;
}

export interface ShellNextPaneChromeHitRegion {
  readonly actionId: ShellNextPaneTitleActionId;
  readonly x: number;
  readonly y: number;
  readonly width: number;
}

const DEFAULT_TITLE_GAP = " ";

const stringWidth = (value: string): number => Bun.stringWidth(value);

const truncateCells = (value: string, width: number): string => {
  const safeWidth = Math.max(0, Math.trunc(width));
  if (safeWidth <= 0) {
    return "";
  }
  if (stringWidth(value) <= safeWidth) {
    return value;
  }
  if (safeWidth <= 1) {
    return Array.from(value).find((char) => stringWidth(char) <= safeWidth) ?? "";
  }
  let output = "";
  let used = 0;
  for (const char of Array.from(value)) {
    const charWidth = stringWidth(char);
    if (used + charWidth > safeWidth - 1) {
      break;
    }
    output += char;
    used += charWidth;
  }
  return `${output}…`;
};

export const buildShellNextPaneBorderTitle = (input: {
  readonly state: ShellNextPaneChromeState;
  readonly width: number;
}): string => {
  const actions = input.state.actions ?? [];
  const suffix = actions.map((action) => action.label).join(DEFAULT_TITLE_GAP);
  const availableWidth = Math.max(1, Math.trunc(input.width) - 4);
  if (suffix.length === 0) {
    return truncateCells(input.state.title, availableWidth);
  }
  const suffixWidth = stringWidth(suffix);
  const titleWidth = Math.max(1, availableWidth - suffixWidth - stringWidth(DEFAULT_TITLE_GAP));
  const title = truncateCells(input.state.title, titleWidth);
  return `${title}${DEFAULT_TITLE_GAP}${suffix}`;
};

export const syncShellNextPaneChrome = (input: {
  readonly root: BoxRenderable;
  readonly rect: LayoutRect;
  readonly state: ShellNextPaneChromeState;
}): readonly ShellNextPaneChromeHitRegion[] => {
  input.root.titleAlignment = "left";
  input.root.title = buildShellNextPaneBorderTitle({
    state: input.state,
    width: input.rect.width,
  });
  const actions = input.state.actions ?? [];
  if (actions.length === 0) {
    return [];
  }
  const title = input.root.title ?? "";
  const regions: ShellNextPaneChromeHitRegion[] = [];
  let cursor = input.rect.x + 2 + stringWidth(title);
  for (let index = actions.length - 1; index >= 0; index -= 1) {
    const action = actions[index];
    const width = stringWidth(action.label);
    cursor -= width;
    regions.unshift({
      actionId: action.id,
      x: cursor,
      y: input.rect.y,
      width,
    });
    cursor -= stringWidth(DEFAULT_TITLE_GAP);
  }
  return regions;
};

export const resolveShellNextPaneChromeClick = (input: {
  readonly event: MouseEvent;
  readonly regions: readonly ShellNextPaneChromeHitRegion[];
}): ShellNextPaneTitleActionId | null => {
  const x = Math.trunc(input.event.x);
  const y = Math.trunc(input.event.y);
  const region = input.regions.find(
    (candidate) => y === candidate.y && x >= candidate.x && x < candidate.x + candidate.width,
  );
  return region?.actionId ?? null;
};
