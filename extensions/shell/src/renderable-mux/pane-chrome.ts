import { RGBA, TextRenderable, type BoxRenderable, type CliRenderer, type MouseEvent } from "@opentui/core";

import type { LayoutRect } from "./layout";
import {
  buildShellButtonStyledText,
  normalizeShellButtonLabel,
  resolveShellButtonAt,
  resolveShellButtonAttributes,
  type ShellButtonRegion,
} from "./button";

export type ShellPaneTitleActionId = "close" | (string & {});

export interface ShellPaneTitleAction {
  readonly id: ShellPaneTitleActionId;
  readonly label: string;
  readonly active?: boolean;
}

export interface ShellPaneChromeState {
  readonly title: string;
  readonly actions?: readonly ShellPaneTitleAction[];
  readonly hoveredActionId?: ShellPaneTitleActionId | null;
}

export interface ShellPaneChromeClick {
  readonly actionId: ShellPaneTitleActionId;
  readonly event: MouseEvent;
}

export type ShellPaneChromeHitRegion = ShellButtonRegion & { readonly actionId: ShellPaneTitleActionId };

interface ShellPaneChromeActionOverlay {
  readonly actionId: ShellPaneTitleActionId;
  readonly node: TextRenderable;
}

export interface ShellPaneChromeControllerInput {
  readonly renderer: CliRenderer;
  readonly id: string;
  readonly zIndex?: number;
  readonly fg?: string;
  readonly bg?: string;
  readonly onMouseDown?: (event: MouseEvent) => void;
  readonly onMouseUp?: (event: MouseEvent) => void;
  readonly onMouseMove?: (event: MouseEvent) => void;
}

const DEFAULT_TITLE_GAP = " ";

const stringWidth = (value: string): number => Bun.stringWidth(value);

export const shellPaneButtonLabel = (label: string): string => {
  return normalizeShellButtonLabel(label);
};

export const shellPaneCloseAction = (): ShellPaneTitleAction => ({
  id: "close",
  label: shellPaneButtonLabel("x"),
});

export const shellPaneActionAttributes = (input: {
  readonly active?: boolean;
  readonly hovered?: boolean;
}): number => resolveShellButtonAttributes(input);

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

export const buildShellPaneBorderTitle = (input: {
  readonly state: ShellPaneChromeState;
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

export const syncShellPaneChrome = (input: {
  readonly root: BoxRenderable;
  readonly rect: LayoutRect;
  readonly state: ShellPaneChromeState;
}): readonly ShellPaneChromeHitRegion[] => {
  input.root.titleAlignment = "left";
  input.root.title = buildShellPaneBorderTitle({
    state: input.state,
    width: input.rect.width,
  });
  const actions = input.state.actions ?? [];
  if (actions.length === 0) {
    return [];
  }
  const title = input.root.title ?? "";
  const regions: ShellPaneChromeHitRegion[] = [];
  let cursor = input.rect.x + 2 + stringWidth(title);
  for (let index = actions.length - 1; index >= 0; index -= 1) {
    const action = actions[index];
    const width = stringWidth(action.label);
    cursor -= width;
    regions.unshift({
      id: action.id,
      actionId: action.id,
      x: cursor,
      y: input.rect.y,
      width,
    });
    cursor -= stringWidth(DEFAULT_TITLE_GAP);
  }
  return regions;
};

export class ShellPaneChromeController {
  readonly #renderer: CliRenderer;
  readonly #id: string;
  readonly #zIndex: number;
  readonly #fg: string;
  readonly #fgColor: RGBA;
  readonly #bg: string;
  readonly #onMouseDown: ((event: MouseEvent) => void) | undefined;
  readonly #onMouseUp: ((event: MouseEvent) => void) | undefined;
  readonly #onMouseMove: ((event: MouseEvent) => void) | undefined;
  readonly #overlays = new Map<ShellPaneTitleActionId, ShellPaneChromeActionOverlay>();

  constructor(input: ShellPaneChromeControllerInput) {
    this.#renderer = input.renderer;
    this.#id = input.id;
    this.#zIndex = input.zIndex ?? 80;
    this.#fg = input.fg ?? "#f8fafc";
    this.#fgColor = RGBA.fromHex(this.#fg);
    this.#bg = input.bg ?? "#020617";
    this.#onMouseDown = input.onMouseDown;
    this.#onMouseUp = input.onMouseUp;
    this.#onMouseMove = input.onMouseMove;
  }

  sync(input: {
    readonly root: BoxRenderable;
    readonly rect: LayoutRect;
    readonly state: ShellPaneChromeState;
  }): readonly ShellPaneChromeHitRegion[] {
    const regions = syncShellPaneChrome({
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
      overlay.node.content = buildShellButtonStyledText(
        [
          {
            button: {
              id: action.id,
              label: action.label,
              active: action.active,
              hovered: input.state.hoveredActionId === action.id,
            },
            fg: this.#fgColor,
          },
        ],
        this.#fgColor,
      );
      overlay.node.attributes = 0;
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

  #createOverlay(actionId: ShellPaneTitleActionId): ShellPaneChromeActionOverlay {
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
    node.onMouseUp = (event) => this.#onMouseUp?.(event);
    node.onMouseMove = (event) => this.#onMouseMove?.(event);
    this.#renderer.root.add(node);
    const overlay = { actionId, node };
    this.#overlays.set(actionId, overlay);
    return overlay;
  }
}

export const resolveShellPaneChromeClick = (input: {
  readonly event: MouseEvent;
  readonly regions: readonly ShellPaneChromeHitRegion[];
}): ShellPaneTitleActionId | null => {
  const id = resolveShellButtonAt(input.event, input.regions);
  return input.regions.find((region) => region.id === id)?.actionId ?? null;
};
