import {
  RGBA,
  StyledText,
  TextAttributes,
  TextRenderable,
  type CliRenderer,
  type MouseEvent,
  type TextChunk,
} from "@opentui/core";

import { shellNextPaneActionAttributes, shellNextPaneButtonLabel } from "./pane-chrome";

export interface ShellNextRuntimeStatusSummary {
  readonly label: string;
}

export interface ShellNextAttentionContextSummary {
  readonly focused: number;
  readonly background: number;
  readonly muted: number;
}

export interface ShellNextAiContextSummary {
  readonly usedTokens: number;
  readonly maxTokens: number;
}

export type ShellNextStatusbarAction = "help" | "chat";

export interface ShellNextStatusbarState {
  readonly runtime: ShellNextRuntimeStatusSummary;
  readonly attention?: ShellNextAttentionContextSummary;
  readonly aiContext?: ShellNextAiContextSummary;
  readonly actions?: readonly string[];
  readonly activeActions?: readonly ShellNextStatusbarAction[];
}

export interface ShellNextStatusbarRenderableInput {
  renderer: CliRenderer;
  state: ShellNextStatusbarState;
  x: number;
  y: number;
  width: number;
  onAction?: (action: ShellNextStatusbarAction) => void;
}

export interface ShellNextStatusbarLayout {
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
  hover: RGBA.fromHex("#facc15"),
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

export const buildShellNextStatusbarLeft = (state: ShellNextStatusbarState): string => {
  const segments = [state.runtime.label];
  if (state.attention) {
    segments.push(`${clampCount(state.attention.focused)} focused`);
    segments.push(`${clampCount(state.attention.background)} background`);
    segments.push(`${clampCount(state.attention.muted)} muted`);
  }
  return segments.join(statusSeparator);
};

export const buildShellNextStatusbarCenter = (state: ShellNextStatusbarState): string => {
  if (!state.aiContext || state.aiContext.maxTokens <= 0) {
    return "";
  }
  const usedPercent = (Math.max(0, state.aiContext.usedTokens) / state.aiContext.maxTokens) * 100;
  return `Context ${formatPercent(usedPercent)} used`;
};

const normalizeActionName = (value: string): ShellNextStatusbarAction | null => {
  const normalized = value.trim().toLowerCase();
  if (normalized === "help" || normalized === "[help]") {
    return "help";
  }
  if (normalized === "chat" || normalized === "[chat]") {
    return "chat";
  }
  return null;
};

const buildActionLabel = (value: string): string => shellNextPaneButtonLabel(value);

export const buildShellNextStatusbarRight = (state: ShellNextStatusbarState): string =>
  (state.actions ?? defaultActions).map(buildActionLabel).join(actionGap);

export const buildShellNextStatusbarLayout = (state: ShellNextStatusbarState, width: number): ShellNextStatusbarLayout => {
  const safeWidth = Math.max(1, Math.trunc(width));
  const right = buildShellNextStatusbarRight(state);
  if (right.length >= safeWidth) {
    return {
      left: "",
      center: "",
      right: right.slice(0, safeWidth),
    };
  }
  const center = buildShellNextStatusbarCenter(state);
  const reservedForRight = right.length;
  const centerReserved = center.length > 0 ? center.length + 4 : 0;
  const minLeftVisible = Math.min(buildShellNextStatusbarLeft(state).length, 4);
  const keepCenter = centerReserved > 0 && safeWidth >= reservedForRight + centerReserved + minLeftVisible;
  const leftAvailable = Math.max(0, safeWidth - reservedForRight - (keepCenter ? centerReserved : 0));
  const left = truncateEnd(buildShellNextStatusbarLeft(state), leftAvailable);
  const visibleCenter = keepCenter ? center : "";
  const consumed = left.length + visibleCenter.length + right.length;
  if (consumed <= safeWidth) {
    return { left, center: visibleCenter, right };
  }
  const shrunkLeft = truncateEnd(left, Math.max(0, safeWidth - visibleCenter.length - right.length));
  return { left: shrunkLeft, center: visibleCenter, right };
};

export const buildShellNextStatusbarText = (state: ShellNextStatusbarState, width: number): string => {
  const layout = buildShellNextStatusbarLayout(state, width);
  const right = layout.right;
  const safeWidth = Math.max(1, Math.trunc(width));
  if (right.length >= safeWidth) {
    return right.slice(0, safeWidth);
  }
  const prefix = `${layout.left}${layout.left.length > 0 && layout.center.length > 0 ? "    " : ""}${layout.center}`;
  const padding = " ".repeat(Math.max(0, safeWidth - prefix.length - right.length));
  return `${prefix}${padding}${right}`.slice(0, safeWidth);
};

export class ShellNextStatusbarRenderable {
  readonly #renderer: CliRenderer;
  readonly #left: TextRenderable;
  readonly #center: TextRenderable;
  readonly #right: TextRenderable;
  readonly #onAction: ((action: ShellNextStatusbarAction) => void) | undefined;
  #state: ShellNextStatusbarState;
  #width: number;
  #x: number;
  #y: number;
  #helpRegion: { row: number; col: number; width: number } | null = null;
  #chatRegion: { row: number; col: number; width: number } | null = null;
  #hoveredAction: ShellNextStatusbarAction | null = null;

  constructor(input: ShellNextStatusbarRenderableInput) {
    this.#renderer = input.renderer;
    this.#state = input.state;
    this.#width = Math.max(1, Math.trunc(input.width));
    this.#x = input.x;
    this.#y = input.y;
    this.#onAction = input.onAction;
    this.#left = this.#createText("shell-next-statusbar-left", "#cbd5e1");
    this.#center = this.#createText("shell-next-statusbar-center", "#38bdf8");
    this.#right = this.#createText("shell-next-statusbar-right", "#f8fafc");
    for (const node of [this.#left, this.#center, this.#right]) {
      node.onMouseDown = (event) => this.#handleMouseDown(event);
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

  sync(input: { state?: ShellNextStatusbarState; x?: number; y?: number; width?: number }): void {
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
    this.#applyLayout(buildShellNextStatusbarLayout(this.#state, this.#width));
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

  #applyLayout(layout: ShellNextStatusbarLayout): void {
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
    this.#right.content = right;
    this.#right.content = this.#buildRightStyledText(right);
    this.#right.fg = this.#hoveredAction ? "#facc15" : "#f8fafc";

    const helpIndex = right.indexOf("[Help]");
    const chatIndex = right.indexOf("[Chat]");
    this.#helpRegion =
      helpIndex >= 0
        ? { row: this.#y, col: rightStart + helpIndex, width: "[Help]".length }
        : null;
    this.#chatRegion =
      chatIndex >= 0
        ? { row: this.#y, col: rightStart + chatIndex, width: "[Chat]".length }
        : null;
  }

  #buildRightStyledText(right: string): StyledText {
    const chunks: TextChunk[] = [];
    let cursor = 0;
    for (const actionLabel of ["[Help]", "[Chat]"] as const) {
      const index = right.indexOf(actionLabel, cursor);
      if (index < 0) {
        continue;
      }
      if (index > cursor) {
        chunks.push(this.#chunk(right.slice(cursor, index), statusbarFg.right, TextAttributes.NONE));
      }
      const action = normalizeActionName(actionLabel);
      const hovered = action !== null && this.#hoveredAction === action;
      const active = action !== null && (this.#state.activeActions ?? []).includes(action);
      chunks.push(
        this.#chunk(
          actionLabel,
          hovered ? statusbarFg.hover : statusbarFg.right,
          shellNextPaneActionAttributes({ active, hovered }),
        ),
      );
      cursor = index + actionLabel.length;
    }
    if (cursor < right.length) {
      chunks.push(this.#chunk(right.slice(cursor), statusbarFg.right, TextAttributes.NONE));
    }
    return new StyledText(chunks.length > 0 ? chunks : [this.#chunk(right, statusbarFg.right, TextAttributes.NONE)]);
  }

  #chunk(text: string, fg: RGBA, attributes: number): TextChunk {
    return {
      __isChunk: true,
      text,
      fg,
      attributes,
    };
  }

  #handleMouseDown(event: MouseEvent): void {
    const action = this.#resolveActionAt(event);
    if (action) {
      event.preventDefault();
      this.#onAction?.(action);
    }
  }

  #handleMouseMove(event: MouseEvent): void {
    const action = this.#resolveActionAt(event);
    if (action !== this.#hoveredAction) {
      this.#hoveredAction = action;
      this.#applyLayout(buildShellNextStatusbarLayout(this.#state, this.#width));
      this.#renderer.requestRender();
    }
    if (action) {
      event.preventDefault();
    }
  }

  #resolveActionAt(event: MouseEvent): ShellNextStatusbarAction | null {
    const x = Math.trunc(event.x);
    const y = Math.trunc(event.y);
    if (this.#helpRegion && y === this.#helpRegion.row && x >= this.#helpRegion.col && x < this.#helpRegion.col + this.#helpRegion.width) {
      return "help";
    }
    if (this.#chatRegion && y === this.#chatRegion.row && x >= this.#chatRegion.col && x < this.#chatRegion.col + this.#chatRegion.width) {
      return "chat";
    }
    return null;
  }
}
