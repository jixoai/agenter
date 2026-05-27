import { TextAttributes, TextRenderable, type BoxRenderable, type CliRenderer, type MouseEvent } from "@opentui/core";

import type { LayoutRect } from "./layout";

export type ShellNextPaneTitleActionId = "close" | (string & {});

export interface ShellNextPaneTitleAction {
  readonly id: ShellNextPaneTitleActionId;
  readonly label: string;
  readonly active?: boolean;
}

export interface ShellNextPaneChromeState {
  readonly title: string;
  readonly actions?: readonly ShellNextPaneTitleAction[];
  readonly hoveredActionId?: ShellNextPaneTitleActionId | null;
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

interface ShellNextPaneChromeActionOverlay {
  readonly actionId: ShellNextPaneTitleActionId;
  readonly node: TextRenderable;
}

export interface ShellNextPaneChromeControllerInput {
  readonly renderer: CliRenderer;
  readonly id: string;
  readonly zIndex?: number;
  readonly fg?: string;
  readonly bg?: string;
  readonly onMouseDown?: (event: MouseEvent) => void;
  readonly onMouseMove?: (event: MouseEvent) => void;
}

const DEFAULT_TITLE_GAP = " ";

const stringWidth = (value: string): number => Bun.stringWidth(value);

export const shellNextPaneButtonLabel = (label: string): string => {
  const trimmed = label.trim();
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return trimmed;
  }
  return `[${trimmed}]`;
};

export const shellNextPaneCloseAction = (): ShellNextPaneTitleAction => ({
  id: "close",
  label: shellNextPaneButtonLabel("x"),
});

export const shellNextPaneActionAttributes = (input: {
  readonly active?: boolean;
  readonly hovered?: boolean;
}): number =>
  (input.active ? TextAttributes.UNDERLINE : TextAttributes.NONE) |
  (input.hovered ? TextAttributes.BOLD : TextAttributes.NONE);

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

export class ShellNextPaneChromeController {
  readonly #renderer: CliRenderer;
  readonly #id: string;
  readonly #zIndex: number;
  readonly #fg: string;
  readonly #bg: string;
  readonly #onMouseDown: ((event: MouseEvent) => void) | undefined;
  readonly #onMouseMove: ((event: MouseEvent) => void) | undefined;
  readonly #overlays = new Map<ShellNextPaneTitleActionId, ShellNextPaneChromeActionOverlay>();

  constructor(input: ShellNextPaneChromeControllerInput) {
    this.#renderer = input.renderer;
    this.#id = input.id;
    this.#zIndex = input.zIndex ?? 80;
    this.#fg = input.fg ?? "#f8fafc";
    this.#bg = input.bg ?? "#020617";
    this.#onMouseDown = input.onMouseDown;
    this.#onMouseMove = input.onMouseMove;
  }

  sync(input: {
    readonly root: BoxRenderable;
    readonly rect: LayoutRect;
    readonly state: ShellNextPaneChromeState;
  }): readonly ShellNextPaneChromeHitRegion[] {
    const regions = syncShellNextPaneChrome({
      ...input,
      state: {
        ...input.state,
        actions: input.state.actions?.map((action) => ({
          ...action,
          label: " ".repeat(Math.max(1, stringWidth(action.label))),
        })),
      },
    });
    const actions = input.state.actions ?? [];
    const actionById = new Map(actions.map((action) => [action.id, action]));
    const liveActionIds = new Set(actions.map((action) => action.id));
    for (const [actionId, overlay] of this.#overlays) {
      if (!liveActionIds.has(actionId)) {
        overlay.node.destroyRecursively();
        this.#overlays.delete(actionId);
      }
    }
    for (const region of regions) {
      const action = actionById.get(region.actionId);
      if (!action) {
        continue;
      }
      const overlay = this.#overlays.get(region.actionId) ?? this.#createOverlay(region.actionId);
      overlay.node.left = region.x;
      overlay.node.top = region.y;
      overlay.node.width = region.width;
      overlay.node.height = 1;
      overlay.node.content = action.label;
      overlay.node.attributes = shellNextPaneActionAttributes({
        active: action.active,
        hovered: input.state.hoveredActionId === action.id,
      });
      overlay.node.visible = input.root.visible !== false;
    }
    return regions;
  }

  destroy(): void {
    for (const overlay of this.#overlays.values()) {
      overlay.node.destroyRecursively();
    }
    this.#overlays.clear();
  }

  hide(): void {
    for (const overlay of this.#overlays.values()) {
      overlay.node.visible = false;
    }
  }

  #createOverlay(actionId: ShellNextPaneTitleActionId): ShellNextPaneChromeActionOverlay {
    const node = new TextRenderable(this.#renderer, {
      id: `${this.#id}-title-action-${String(actionId)}`,
      position: "absolute",
      left: 0,
      top: 0,
      width: 1,
      height: 1,
      content: "",
      fg: this.#fg,
      bg: this.#bg,
      wrapMode: "none",
      zIndex: this.#zIndex,
    });
    node.onMouseDown = (event) => this.#onMouseDown?.(event);
    node.onMouseMove = (event) => this.#onMouseMove?.(event);
    this.#renderer.root.add(node);
    const overlay = { actionId, node };
    this.#overlays.set(actionId, overlay);
    return overlay;
  }
}

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
