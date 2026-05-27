import { BoxRenderable, TextRenderable, type CliRenderer, type MouseEvent } from "@opentui/core";

import type { ChildLayoutNode } from "../renderable-mux/layout";
import {
  ShellNextPaneChromeController,
  resolveShellNextPaneChromeClick,
  shellNextPaneButtonLabel,
  shellNextPaneCloseAction,
  type ShellNextPaneChromeHitRegion,
} from "../renderable-mux/pane-chrome";
import { PANE_CONTENT_ORIGIN, resolveBorderedPaneContentSize } from "../renderable-mux/pane-content-geometry";
import type { OpenTuiRenderableSurface } from "../renderable-mux/pane-source";
import type { ShellNextRoomLayoutMode } from "../product-room/room-app";

export interface ShellNextChatSurfaceInput {
  renderer: CliRenderer;
  node: ChildLayoutNode;
  onFocus?: (paneId: string) => void;
  onClose?: (paneId: string) => void;
  onLayoutRequest?: (mode: ShellNextRoomLayoutMode) => void | Promise<void | { closeCurrentSurface: boolean }>;
  title?: string | null;
  layoutMode?: ShellNextRoomLayoutMode;
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
  readonly #onLayoutRequest:
    | ((mode: ShellNextRoomLayoutMode) => void | Promise<void | { closeCurrentSurface: boolean }>)
    | undefined;
  readonly #chrome: ShellNextPaneChromeController;
  readonly #title: string;
  #node: ChildLayoutNode;
  #chromeRegions: readonly ShellNextPaneChromeHitRegion[] = [];
  #layoutMode: ShellNextRoomLayoutMode;
  #hoveredChromeAction: string | null = null;

  constructor(input: ShellNextChatSurfaceInput) {
    this.#renderer = input.renderer;
    this.#node = input.node;
    this.#onFocus = input.onFocus;
    this.#onClose = input.onClose;
    this.#onLayoutRequest = input.onLayoutRequest;
    this.#chrome = new ShellNextPaneChromeController({
      renderer: this.#renderer,
      id: `${input.node.id}-chat-chrome`,
      bg: "#0f172a",
      onMouseDown: (event) => this.#handleMouseDown(event),
      onMouseMove: (event) => this.#handleMouseMove(event),
    });
    this.#title = input.title?.trim() || "Chat";
    this.#layoutMode = input.layoutMode ?? "right";
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
    this.#root.onMouseDown = (event) => this.#handleMouseDown(event);
    this.#root.onMouseMove = (event) => this.#handleMouseMove(event);
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
    this.#chromeRegions = this.#chrome.sync({
      root: this.#root,
      rect: node.rect,
      state: {
        title: this.#title,
        hoveredActionId: this.#hoveredChromeAction,
        actions: [
          {
            id: "layout-left",
            label: shellNextPaneButtonLabel("←"),
            active: this.#layoutMode === "left",
          },
          {
            id: "layout-right",
            label: shellNextPaneButtonLabel("→"),
            active: this.#layoutMode === "right",
          },
          {
            id: "layout-float",
            label: shellNextPaneButtonLabel("⿻"),
            active: this.#layoutMode === "float",
          },
          shellNextPaneCloseAction(),
        ],
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

  setLayoutMode(mode: ShellNextRoomLayoutMode): void {
    this.#layoutMode = mode;
    this.syncNode(this.#node);
  }

  dispose(): void {
    this.#chrome.destroy();
    this.#root.destroyRecursively();
  }

  #handleMouseDown(event: MouseEvent): void {
    const action = resolveShellNextPaneChromeClick({ event, regions: this.#chromeRegions });
    if (action === "close") {
      event.preventDefault();
      this.#onClose?.(this.#node.id);
      return;
    }
    if (action === "layout-left" || action === "layout-right" || action === "layout-float") {
      event.preventDefault();
      const mode = action === "layout-left" ? "left" : action === "layout-right" ? "right" : "float";
      void this.#onLayoutRequest?.(mode);
      return;
    }
    this.#onFocus?.(this.#node.id);
  }

  #handleMouseMove(event: MouseEvent): void {
    const action = resolveShellNextPaneChromeClick({ event, regions: this.#chromeRegions });
    if (action !== this.#hoveredChromeAction) {
      this.#hoveredChromeAction = action;
      this.syncNode(this.#node);
    }
    if (action) {
      event.preventDefault();
    }
  }
}
