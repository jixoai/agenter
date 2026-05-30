import {
  RGBA,
  StyledText,
  TextRenderable,
  type CliRenderer,
  type MouseEvent,
} from "@opentui/core";

import {
  buildShellButtonStyledText,
  normalizeShellButtonLabel,
  resolveShellButtonAt,
  type ShellButtonRegion,
} from "./button";
import { ShellButtonPressController } from "./button-press-controller";

export interface ShellRuntimeStatusSummary {
  readonly label: string;
}

export interface ShellAttentionContextSummary {
  readonly focused: number;
  readonly background: number;
  readonly muted: number;
}

export interface ShellAiContextSummary {
  readonly usedTokens: number;
  readonly maxTokens: number;
}

export type ShellStatusbarAction = "help" | "chat";

export interface ShellStatusbarState {
  readonly runtime: ShellRuntimeStatusSummary;
  readonly attention?: ShellAttentionContextSummary;
  readonly aiContext?: ShellAiContextSummary;
  readonly actions?: readonly string[];
  readonly activeActions?: readonly ShellStatusbarAction[];
}

export interface ShellStatusbarRenderableInput {
  renderer: CliRenderer;
  state: ShellStatusbarState;
  x: number;
  y: number;
  width: number;
  onAction?: (action: ShellStatusbarAction) => void;
}

export interface ShellStatusbarLayout {
  readonly left: string;
  readonly center: string;
  readonly right: string;
}

const statusSeparator = " · ";
const defaultActions = ["Help", "Chat"] as const;
const actionGap = " ";
const statusbarFg = {
  left: RGBA.fromHex("#cbd5e1"),
  center: RGBA.fromHex("#38bdf8"),
  right: RGBA.fromHex("#f8fafc"),
};

const clampCount = (value: number): number => Math.max(0, Math.trunc(value));

const formatPercent = (value: number): string => `${value.toFixed(1)}%`;

const truncateEnd = (text: string, width: number): string => {
  if (width <= 0) {
    return "";
  }
  if (text.length <= width) {
    return text;
  }
  if (width <= 3) {
    return text.slice(0, width);
  }
  return `${text.slice(0, width - 3)}...`;
};

export const buildShellStatusbarLeft = (state: ShellStatusbarState): string => {
  const segments = [state.runtime.label];
  if (state.attention) {
    segments.push(`${clampCount(state.attention.focused)} focused`);
    segments.push(`${clampCount(state.attention.background)} background`);
    segments.push(`${clampCount(state.attention.muted)} muted`);
  }
  return segments.join(statusSeparator);
};

export const buildShellStatusbarCenter = (state: ShellStatusbarState): string => {
  if (!state.aiContext || state.aiContext.maxTokens <= 0) {
    return "";
  }
  const usedPercent = (Math.max(0, state.aiContext.usedTokens) / state.aiContext.maxTokens) * 100;
  return `Context ${formatPercent(usedPercent)} used`;
};

const normalizeActionName = (value: string): ShellStatusbarAction | null => {
  const normalized = value.trim().toLowerCase();
  if (normalized === "help" || normalized === "[help]") {
    return "help";
  }
  if (normalized === "chat" || normalized === "[chat]") {
    return "chat";
  }
  return null;
};

const buildActionLabel = (value: string): string => normalizeShellButtonLabel(value);

export const buildShellStatusbarRight = (state: ShellStatusbarState): string =>
  (state.actions ?? defaultActions).map(buildActionLabel).join(actionGap);

export const buildShellStatusbarLayout = (state: ShellStatusbarState, width: number): ShellStatusbarLayout => {
  const safeWidth = Math.max(1, Math.trunc(width));
  const right = buildShellStatusbarRight(state);
  if (right.length >= safeWidth) {
    return {
      left: "",
      center: "",
      right: right.slice(0, safeWidth),
    };
  }
  const center = buildShellStatusbarCenter(state);
  const reservedForRight = right.length;
  const centerReserved = center.length > 0 ? center.length + 4 : 0;
  const minLeftVisible = Math.min(buildShellStatusbarLeft(state).length, 4);
  const keepCenter = centerReserved > 0 && safeWidth >= reservedForRight + centerReserved + minLeftVisible;
  const leftAvailable = Math.max(0, safeWidth - reservedForRight - (keepCenter ? centerReserved : 0));
  const left = truncateEnd(buildShellStatusbarLeft(state), leftAvailable);
  const visibleCenter = keepCenter ? center : "";
  const consumed = left.length + visibleCenter.length + right.length;
  if (consumed <= safeWidth) {
    return { left, center: visibleCenter, right };
  }
  const shrunkLeft = truncateEnd(left, Math.max(0, safeWidth - visibleCenter.length - right.length));
  return { left: shrunkLeft, center: visibleCenter, right };
};

export const buildShellStatusbarText = (state: ShellStatusbarState, width: number): string => {
  const layout = buildShellStatusbarLayout(state, width);
  const right = layout.right;
  const safeWidth = Math.max(1, Math.trunc(width));
  if (right.length >= safeWidth) {
    return right.slice(0, safeWidth);
  }
  const prefix = `${layout.left}${layout.left.length > 0 && layout.center.length > 0 ? "    " : ""}${layout.center}`;
  const padding = " ".repeat(Math.max(0, safeWidth - prefix.length - right.length));
  return `${prefix}${padding}${right}`.slice(0, safeWidth);
};

export class ShellStatusbarRenderable {
  readonly #renderer: CliRenderer;
  readonly #left: TextRenderable;
  readonly #center: TextRenderable;
  readonly #right: TextRenderable;
  readonly #onAction: ((action: ShellStatusbarAction) => void) | undefined;
  #state: ShellStatusbarState;
  #width: number;
  #x: number;
  #y: number;
  #actionRegions: ShellButtonRegion[] = [];
  #hoveredAction: ShellStatusbarAction | null = null;
  readonly #pressController: ShellButtonPressController<ShellStatusbarAction>;

  constructor(input: ShellStatusbarRenderableInput) {
    this.#renderer = input.renderer;
    this.#state = input.state;
    this.#width = Math.max(1, Math.trunc(input.width));
    this.#x = input.x;
    this.#y = input.y;
    this.#onAction = input.onAction;
    this.#left = this.#createText("shell-statusbar-left", "#cbd5e1");
    this.#center = this.#createText("shell-statusbar-center", "#38bdf8");
    this.#right = this.#createText("shell-statusbar-right", "#f8fafc");
    this.#pressController = new ShellButtonPressController({
      resolveAction: (event) => this.#resolveActionAt(event),
      onClick: (action) => {
        this.#onAction?.(action);
      },
      onHoverChange: (action) => {
        if (action === this.#hoveredAction) {
          return;
        }
        this.#hoveredAction = action;
        this.#applyLayout(buildShellStatusbarLayout(this.#state, this.#width));
        this.#renderer.requestRender();
      },
    });
    for (const node of [this.#left, this.#center, this.#right]) {
      node.onMouseDown = (event) => this.#handleMouseDown(event);
      node.onMouseUp = (event) => this.#handleMouseUp(event);
      node.onMouseMove = (event) => this.#handleMouseMove(event);
    }
    this.sync({
      state: input.state,
      x: input.x,
      y: input.y,
      width: input.width,
    });
  }

  get root(): TextRenderable {
    return this.#left;
  }

  get nodes(): readonly TextRenderable[] {
    return [this.#left, this.#center, this.#right];
  }

  sync(input: { state?: ShellStatusbarState; x?: number; y?: number; width?: number }): void {
    if (input.state) {
      this.#state = input.state;
    }
    if (input.x !== undefined) {
      this.#x = input.x;
    }
    if (input.y !== undefined) {
      this.#y = input.y;
    }
    if (input.width !== undefined) {
      this.#width = Math.max(1, Math.trunc(input.width));
    }
    this.#applyLayout(buildShellStatusbarLayout(this.#state, this.#width));
  }

  destroy(): void {
    for (const node of this.nodes) {
      node.destroyRecursively();
    }
  }

  #createText(id: string, fg: string): TextRenderable {
    return new TextRenderable(this.#renderer, {
      id,
      position: "absolute",
      left: 0,
      top: 0,
      width: 1,
      height: 1,
      content: "",
      fg,
      bg: "#0f172a",
      wrapMode: "none",
    });
  }

  #applyLayout(layout: ShellStatusbarLayout): void {
    const left = layout.left;
    const center = layout.center;
    const right = layout.right;
    const leftGap = left.length > 0 && center.length > 0 ? "    " : "";
    const consumedBeforeRight = left.length + leftGap.length + center.length;
    const rightStart = this.#x + Math.max(0, this.#width - right.length);
    const maxPrefixWidth = Math.max(0, rightStart - this.#x);
    const prefix = `${left}${leftGap}${center}`;
    const clippedPrefix = prefix.slice(0, maxPrefixWidth);
    const visibleLeft = clippedPrefix.slice(0, Math.min(left.length, clippedPrefix.length));
    const visibleCenter = clippedPrefix.slice(visibleLeft.length + Math.min(leftGap.length, Math.max(0, clippedPrefix.length - visibleLeft.length)));

    this.#left.left = this.#x;
    this.#left.top = this.#y;
    this.#left.width = Math.max(1, visibleLeft.length || 1);
    this.#left.content = visibleLeft;

    const centerStart = this.#x + visibleLeft.length + (visibleCenter.length > 0 && visibleLeft.length > 0 ? leftGap.length : 0);
    this.#center.left = centerStart;
    this.#center.top = this.#y;
    this.#center.width = Math.max(1, visibleCenter.length || 1);
    this.#center.content = visibleCenter;

    this.#right.left = rightStart;
    this.#right.top = this.#y;
    this.#right.width = Math.max(1, right.length || 1);
    this.#right.content = this.#buildRightStyledText(right);
    this.#right.fg = "#f8fafc";

    const helpIndex = right.indexOf("[Help]");
    const chatIndex = right.indexOf("[Chat]");
    this.#actionRegions = [
      helpIndex >= 0
        ? { id: "help", y: this.#y, x: rightStart + helpIndex, width: "[Help]".length }
        : null,
      chatIndex >= 0
        ? { id: "chat", y: this.#y, x: rightStart + chatIndex, width: "[Chat]".length }
        : null,
    ].filter((region): region is ShellButtonRegion => region !== null);
  }

  #buildRightStyledText(right: string): StyledText {
    const parts: Array<string | { button: { id: ShellStatusbarAction; label: string; hovered: boolean; active: boolean }; fg: RGBA }> = [];
    let cursor = 0;
    for (const actionLabel of ["[Help]", "[Chat]"] as const) {
      const index = right.indexOf(actionLabel, cursor);
      if (index < 0) {
        continue;
      }
      if (index > cursor) {
        parts.push(right.slice(cursor, index));
      }
      const action = normalizeActionName(actionLabel);
      if (action) {
        parts.push({
          button: {
            id: action,
            label: actionLabel,
            hovered: this.#hoveredAction === action,
            active: (this.#state.activeActions ?? []).includes(action),
          },
          fg: statusbarFg.right,
        });
      } else {
        parts.push(actionLabel);
      }
      cursor = index + actionLabel.length;
    }
    if (cursor < right.length) {
      parts.push(right.slice(cursor));
    }
    return buildShellButtonStyledText(parts.length > 0 ? parts : [right], statusbarFg.right);
  }

  #handleMouseDown(event: MouseEvent): void {
    this.#pressController.handleMouseDown(event);
  }

  #handleMouseUp(event: MouseEvent): void {
    this.#pressController.handleMouseUp(event);
  }

  #handleMouseMove(event: MouseEvent): void {
    this.#pressController.handleMouseMove(event);
  }

  #resolveActionAt(event: MouseEvent): ShellStatusbarAction | null {
    const action = resolveShellButtonAt(event, this.#actionRegions);
    return action === "help" || action === "chat" ? action : null;
  }
}
