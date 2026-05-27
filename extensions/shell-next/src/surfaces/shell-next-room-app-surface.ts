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
}

const toHostNode = (node: ChildLayoutNode) => ({
  id: node.id,
  rect: node.rect,
  focused: node.focused,
});

export class ShellNextRoomAppSurface implements OpenTuiRenderableSurface {
  readonly #app: ShellNextRoomApp;
  #node: ChildLayoutNode;

  constructor(input: ShellNextRoomAppSurfaceInput) {
    this.#node = input.node;
    this.#app = new ShellNextRoomApp({
      ...input.room,
      renderer: input.renderer,
      hostNode: toHostNode(input.node),
      mountRoot: false,
      onHostFocus: input.onFocus,
      hostChrome: {
        title: "Chat",
        closeLabel: "x",
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
