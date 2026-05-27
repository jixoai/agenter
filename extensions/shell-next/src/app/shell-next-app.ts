import { CliRenderEvents, type CliRenderer } from "@opentui/core";

import { encodeShellNextTerminalKey } from "../input/terminal-key";
import { copyRendererSelection, isShellNextCopyKey } from "../renderable-mux/host-copy";
import { createRootLayout, type ChildLayoutNode, type RootLayout } from "../renderable-mux/layout";
import { ShellNextMuxRenderable } from "../renderable-mux/mux-renderable";
import { createOpenTuiRenderablePaneSource, type OpenTuiRenderableSurface } from "../renderable-mux/pane-source";
import { ShellNextStatusbarRenderable, type ShellNextStatusbarState } from "../renderable-mux/statusbar";
import type { LocalBunTerminalExitEvent } from "../sources/bun-terminal-protocol-source";
import { ShellNextStatusSurface } from "../surfaces/status-surface";
import { ShellNextTopLayerSurface, createEmptyShellNextApprovalStore } from "../surfaces/top-layer-surface";
import { createShellNextFrameBufferTerminalPane } from "../terminal-projection/framebuffer-terminal-pane";
import { createDefaultShellNextTerminalSourcePolicy } from "./default-shell-source";
import { ShellNextFocusEventDispatcher } from "./focus-event-dispatcher";
import { createShellNextProductSurface, toggleShellNextProductSurface } from "./product-surface-actions";
import { createShellNextRenderer } from "./renderer-defaults";
import {
  defaultShellNextStatusbarState,
  focusDirectionFromShiftArrow,
  readShellNextKeyEvent,
  shouldShellNextSkipKey,
} from "./shell-next-app-helpers";
import type { ShellNextAppController, ShellNextAppInput } from "./shell-next-app-types";

export type { ShellNextAppController, ShellNextAppInput } from "./shell-next-app-types";

const STATUSBAR_HEIGHT = 1;

export class ShellNextApp implements ShellNextAppController {
  readonly #renderer: CliRenderer;
  readonly #ownsRenderer: boolean;
  readonly #cwd: string;
  readonly #command: readonly string[] | undefined;
  readonly #layout: RootLayout;
  readonly #mux: ShellNextMuxRenderable;
  readonly #statusbar: ShellNextStatusbarRenderable;
  readonly #topLayer: ShellNextTopLayerSurface;
  readonly #input: ShellNextAppInput;
  readonly #terminalSourcePolicy: NonNullable<ShellNextAppInput["terminalSourcePolicy"]>;
  readonly #room: ShellNextAppInput["room"];
  readonly #rootPane: NonNullable<ShellNextAppInput["rootPane"]>;
  readonly #initialSurfaces: readonly ("help" | "chat")[];
  readonly #showTopLayer: boolean;
  readonly #showStatusbar: boolean;
  readonly #syncStatusbarWithLayout: boolean;
  readonly #keyDispatcher = new ShellNextFocusEventDispatcher();
  #resolveFinished: () => void = () => undefined;
  readonly finished: Promise<void>;
  #disposed = false;
  #paneCounter = 1;
  #status: ShellNextStatusbarState;
  #prefixPending = false;

  constructor(input: ShellNextAppInput & { renderer: CliRenderer; ownsRenderer?: boolean }) {
    this.#input = input;
    this.#renderer = input.renderer;
    this.#ownsRenderer = input.ownsRenderer === true;
    this.#cwd = input.cwd ?? process.cwd();
    this.#command = input.command;
    this.#terminalSourcePolicy = input.terminalSourcePolicy ?? createDefaultShellNextTerminalSourcePolicy();
    this.#room = input.room;
    this.#rootPane = input.rootPane ?? { id: "pane-1", sourceId: "source-1", sourceKind: "terminal-protocol" };
    this.#initialSurfaces = input.initialSurfaces ?? [];
    this.#showTopLayer = input.showTopLayer === true;
    this.#showStatusbar = input.showStatusbar !== false;
    this.#syncStatusbarWithLayout = input.syncStatusbarWithLayout !== false;
    this.#status = input.initialStatus ?? defaultShellNextStatusbarState;
    this.#layout = createRootLayout(this.#contentRect(), [this.#rootPane]);
    const initialNode = this.#layout.children[0];
    const initialSource =
      this.#rootPane.sourceKind === "terminal-protocol"
        ? this.#terminalSourcePolicy.createInitialSource({
            id: this.#rootPane.sourceId ?? this.#rootPane.id,
            cwd: this.#cwd,
            command: this.#command,
            node: initialNode,
            onExit: (event) => this.#handlePaneExit(event),
          })
        : createOpenTuiRenderablePaneSource({
            id: { value: this.#rootPane.sourceId ?? this.#rootPane.id },
            surface: this.#createRootSurface(initialNode),
          });
    this.#mux = new ShellNextMuxRenderable({
      renderer: this.#renderer,
      layout: this.#layout,
      sources: [initialSource],
      titleForPane: (node, source) =>
        node.sourceKind === "terminal-protocol"
          ? source.kind === "terminal-protocol"
            ? (source.readTitle?.() ?? node.id)
            : node.id
          : node.id,
      terminalPaneFactory: input.terminalPaneFactory ?? createShellNextFrameBufferTerminalPane,
      onFocus: () => this.#syncStatusbar(),
      onCloseRequest: (paneId) => {
        if (this.#mux.focusPane(paneId)) {
          this.#openCloseConfirm();
        }
      },
    });
    this.#statusbar = new ShellNextStatusbarRenderable({
      renderer: this.#renderer,
      state: this.#status,
      x: 0,
      y: Math.max(0, this.#renderer.height - STATUSBAR_HEIGHT),
      width: Math.max(1, this.#renderer.width),
      onAction: (action) => {
        this.#toggleProductSurface(action);
        this.#syncStatusbar();
      },
    });
    this.#topLayer = new ShellNextTopLayerSurface({
      renderer: this.#renderer,
      store: input.approvalStore ?? createEmptyShellNextApprovalStore(),
      shellName: "shell-next",
    });
    this.finished = new Promise<void>((resolve) => {
      this.#resolveFinished = resolve;
    });
    this.#keyDispatcher.register({
      id: "top-layer",
      scope: "top-layer",
      active: () => this.#topLayer.visible,
      onKey: (key) => this.#topLayer.handleKeypress(key),
    });
    this.#keyDispatcher.register({
      id: "focused-pane",
      scope: "pane",
      active: () => this.#topLayer.visible !== true && this.#prefixPending !== true,
      onKey: (key) => this.#mux.dispatchFocusedPaneKey(key),
    });
    this.#keyDispatcher.register({
      id: "global",
      scope: "global",
      active: () => true,
      onKey: (key) => this.#handleGlobalKeypress(key),
    });
  }

  start(): void {
    this.#mux.mount();
    if (this.#showStatusbar) {
      for (const node of this.#statusbar.nodes) {
        this.#renderer.root.add(node);
      }
    }
    this.#renderer.root.add(this.#topLayer.root);
    this.#topLayer.start();
    this.#renderer.keyInput.on("keypress", this.#dispatchKeypress);
    this.#renderer.on(CliRenderEvents.RESIZE, this.#handleResize);
    for (const surface of this.#initialSurfaces) {
      this.#toggleProductSurface(surface);
    }
    if (this.#showTopLayer) {
      this.#topLayer.show();
    }
    this.#syncStatusbar();
  }

  destroy(): void {
    if (this.#disposed) {
      return;
    }
    this.#disposed = true;
    this.#renderer.keyInput.off("keypress", this.#dispatchKeypress);
    this.#renderer.off(CliRenderEvents.RESIZE, this.#handleResize);
    this.#topLayer.destroy();
    this.#statusbar.destroy();
    this.#mux.destroy();
    if (this.#ownsRenderer) {
      this.#renderer.destroy();
    }
    this.#resolveFinished();
  }

  splitFocusedShellRight(): boolean {
    if (this.#mux.focusedNode?.sourceKind !== "terminal-protocol") {
      return false;
    }
    this.#paneCounter += 1;
    const id = `pane-${this.#paneCounter}`;
    const sourceId = `source-${this.#paneCounter}`;
    const focused = this.#mux.focusedNode;
    if (!focused) {
      return false;
    }
    const source = this.#terminalSourcePolicy.createSplitSource?.({
      id: sourceId,
      cwd: this.#cwd,
      command: this.#command,
      node: focused,
      onExit: (event) => this.#handlePaneExit(event),
    });
    if (!source) {
      const reason = this.#terminalSourcePolicy.describeSplitUnavailable?.() ?? "Terminal split is unavailable";
      this.#input.onTerminalSplitUnavailable?.(reason);
      this.#setRuntimeNotice(reason);
      return false;
    }
    return this.#mux.splitFocused("right", { id, sourceId, sourceKind: "terminal-protocol" }, source);
  }

  closePane(paneId: string): boolean {
    const closed = this.#layout.close(paneId);
    if (!closed) {
      return false;
    }
    this.#mux.syncLayout();
    this.#syncStatusbar();
    return true;
  }

  #toggleProductSurface(kind: "help" | "chat"): boolean {
    return toggleShellNextProductSurface({
      kind,
      renderer: this.#renderer,
      layout: this.#layout,
      mux: this.#mux,
      room: this.#room,
      onClose: (paneId) => {
        this.closePane(paneId);
      },
      onTopLayerRequest: () => {
        this.#topLayer.show();
      },
    });
  }

  #contentRect() {
    return {
      x: 0,
      y: 0,
      width: Math.max(1, this.#renderer.width),
      height: Math.max(1, this.#renderer.height - (this.#showStatusbar ? STATUSBAR_HEIGHT : 0)),
    };
  }

  #syncStatusbar(): void {
    if (this.#syncStatusbarWithLayout) {
      const terminalCount = this.#layout.children.filter((node) => node.sourceKind === "terminal-protocol").length;
      this.#status = {
        ...this.#status,
        attention: {
          focused: this.#mux.focusedNode ? 1 : 0,
          background: Math.max(0, terminalCount - 1),
          muted: this.#layout.children.filter((node) => node.sourceKind === "opentui-renderable").length,
        },
      };
    }
    this.#statusbar.sync({
      state: this.#status,
      x: 0,
      y: Math.max(0, this.#renderer.height - STATUSBAR_HEIGHT),
      width: Math.max(1, this.#renderer.width),
    });
    const focused = this.#mux.focusedNode;
    if (focused?.id === this.#rootPane.id && focused.sourceKind === "opentui-renderable") {
      this.#mux.syncLayout();
    }
    this.#renderer.requestRender();
  }

  #handlePaneExit(event: LocalBunTerminalExitEvent): void {
    if (this.#disposed) {
      return;
    }
    this.#status = {
      ...this.#status,
      runtime: { label: event.processExitCode === 0 ? "Idle" : "Stopped" },
    };
    this.#syncStatusbar();
  }

  #setRuntimeNotice(label: string): void {
    this.#status = {
      ...this.#status,
      runtime: { label },
    };
    this.#syncStatusbar();
  }

  #handleResize = (): void => {
    this.#layout.resize(this.#contentRect());
    this.#mux.syncLayout();
    this.#syncStatusbar();
  };

  #openCloseConfirm(): void {
    const focused = this.#mux.focusedNode;
    const title =
      focused?.sourceKind === "terminal-protocol"
        ? (this.#mux.getTerminalSource(focused.id)?.readTitle?.() ?? focused.id)
        : (focused?.id ?? this.#rootPane.id);
    this.#topLayer.showCloseConfirm({
      title,
      onBackgroundRun: () => {
        this.destroy();
      },
      onTerminate: async () => {
        const current = this.#mux.focusedNode;
        if (current?.sourceKind === "terminal-protocol") {
          const source = this.#mux.getTerminalSource(current.id);
          await source?.dispose();
          this.#mux.closePane(current.id);
        }
        this.destroy();
      },
    });
  }

  #dispatchKeypress = (value: unknown): void => {
    const key = readShellNextKeyEvent(value);
    if (!key) {
      return;
    }
    this.#keyDispatcher.dispatch(key);
  };

  #handleGlobalKeypress(key: ReturnType<typeof readShellNextKeyEvent> & {}): boolean {
    if (shouldShellNextSkipKey(key)) {
      return false;
    }
    if (isShellNextCopyKey(key)) {
      if (this.#mux.focusedNode?.sourceKind === "terminal-protocol") {
        const copied = this.#mux.getTerminalSource(this.#mux.focusedNode.id)?.copySelection?.("terminal") ?? false;
        const didCopy =
          typeof copied === "string" ? copied.length > 0 && this.#renderer.copyToClipboardOSC52(copied) : copied;
        if (didCopy) {
          key.preventDefault();
        }
        return true;
      }
      if (copyRendererSelection(this.#renderer)) {
        key.preventDefault();
      }
      return true;
    }
    if (this.#prefixPending) {
      this.#prefixPending = false;
      if (key.name === "h" || key.name === "?" || key.sequence === "?") {
        key.preventDefault();
        this.#toggleProductSurface("help");
        this.#syncStatusbar();
        return true;
      }
      if (key.name === "c") {
        key.preventDefault();
        this.#toggleProductSurface("chat");
        this.#syncStatusbar();
        return true;
      }
      if (key.name === "q") {
        key.preventDefault();
        this.#openCloseConfirm();
        return true;
      }
    }
    if (key.ctrl && key.name === "b") {
      key.preventDefault();
      this.#prefixPending = true;
      return true;
    }
    if (key.ctrl && key.name === "n") {
      key.preventDefault();
      this.splitFocusedShellRight();
      this.#syncStatusbar();
      return true;
    }
    if (key.ctrl && key.name === "w") {
      key.preventDefault();
      this.#mux.closeFocused();
      this.#syncStatusbar();
      return true;
    }
    if (key.name === "tab") {
      key.preventDefault();
      const children = this.#layout.children;
      const focusedIndex = children.findIndex((node) => node.focused);
      const next = children[(focusedIndex + 1) % children.length];
      if (next) {
        this.#mux.focusPane(next.id);
      }
      this.#syncStatusbar();
      return true;
    }
    const direction = focusDirectionFromShiftArrow(key);
    if (direction) {
      key.preventDefault();
      this.#mux.focusAdjacent(direction);
      this.#syncStatusbar();
      return true;
    }
    if (this.#mux.focusedNode?.sourceKind !== "terminal-protocol") {
      return false;
    }
    const encoded = encodeShellNextTerminalKey(key);
    if (!encoded) {
      return false;
    }
    void this.#mux.writeFocusedInput(encoded);
    key.preventDefault();
    return true;
  }

  #createRootSurface(node: ChildLayoutNode): OpenTuiRenderableSurface {
    const sourceId = this.#rootPane.sourceId ?? this.#rootPane.id;
    if (sourceId === "view-status") {
      return new ShellNextStatusSurface({
        renderer: this.#renderer,
        node,
        getState: () => this.#status,
      });
    }
    if (sourceId === "view-help") {
      return createShellNextProductSurface({
        kind: "help",
        renderer: this.#renderer,
        node,
      });
    }
    if (sourceId === "view-room") {
      return createShellNextProductSurface({
        kind: "chat",
        renderer: this.#renderer,
        node,
        room: this.#room,
        onTopLayerRequest: () => {
          this.#topLayer.show();
        },
      });
    }
    throw new Error(`unsupported shell-next root renderable source: ${sourceId}`);
  }
}

export const startShellNextApp = async (input: ShellNextAppInput = {}): Promise<ShellNextAppController> => {
  const renderer = input.renderer ?? (await createShellNextRenderer());
  const app = new ShellNextApp({
    ...input,
    renderer,
    ownsRenderer: input.renderer === undefined,
  });
  app.start();
  return app;
};
