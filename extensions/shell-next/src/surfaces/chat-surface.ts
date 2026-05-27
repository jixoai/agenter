import { BoxRenderable, TextRenderable, type CliRenderer } from "@opentui/core";

import type { ChildLayoutNode } from "../renderable-mux/layout";
import {
  resolveShellNextPaneChromeClick,
  syncShellNextPaneChrome,
  type ShellNextPaneChromeHitRegion,
} from "../renderable-mux/pane-chrome";
import { PANE_CONTENT_ORIGIN, resolveBorderedPaneContentSize } from "../renderable-mux/pane-content-geometry";
import type { OpenTuiRenderableSurface } from "../renderable-mux/pane-source";

export interface ShellNextChatSurfaceInput {
  renderer: CliRenderer;
  node: ChildLayoutNode;
  onFocus?: (paneId: string) => void;
  onClose?: (paneId: string) => void;
  title?: string | null;
}

const chatLines = [
  "shell-next chat",
  "",
  "Room: local shell-next incubation",
  "Status: waiting for product bootstrap binding",
  "",
  "This pane is an OpenTUI-native surface, not a terminal-protocol pane.",
];

export class ShellNextChatSurface implements OpenTuiRenderableSurface {
  readonly #renderer: CliRenderer;
  readonly #root: BoxRenderable;
  readonly #content: TextRenderable;
  readonly #onFocus: ((paneId: string) => void) | undefined;
  readonly #onClose: ((paneId: string) => void) | undefined;
  readonly #title: string;
  #node: ChildLayoutNode;
  #chromeRegions: readonly ShellNextPaneChromeHitRegion[] = [];

  constructor(input: ShellNextChatSurfaceInput) {
    this.#renderer = input.renderer;
    this.#node = input.node;
    this.#onFocus = input.onFocus;
    this.#onClose = input.onClose;
    this.#title = input.title?.trim() || "Chat";
    this.#root = new BoxRenderable(this.#renderer, {
      id: `${input.node.id}-chat-root`,
      position: "absolute",
      border: true,
      borderStyle: "rounded",
      borderColor: input.node.focused ? "#22c55e" : "#475569",
      focusedBorderColor: "#22c55e",
      backgroundColor: "#0f172a",
      titleAlignment: "left",
      focusable: true,
    });
    this.#root.onMouseDown = (event) => {
      if (resolveShellNextPaneChromeClick({ event, regions: this.#chromeRegions }) === "close") {
        event.preventDefault();
        this.#onClose?.(this.#node.id);
        return;
      }
      this.#onFocus?.(this.#node.id);
    };
    this.#content = new TextRenderable(this.#renderer, {
      id: `${input.node.id}-chat-content`,
      position: "absolute",
      left: PANE_CONTENT_ORIGIN,
      top: PANE_CONTENT_ORIGIN,
      width: resolveBorderedPaneContentSize(input.node.rect).width,
      height: resolveBorderedPaneContentSize(input.node.rect).height,
      content: "",
      fg: "#e5e7eb",
      bg: "#0f172a",
      selectable: true,
      selectionBg: "#86efac",
      selectionFg: "#052e16",
      wrapMode: "word",
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
    this.#root.borderColor = node.focused ? "#22c55e" : "#475569";
    this.#chromeRegions = syncShellNextPaneChrome({
      root: this.#root,
      rect: node.rect,
      state: {
        title: this.#title,
        actions: [{ id: "close", label: "x" }],
      },
    });
    const contentSize = resolveBorderedPaneContentSize(node.rect);
    this.#content.left = PANE_CONTENT_ORIGIN;
    this.#content.top = PANE_CONTENT_ORIGIN;
    this.#content.width = contentSize.width;
    this.#content.height = contentSize.height;
    this.#content.content = chatLines
      .slice(0, contentSize.height)
      .map((line) => line.slice(0, contentSize.width))
      .join("\n");
    if (node.focused) {
      this.focus();
    }
  }

  focus(): void {
    this.#root.focus();
  }

  dispose(): void {
    this.#root.destroyRecursively();
  }
}
