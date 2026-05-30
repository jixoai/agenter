import type { CliRenderer, KeyEvent } from "@opentui/core";

import type { ChildLayoutNode } from "../renderable-mux/layout";
import type { OpenTuiRenderableSurface } from "../renderable-mux/pane-source";
import { ShellRoomApp, type ShellRoomAppInput, type ShellRoomLayoutMode } from "../product-room/room-app";

export interface ShellRoomAppSurfaceInput {
  readonly renderer: CliRenderer;
  readonly node: ChildLayoutNode;
  readonly room: Omit<
    ShellRoomAppInput,
    "renderer" | "hostNode" | "mountRoot" | "onHostFocus" | "onQuit" | "onLayoutRequest"
  >;
  readonly onFocus?: (paneId: string) => void;
  readonly onQuit?: () => void;
  readonly onLayoutRequest?: (mode: ShellRoomLayoutMode) => void | Promise<void | { closeCurrentSurface: boolean }>;
  readonly onTopLayerRequest?: () => void | Promise<void>;
  readonly layoutMode?: ShellRoomLayoutMode;
}

const toHostNode = (node: ChildLayoutNode) => ({
  id: node.id,
  rect: node.rect,
  focused: node.focused,
});

export class ShellRoomAppSurface implements OpenTuiRenderableSurface {
  readonly #app: ShellRoomApp;
  #layoutMode: ShellRoomLayoutMode;
  #node: ChildLayoutNode;

  constructor(input: ShellRoomAppSurfaceInput) {
    this.#node = input.node;
    this.#layoutMode = input.layoutMode ?? "right";
    this.#app = new ShellRoomApp({
      ...input.room,
      renderer: input.renderer,
      hostNode: toHostNode(input.node),
      mountRoot: false,
      onHostFocus: input.onFocus,
      hostChrome: {
        title: "Chat",
        layoutMode: this.#layoutMode,
        actions: ["layout-left", "layout-right", "layout-float", "close"],
      },
      onQuit: input.onQuit,
      onLayoutRequest: input.onLayoutRequest,
      onTopLayerRequest: input.onTopLayerRequest,
      ownsRenderer: false,
    });
    this.#app.start();
  }

  get root() {
    return this.#app.root;
  }

  syncNode(node: ChildLayoutNode): void {
    this.#node = node;
    this.#app.syncHostNode(toHostNode(node));
  }

  setLayoutMode(mode: ShellRoomLayoutMode): void {
    this.#layoutMode = mode;
    this.#app.syncHostChrome({
      title: "Chat",
      layoutMode: mode,
      actions: ["layout-left", "layout-right", "layout-float", "close"],
    });
  }

  focus(): void {
    this.#app.focus();
  }

  handleKeypress(key: KeyEvent): boolean {
    return this.#node.focused && this.#app.handleKeypress(key);
  }

  dispose(): void {
    this.#app.dispose();
  }
}
