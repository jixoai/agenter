import { BoxRenderable, TextRenderable, type CliRenderer, type MouseEvent } from "@opentui/core";

import type { ChildLayoutNode } from "../renderable-mux/layout";
import { ShellButtonPressController } from "../renderable-mux/button-press-controller";
import {
  ShellPaneChromeController,
  resolveShellPaneChromeClick,
  shellPaneButtonLabel,
  shellPaneCloseAction,
  type ShellPaneChromeHitRegion,
} from "../renderable-mux/pane-chrome";
import { PANE_CONTENT_ORIGIN, resolveBorderedPaneContentSize } from "../renderable-mux/pane-content-geometry";
import type { OpenTuiRenderableSurface } from "../renderable-mux/pane-source";
import {
  createShellRendererSelectionBehavior,
  type ShellRendererSelectionBehavior,
} from "../renderable-mux/renderer-selection";
import type { ShellRoomLayoutMode } from "../app-room/room-app";

export interface ShellChatSurfaceInput {
  renderer: CliRenderer;
  node: ChildLayoutNode;
  onFocus?: (paneId: string) => void;
  onClose?: (paneId: string) => void;
  onLayoutRequest?: (mode: ShellRoomLayoutMode) => void | Promise<void | { closeCurrentSurface: boolean }>;
  title?: string | null;
  layoutMode?: ShellRoomLayoutMode;
}

const chatLines = [
  "shell chat",
  "",
  "Room: local shell incubation",
  "Status: waiting for app bootstrap binding",
  "",
  "This pane is an OpenTUI-native surface, not a terminal-protocol pane.",
];

export class ShellChatSurface implements OpenTuiRenderableSurface {
  readonly #renderer: CliRenderer;
  readonly #root: BoxRenderable;
  readonly #content: TextRenderable;
  readonly #onFocus: ((paneId: string) => void) | undefined;
  readonly #onClose: ((paneId: string) => void) | undefined;
  readonly #onLayoutRequest:
    | ((mode: ShellRoomLayoutMode) => void | Promise<void | { closeCurrentSurface: boolean }>)
    | undefined;
  readonly #chrome: ShellPaneChromeController;
  readonly #buttonPress: ShellButtonPressController<string>;
  readonly #selectionBehavior: ShellRendererSelectionBehavior;
  readonly #title: string;
  #node: ChildLayoutNode;
  #chromeRegions: readonly ShellPaneChromeHitRegion[] = [];
  #layoutMode: ShellRoomLayoutMode;
  #hoveredChromeAction: string | null = null;

  constructor(input: ShellChatSurfaceInput) {
    this.#renderer = input.renderer;
    this.#node = input.node;
    this.#onFocus = input.onFocus;
    this.#onClose = input.onClose;
    this.#onLayoutRequest = input.onLayoutRequest;
    this.#selectionBehavior = createShellRendererSelectionBehavior({
      renderer: this.#renderer,
      resolveTargets: () => [{ renderable: this.#content }],
    });
    this.#buttonPress = new ShellButtonPressController({
      resolveAction: (event) => resolveShellPaneChromeClick({ event, regions: this.#chromeRegions }),
      onClick: (action, event) => {
        event.preventDefault();
        if (action === "close") {
          this.#onClose?.(this.#node.id);
          return;
        }
        if (action === "layout-left" || action === "layout-right" || action === "layout-float") {
          const mode = action === "layout-left" ? "left" : action === "layout-right" ? "right" : "float";
          void this.#onLayoutRequest?.(mode);
        }
      },
      onHoverChange: (action) => {
        if (action === this.#hoveredChromeAction) {
          return;
        }
        this.#hoveredChromeAction = action;
        this.syncNode(this.#node);
      },
    });
    this.#chrome = new ShellPaneChromeController({
      renderer: this.#renderer,
      id: `${input.node.id}-chat-chrome`,
      bg: "#0f172a",
      onMouseDown: (event) => this.#handleMouseDown(event),
      onMouseUp: (event) => this.#handleMouseUp(event),
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
    this.#root.onMouseUp = (event) => this.#handleMouseUp(event);
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
            label: shellPaneButtonLabel("←"),
            active: this.#layoutMode === "left",
          },
          {
            id: "layout-right",
            label: shellPaneButtonLabel("→"),
            active: this.#layoutMode === "right",
          },
          {
            id: "layout-float",
            label: shellPaneButtonLabel("⿻"),
            active: this.#layoutMode === "float",
          },
          shellPaneCloseAction(),
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

  setLayoutMode(mode: ShellRoomLayoutMode): void {
    this.#layoutMode = mode;
    this.syncNode(this.#node);
  }

  dispose(): void {
    this.#chrome.destroy();
    this.#root.destroyRecursively();
  }

  #handleMouseDown(event: MouseEvent): void {
    if (this.#selectionBehavior.handleMouseDown(event)) {
      this.#onFocus?.(this.#node.id);
      return;
    }
    if (this.#buttonPress.handleMouseDown(event)) {
      return;
    }
    this.#onFocus?.(this.#node.id);
  }

  #handleMouseUp(event: MouseEvent): void {
    if (this.#selectionBehavior.handleMouseUp(event)) {
      return;
    }
    this.#buttonPress.handleMouseUp(event);
  }

  #handleMouseMove(event: MouseEvent): void {
    this.#buttonPress.handleMouseMove(event);
  }
}
