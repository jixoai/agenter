import { BoxRenderable, TextRenderable, type CliRenderer, type MouseEvent } from "@opentui/core";

import type { ChildLayoutNode } from "./layout";
import { PANE_CONTENT_ORIGIN, resolveBorderedPaneContentSize } from "./pane-content-geometry";
import type { TerminalInputChunk, TerminalPaneSize, TerminalProtocolPaneSource } from "./pane-source";

export interface PaneRenderableInput {
  renderer: CliRenderer;
  node: ChildLayoutNode;
  source: TerminalProtocolPaneSource;
  title?: string;
  accentColor?: string;
  onFocus?: (paneId: string) => void;
  onFrameRendered?: (event: PaneFrameRenderEvent) => void;
}

export interface PaneFrameRenderEvent {
  readonly paneId: string;
  readonly revision: number;
  readonly cols: number;
  readonly rows: number;
  readonly elapsedMs: number;
}

export interface DemoPaneRenderableInput {
  renderer: CliRenderer;
  node: ChildLayoutNode;
  title: string;
  accentColor: string;
  selectionText: string;
  onFocus: (paneId: string) => void;
}

const formatTerminalFrame = (input: {
  frame: ReturnType<TerminalProtocolPaneSource["readFrame"]>;
  width: number;
  height: number;
}): string => {
  return input.frame.lines
    .slice(0, input.height)
    .map((line) => line.slice(0, input.width))
    .join("\n");
};

const formatPaneBody = (input: {
  title: string;
  paneId: string;
  focused: boolean;
  selectionText: string;
  width: number;
  height: number;
  clicks: number;
  lastMouse: string;
}): string => {
  const rows = [
    `${input.focused ? "FOCUSED" : "idle"} ${input.title}`,
    `id=${input.paneId}`,
    `clicks=${input.clicks} ${input.lastMouse}`,
    input.selectionText,
    "Try: click pane, drag text, resize terminal.",
  ];
  return rows
    .slice(0, input.height)
    .map((line) => line.slice(0, input.width))
    .join("\n");
};

export class DemoPaneRenderable {
  readonly #renderer: CliRenderer;
  readonly #input: Omit<DemoPaneRenderableInput, "node">;
  readonly #root: BoxRenderable;
  readonly #content: TextRenderable;
  #node: ChildLayoutNode;
  #clicks = 0;
  #lastMouse = "mouse=none";

  constructor(input: DemoPaneRenderableInput) {
    this.#renderer = input.renderer;
    this.#input = input;
    this.#node = input.node;
    this.#root = new BoxRenderable(this.#renderer, {
      id: `${input.node.id}-root`,
      position: "absolute",
      border: true,
      borderStyle: "rounded",
      borderColor: input.node.focused ? input.accentColor : "#475569",
      focusedBorderColor: input.accentColor,
      backgroundColor: "#020617",
      title: input.title,
      focusable: true,
    });
    this.#root.onMouseDown = (event) => this.#handleMouse("down", event);
    this.#root.onMouseDrag = (event) => this.#handleMouse("drag", event);
    this.#root.onMouseUp = (event) => this.#handleMouse("up", event);
    this.#content = new TextRenderable(this.#renderer, {
      id: `${input.node.id}-content`,
      position: "absolute",
      selectable: true,
      wrapMode: "word",
      fg: "#e2e8f0",
      bg: "#020617",
      selectionBg: "#facc15",
      selectionFg: "#020617",
      content: "",
    });
    this.#root.add(this.#content);
    this.syncNode(input.node);
  }

  get root(): BoxRenderable {
    return this.#root;
  }

  syncNode(node: ChildLayoutNode): void {
    this.#node = node;
    this.#root.left = node.rect.x;
    this.#root.top = node.rect.y;
    this.#root.width = node.rect.width;
    this.#root.height = node.rect.height;
    this.#root.borderColor = node.focused ? this.#input.accentColor : "#475569";
    if (node.focused) {
      this.#root.focus();
    }
    const contentSize = resolveBorderedPaneContentSize(node.rect);
    this.#content.left = PANE_CONTENT_ORIGIN;
    this.#content.top = PANE_CONTENT_ORIGIN;
    this.#content.width = contentSize.width;
    this.#content.height = contentSize.height;
    this.#content.content = formatPaneBody({
      title: this.#input.title,
      paneId: node.id,
      focused: node.focused,
      selectionText: this.#input.selectionText,
      width: contentSize.width,
      height: contentSize.height,
      clicks: this.#clicks,
      lastMouse: this.#lastMouse,
    });
  }

  destroy(): void {
    this.#root.destroyRecursively();
  }

  #handleMouse(type: "down" | "drag" | "up", event: MouseEvent): void {
    if (type === "down") {
      this.#clicks += 1;
      this.#input.onFocus(this.#node.id);
    }
    this.#lastMouse = `mouse=${type}@${event.x},${event.y}`;
    this.syncNode(this.#node);
    this.#renderer.requestRender();
  }
}

export class PaneRenderable {
  readonly #renderer: CliRenderer;
  readonly #source: TerminalProtocolPaneSource;
  readonly #input: Omit<PaneRenderableInput, "node" | "source">;
  readonly #root: BoxRenderable;
  readonly #content: TextRenderable;
  #node: ChildLayoutNode;
  #lastSize: TerminalPaneSize | null = null;

  constructor(input: PaneRenderableInput) {
    this.#renderer = input.renderer;
    this.#source = input.source;
    this.#input = input;
    this.#node = input.node;
    const accentColor = input.accentColor ?? "#38bdf8";
    this.#root = new BoxRenderable(this.#renderer, {
      id: `${input.node.id}-pane-root`,
      position: "absolute",
      border: true,
      borderStyle: "rounded",
      borderColor: input.node.focused ? accentColor : "#475569",
      focusedBorderColor: accentColor,
      backgroundColor: "#020617",
      title: input.title ?? input.node.id,
      focusable: true,
    });
    this.#root.onMouseDown = () => {
      this.#input.onFocus?.(this.#node.id);
    };
    this.#content = new TextRenderable(this.#renderer, {
      id: `${input.node.id}-pane-content`,
      position: "absolute",
      // Selection/copy is intentionally not local MVP state; future support must
      // route through backend-owned terminal interaction events.
      selectable: false,
      wrapMode: "none",
      fg: "#e2e8f0",
      bg: "#020617",
      selectionBg: "#facc15",
      selectionFg: "#020617",
      content: "",
    });
    this.#root.add(this.#content);
    this.syncNode(input.node);
  }

  get root(): BoxRenderable {
    return this.#root;
  }

  syncNode(node: ChildLayoutNode): void {
    this.#node = node;
    const accentColor = this.#input.accentColor ?? "#38bdf8";
    this.#root.left = node.rect.x;
    this.#root.top = node.rect.y;
    this.#root.width = node.rect.width;
    this.#root.height = node.rect.height;
    this.#root.borderColor = node.focused ? accentColor : "#475569";
    if (node.focused) {
      this.#root.focus();
    }
    const contentSize = resolveBorderedPaneContentSize(node.rect);
    const size = {
      cols: contentSize.width,
      rows: contentSize.height,
    };
    if (!this.#lastSize || this.#lastSize.cols !== size.cols || this.#lastSize.rows !== size.rows) {
      this.#lastSize = size;
      void this.#source.resize(size);
    }
    this.#content.left = PANE_CONTENT_ORIGIN;
    this.#content.top = PANE_CONTENT_ORIGIN;
    this.#content.width = size.cols;
    this.#content.height = size.rows;
    this.refresh();
  }

  refresh(): void {
    const size = this.#lastSize ?? {
      cols: resolveBorderedPaneContentSize(this.#node.rect).width,
      rows: resolveBorderedPaneContentSize(this.#node.rect).height,
    };
    const startedAt = performance.now();
    const frame = this.#source.readFrame();
    this.#content.content = formatTerminalFrame({
      frame,
      width: size.cols,
      height: size.rows,
    });
    this.#input.onFrameRendered?.({
      paneId: this.#node.id,
      revision: frame.revision,
      cols: size.cols,
      rows: size.rows,
      elapsedMs: Number((performance.now() - startedAt).toFixed(3)),
    });
  }

  writeInput(chunk: TerminalInputChunk): boolean {
    return this.#source.writeInput(chunk);
  }

  destroy(): void {
    void this.#source.dispose();
    this.#root.destroyRecursively();
  }
}
