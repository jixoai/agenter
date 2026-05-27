import type { CliRenderer, KeyEvent } from "@opentui/core";

import type { ChildLayoutNode } from "../renderable-mux/layout";
import type { OpenTuiRenderableSurface } from "../renderable-mux/pane-source";
import { ShellNextRoomApp, type ShellNextRoomAppInput, type ShellNextRoomLayoutMode } from "../product-room/room-app";

export interface ShellNextRoomAppSurfaceInput {
  readonly renderer: CliRenderer;
  readonly node: ChildLayoutNode;
  readonly room: Omit<
    ShellNextRoomAppInput,
    "renderer" | "hostNode" | "mountRoot" | "onHostFocus" | "onQuit" | "onLayoutRequest"
  >;
  readonly onFocus?: (paneId: string) => void;
  readonly onQuit?: () => void;
  readonly onLayoutRequest?: (mode: ShellNextRoomLayoutMode) => void | Promise<void | { closeCurrentSurface: boolean }>;
  readonly onTopLayerRequest?: () => void | Promise<void>;
  readonly layoutMode?: ShellNextRoomLayoutMode;
}

const toHostNode = (node: ChildLayoutNode) => ({
  id: node.id,
  rect: node.rect,
  focused: node.focused,
});

export class ShellNextRoomAppSurface implements OpenTuiRenderableSurface {
  readonly #app: ShellNextRoomApp;
  #layoutMode: ShellNextRoomLayoutMode;
  #node: ChildLayoutNode;

  constructor(input: ShellNextRoomAppSurfaceInput) {
    this.#node = input.node;
    this.#layoutMode = input.layoutMode ?? "right";
    this.#app = new ShellNextRoomApp({
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

  setLayoutMode(mode: ShellNextRoomLayoutMode): void {
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
