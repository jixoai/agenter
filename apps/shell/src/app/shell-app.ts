import { CliRenderEvents, type CliRenderer, type Selection } from "@opentui/core";

import {
  copyFinishedRendererSelectionToPrimary,
  copyRendererSelection,
  isShellCopyKey,
  SHELL_CLIPBOARD_TARGETS,
} from "../renderable-mux/host-copy";
import { createRootLayout, type ChildLayoutNode, type RootLayout } from "../renderable-mux/layout";
import { ShellMuxRenderable } from "../renderable-mux/mux-renderable";
import {
  createOpenTuiRenderablePaneSource,
  type OpenTuiRenderablePaneSource,
  type OpenTuiRenderableSurface,
} from "../renderable-mux/pane-source";
import { ShellStatusbarRenderable, type ShellStatusbarState } from "../renderable-mux/statusbar";
import type { LocalBunTerminalExitEvent } from "../sources/bun-terminal-protocol-source";
import { ShellStatusSurface } from "../surfaces/status-surface";
import { ShellTopLayerSurface, createEmptyShellApprovalStore } from "../surfaces/top-layer-surface";
import { createShellFrameBufferTerminalPane } from "../terminal-projection/framebuffer-terminal-pane";
import type { ShellRoomLayoutMode } from "../app-room/room-app";
import { createDefaultShellTerminalSourcePolicy } from "./default-shell-source";
import { ShellFocusEventDispatcher } from "./focus-event-dispatcher";
import { createShellAppSurface, toggleShellAppSurface } from "./app-surface-actions";
import { createShellRenderer } from "./renderer-defaults";
import {
  defaultShellStatusbarState,
  readShellKeyEvent,
  shouldShellSkipKey,
} from "./shell-app-helpers";
import type {
  ShellAppController,
  ShellAppInput,
} from "./shell-app-types";

export type { ShellAppController, ShellAppInput } from "./shell-app-types";

const STATUSBAR_HEIGHT = 1;

interface FloatingOpenTuiPane {
  readonly source: OpenTuiRenderablePaneSource;
  node: ChildLayoutNode;
}

interface ShellLayoutModeAwareSurface {
  setLayoutMode(mode: ShellRoomLayoutMode): void;
}

const isShellLayoutModeAwareSurface = (
  surface: OpenTuiRenderableSurface,
): surface is OpenTuiRenderableSurface & ShellLayoutModeAwareSurface =>
  typeof (surface as Partial<ShellLayoutModeAwareSurface>).setLayoutMode === "function";

export class ShellApp implements ShellAppController {
  readonly #renderer: CliRenderer;
  readonly #ownsRenderer: boolean;
  readonly #cwd: string;
  readonly #command: readonly string[] | undefined;
  readonly #layout: RootLayout;
  readonly #mux: ShellMuxRenderable;
  readonly #statusbar: ShellStatusbarRenderable;
  readonly #topLayer: ShellTopLayerSurface;
  readonly #input: ShellAppInput;
  readonly #terminalSourcePolicy: NonNullable<ShellAppInput["terminalSourcePolicy"]>;
  readonly #room: ShellAppInput["room"];
  readonly #rootPane: NonNullable<ShellAppInput["rootPane"]>;
  readonly #initialSurfaces: readonly ("help" | "chat")[];
  readonly #showTopLayer: boolean;
  readonly #showStatusbar: boolean;
  readonly #syncStatusbarWithLayout: boolean;
  readonly #keyDispatcher = new ShellFocusEventDispatcher();
  #releaseStatusProvider: (() => void) | null = null;
  readonly #floatingPanes = new Map<string, FloatingOpenTuiPane>();
  #floatingFocusId: string | null = null;
  #resolveFinished: () => void = () => undefined;
  readonly finished: Promise<void>;
  #disposed = false;
  #paneCounter = 1;
  #statusBase: ShellStatusbarState;
  #status: ShellStatusbarState;
  #prefixPending = false;

  constructor(input: ShellAppInput & { renderer: CliRenderer; ownsRenderer?: boolean }) {
    this.#input = input;
    this.#renderer = input.renderer;
    this.#ownsRenderer = input.ownsRenderer === true;
    this.#cwd = input.cwd ?? process.cwd();
    this.#command = input.command;
    this.#terminalSourcePolicy = input.terminalSourcePolicy ?? createDefaultShellTerminalSourcePolicy();
    this.#room = input.room;
    this.#rootPane = input.rootPane ?? { id: "pane-1", sourceId: "source-1", sourceKind: "terminal-protocol" };
    this.#initialSurfaces = input.initialSurfaces ?? [];
    this.#showTopLayer = input.showTopLayer === true;
    this.#showStatusbar = input.showStatusbar !== false;
    this.#syncStatusbarWithLayout = input.syncStatusbarWithLayout !== false;
    this.#statusBase = input.statusProvider?.getStatus() ?? input.initialStatus ?? defaultShellStatusbarState;
    this.#layout = createRootLayout(this.#contentRect(), [this.#rootPane]);
    this.#status = this.#composeStatusbarState(this.#statusBase);
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
    this.#mux = new ShellMuxRenderable({
      renderer: this.#renderer,
      layout: this.#layout,
      sources: [initialSource],
      titleForPane: (node, source) =>
        node.sourceKind === "terminal-protocol"
          ? source.kind === "terminal-protocol"
            ? (source.readTitle?.() ?? node.id)
            : node.id
          : node.id,
      terminalPaneFactory: input.terminalPaneFactory ?? createShellFrameBufferTerminalPane,
      terminalResizeDebounceMs: input.terminalResizeDebounceMs,
      onFocus: () => {
        this.#floatingFocusId = null;
        this.#syncFloatingSurfaces();
        this.#syncStatusbar();
      },
      onCloseRequest: (paneId) => {
        if (this.#mux.focusPane(paneId)) {
          this.#openCloseConfirm();
        }
      },
      sendTerminalInputText: (paneId, text) => {
        const source = this.#mux.getTerminalSource(paneId);
        return source ? (source.pasteText?.(text) ?? false) : false;
      },
    });
    this.#statusbar = new ShellStatusbarRenderable({
      renderer: this.#renderer,
      state: this.#status,
      x: 0,
      y: Math.max(0, this.#renderer.height - STATUSBAR_HEIGHT),
      width: Math.max(1, this.#renderer.width),
      onAction: (action) => {
        this.#toggleAppSurface(action);
        this.#syncStatusbar();
      },
    });
    this.#topLayer = new ShellTopLayerSurface({
      renderer: this.#renderer,
      store: input.approvalStore ?? createEmptyShellApprovalStore(),
      shellName: "shell",
    });
    this.finished = new Promise<void>((resolve) => {
      this.#resolveFinished = resolve;
    });
    this.#keyDispatcher.register({
      id: "root",
      scope: "global",
      active: () => true,
      focused: () => false,
      onKeyCapture: (key) => this.#handleRootKeyCapture(key),
      onKey: (key) => this.#handleGlobalKeypress(key),
      onKeyBubble: (key) => this.#handleGlobalKeypress(key),
    });
    this.#keyDispatcher.register({
      id: "top-layer",
      parentId: "root",
      scope: "top-layer",
      active: () => this.#topLayer.visible,
      focused: () => this.#topLayer.visible,
      onKey: (key) => this.#topLayer.handleKeypress(key),
    });
    this.#keyDispatcher.register({
      id: "pane-container",
      parentId: "root",
      scope: "pane",
      active: () => this.#topLayer.visible !== true && this.#prefixPending !== true,
      focused: () => false,
    });
    this.#keyDispatcher.register({
      id: "focused-pane",
      parentId: "pane-container",
      scope: "pane",
      active: () => this.#topLayer.visible !== true && this.#prefixPending !== true,
      focused: () => this.#hasFocusedOpenTuiSurface(),
      onKey: (key) => this.#dispatchFocusedOpenTuiKey(key),
    });
    this.#keyDispatcher.register({
      id: "terminal-input",
      parentId: "pane-container",
      scope: "pane",
      active: () => this.#topLayer.visible !== true && this.#prefixPending !== true,
      focused: () => this.#floatingFocusId === null && this.#mux.focusedNode?.sourceKind === "terminal-protocol",
      onKey: (key) => this.#handleTerminalKeypress(key),
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
    this.#renderer.on(CliRenderEvents.SELECTION, this.#handleRendererSelection);
    this.#releaseStatusProvider = this.#input.statusProvider?.subscribe?.(() => this.#handleStatusProviderUpdate()) ?? null;
    for (const surface of this.#initialSurfaces) {
      this.#toggleAppSurface(surface);
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
    this.#renderer.off(CliRenderEvents.SELECTION, this.#handleRendererSelection);
    this.#releaseStatusProvider?.();
    this.#releaseStatusProvider = null;
    for (const floating of this.#floatingPanes.values()) {
      this.#renderer.root.remove(floating.source.surface.root.id);
      void floating.source.dispose();
    }
    this.#floatingPanes.clear();
    this.#floatingFocusId = null;
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

  #toggleAppSurface(kind: "help" | "chat"): boolean {
    if (kind === "chat" && this.#floatingPanes.has(kind)) {
      return this.#closeAppSurface(kind);
    }
    return toggleShellAppSurface({
      kind,
      renderer: this.#renderer,
      layout: this.#layout,
      mux: this.#mux,
      room: this.#room,
      onClose: (paneId) => {
        this.#closeAppSurface(paneId);
      },
      onLayoutRequest: async (mode) => this.#handleAppSurfaceLayoutRequest(kind, mode),
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
    if (this.#input.statusProvider) {
      this.#statusBase = this.#input.statusProvider.getStatus();
    }
    this.#status = this.#composeStatusbarState(this.#statusBase);
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
    this.#syncFloatingSurfaces();
    this.#renderer.requestRender();
  }

  #handleStatusProviderUpdate(): void {
    this.#syncStatusbar();
    this.#mux.syncLayout();
  }

  #handlePaneExit(event: LocalBunTerminalExitEvent): void {
    if (this.#disposed) {
      return;
    }
    this.#statusBase = {
      ...this.#statusBase,
      runtime: { label: event.processExitCode === 0 ? "Idle" : "Stopped" },
    };
    this.#syncStatusbar();
  }

  #setRuntimeNotice(label: string): void {
    this.#statusBase = {
      ...this.#statusBase,
      runtime: { label },
    };
    this.#syncStatusbar();
  }

  #handleResize = (): void => {
    this.#layout.resize(this.#contentRect());
    this.#mux.syncLayout();
    this.#syncFloatingSurfaces();
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
          await (source?.terminate?.() ?? source?.dispose());
          this.#mux.closePane(current.id);
        }
        this.destroy();
      },
    });
  }

  #dispatchKeypress = (value: unknown): void => {
    const key = readShellKeyEvent(value);
    if (!key) {
      return;
    }
    this.#keyDispatcher.dispatch(key);
  };

  #handleGlobalKeypress(key: ReturnType<typeof readShellKeyEvent> & {}): boolean {
    if (shouldShellSkipKey(key)) {
      return false;
    }
    if (this.#handleHostCopyKey(key)) {
      return true;
    }
    if (this.#prefixPending) {
      this.#prefixPending = false;
      if (key.name === "h" || key.name === "?" || key.sequence === "?") {
        key.preventDefault();
        this.#toggleAppSurface("help");
        this.#syncStatusbar();
        return true;
      }
      if (key.name === "c") {
        key.preventDefault();
        this.#toggleAppSurface("chat");
        this.#syncStatusbar();
        return true;
      }
      if (key.name === "q") {
        key.preventDefault();
        this.#openCloseConfirm();
        return true;
      }
      if (key.name === "n") {
        key.preventDefault();
        this.splitFocusedShellRight();
        this.#syncStatusbar();
        return true;
      }
      if (key.name === "w") {
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
      const prefixedDirection = key.name === "left" || key.name === "right" || key.name === "up" || key.name === "down" ? key.name : null;
      if (prefixedDirection) {
        key.preventDefault();
        this.#mux.focusAdjacent(prefixedDirection);
        this.#syncStatusbar();
        return true;
      }
      return false;
    }
    return false;
  }

  #handleRootKeyCapture(key: ReturnType<typeof readShellKeyEvent> & {}): boolean {
    if (shouldShellSkipKey(key)) {
      return false;
    }
    if (this.#handleHostCopyKey(key)) {
      return true;
    }
    if (this.#topLayer.visible) {
      return false;
    }
    if (key.ctrl && key.name === "b") {
      key.preventDefault();
      this.#prefixPending = true;
      return true;
    }
    return false;
  }

  #handleHostCopyKey(key: ReturnType<typeof readShellKeyEvent> & {}): boolean {
    if (!isShellCopyKey(key)) {
      return false;
    }
    if (this.#floatingFocusId === null && this.#mux.focusedNode?.sourceKind === "terminal-protocol") {
      const copied = this.#mux.getTerminalSource(this.#mux.focusedNode.id)?.copySelection?.("terminal") ?? false;
      if (typeof copied === "string" && copied.length > 0) {
        this.#renderer.copyToClipboardOSC52(copied, SHELL_CLIPBOARD_TARGETS.clipboard);
      }
      key.preventDefault();
      return true;
    }
    if (
      copyRendererSelection(this.#renderer, [
        SHELL_CLIPBOARD_TARGETS.clipboard,
        SHELL_CLIPBOARD_TARGETS.primary,
      ])
    ) {
      key.preventDefault();
      return true;
    }
    return false;
  }

  #handleRendererSelection = (selection: Selection): void => {
    if (this.#floatingFocusId === null && this.#mux.focusedNode?.sourceKind === "terminal-protocol") {
      return;
    }
    copyFinishedRendererSelectionToPrimary(this.#renderer, selection);
  };

  #handleTerminalKeypress(key: ReturnType<typeof readShellKeyEvent> & {}): boolean {
    if (shouldShellSkipKey(key)) {
      return false;
    }
    if (this.#floatingFocusId !== null) {
      return false;
    }
    if (this.#mux.focusedNode?.sourceKind !== "terminal-protocol") {
      return false;
    }
    const source = this.#mux.getTerminalSource(this.#mux.focusedNode.id);
    if (!source) {
      return false;
    }
    if (!source.handleKey?.(key)) {
      return false;
    }
    key.preventDefault();
    return true;
  }

  #dispatchFocusedOpenTuiKey(key: ReturnType<typeof readShellKeyEvent> & {}): boolean {
    const floating = this.#floatingFocusId ? this.#floatingPanes.get(this.#floatingFocusId) : null;
    if (floating) {
      return floating.source.surface.handleKeypress?.(key) === true;
    }
    return this.#mux.dispatchFocusedPaneKey(key);
  }

  #hasFocusedOpenTuiSurface(): boolean {
    return (
      (this.#floatingFocusId !== null && this.#floatingPanes.has(this.#floatingFocusId)) ||
      this.#mux.focusedNode?.sourceKind === "opentui-renderable"
    );
  }

  #closeAppSurface(paneId: string): boolean {
    const floating = this.#floatingPanes.get(paneId);
    if (floating) {
      this.#renderer.root.remove(floating.source.surface.root.id);
      this.#floatingPanes.delete(paneId);
      if (this.#floatingFocusId === paneId) {
        this.#floatingFocusId = null;
      }
      void floating.source.dispose();
      this.#syncStatusbar();
      return true;
    }
    return this.closePane(paneId);
  }

  #handleAppSurfaceLayoutRequest(
    paneId: string,
    mode: ShellRoomLayoutMode,
  ): { closeCurrentSurface: boolean } {
    if (mode === "float") {
      const existingFloating = this.#floatingPanes.get(paneId);
      if (existingFloating) {
        this.#focusFloatingPane(paneId);
        return { closeCurrentSurface: false };
      }
      const source = this.#mux.detachOpenTuiPane(paneId);
      if (source) {
        this.#setSourceLayoutMode(source, "float");
        this.#mountFloatingPane(paneId, source);
      }
      return { closeCurrentSurface: false };
    }
    const anchor = this.#resolveAppLayoutAnchor(paneId);
    if (!anchor) {
      this.#setRuntimeNotice("No anchor pane is available for Chat layout");
      return { closeCurrentSurface: false };
    }
    const floating = this.#floatingPanes.get(paneId);
    if (floating) {
      this.#renderer.root.remove(floating.source.surface.root.id);
      this.#floatingPanes.delete(paneId);
      this.#floatingFocusId = null;
      this.#setSourceLayoutMode(floating.source, mode);
      this.#mux.registerSource(floating.source);
      if (this.#layout.split(anchor.id, mode, { id: paneId, sourceId: paneId, sourceKind: "opentui-renderable" })) {
        this.#mux.syncLayout();
        this.#syncStatusbar();
      } else {
        this.#mountFloatingPane(paneId, floating.source);
      }
      return { closeCurrentSurface: false };
    }
    if (this.#layout.children.some((node) => node.id === paneId)) {
      this.#setDockedPaneLayoutMode(paneId, mode);
      this.#mux.movePane(paneId, anchor.id, mode);
      this.#syncStatusbar();
    }
    return { closeCurrentSurface: false };
  }

  #resolveAppLayoutAnchor(paneId: string): ChildLayoutNode | null {
    return (
      this.#layout.children.find((node) => node.id === this.#rootPane.id && node.id !== paneId) ??
      this.#layout.children.find((node) => node.sourceKind === "terminal-protocol" && node.id !== paneId) ??
      this.#layout.children.find((node) => node.id !== paneId) ??
      null
    );
  }

  #mountFloatingPane(paneId: string, source: OpenTuiRenderablePaneSource): void {
    this.#renderer.root.add(source.surface.root);
    this.#setSourceLayoutMode(source, "float");
    this.#floatingPanes.set(paneId, { source, node: this.#createFloatingNode(paneId) });
    this.#focusFloatingPane(paneId);
    this.#syncFloatingSurfaces();
    this.#syncStatusbar();
  }

  #focusFloatingPane(paneId: string): void {
    if (!this.#floatingPanes.has(paneId)) {
      return;
    }
    this.#floatingFocusId = paneId;
    this.#syncFloatingSurfaces();
  }

  #syncFloatingSurfaces(): void {
    for (const [paneId, floating] of this.#floatingPanes) {
      floating.node = this.#createFloatingNode(paneId);
      floating.source.surface.syncNode(floating.node);
      if (floating.node.focused) {
        floating.source.surface.focus?.();
      }
    }
  }

  #createFloatingNode(paneId: string): ChildLayoutNode {
    const rect = this.#contentRect();
    const maxWidth = Math.max(1, rect.width - 2);
    const maxHeight = Math.max(1, rect.height - 2);
    const width = Math.max(1, Math.min(maxWidth, Math.max(24, Math.floor(rect.width * 0.68))));
    const height = Math.max(1, Math.min(maxHeight, Math.max(8, Math.floor(rect.height * 0.78))));
    return {
      id: paneId,
      sourceId: paneId,
      sourceKind: "opentui-renderable",
      rect: {
        x: rect.x + Math.max(0, Math.floor((rect.width - width) / 2)),
        y: rect.y + Math.max(0, Math.floor((rect.height - height) / 2)),
        width,
        height,
      },
      focused: this.#floatingFocusId === paneId,
    };
  }

  #createRootSurface(node: ChildLayoutNode): OpenTuiRenderableSurface {
    const sourceId = this.#rootPane.sourceId ?? this.#rootPane.id;
    if (sourceId === "view-status") {
      return new ShellStatusSurface({
        renderer: this.#renderer,
        node,
        getState: () => this.#status,
      });
    }
    if (sourceId === "view-help") {
      return createShellAppSurface({
        kind: "help",
        renderer: this.#renderer,
        node,
      });
    }
    if (sourceId === "view-room") {
      return createShellAppSurface({
        kind: "chat",
        renderer: this.#renderer,
        node,
        room: this.#room,
        layoutMode: "right",
        onLayoutRequest: async (mode) => this.#handleAppSurfaceLayoutRequest("chat", mode),
        onTopLayerRequest: () => {
          this.#topLayer.show();
        },
      });
    }
    throw new Error(`unsupported shell root renderable source: ${sourceId}`);
  }

  #composeStatusbarState(base: ShellStatusbarState): ShellStatusbarState {
    const next: ShellStatusbarState = {
      ...base,
      activeActions: this.#deriveActiveStatusbarActions(),
    };
    return this.#syncStatusbarWithLayout ? { ...next, attention: this.#deriveLayoutAttentionSummary() } : next;
  }

  #deriveActiveStatusbarActions(): readonly ("help" | "chat")[] {
    return [
      this.#layout.children.some((node) => node.id === "help") || this.#floatingPanes.has("help") ? "help" : null,
      this.#layout.children.some((node) => node.id === "chat") || this.#floatingPanes.has("chat") ? "chat" : null,
    ].filter((action): action is "help" | "chat" => action !== null);
  }

  #deriveLayoutAttentionSummary(): NonNullable<ShellStatusbarState["attention"]> {
    const terminalCount = this.#layout.children.filter((node) => node.sourceKind === "terminal-protocol").length;
    return {
      focused: this.#layout.children.some((node) => node.focused) ? 1 : 0,
      background: Math.max(0, terminalCount - 1),
      muted: this.#layout.children.filter((node) => node.sourceKind === "opentui-renderable").length,
    };
  }

  #setDockedPaneLayoutMode(paneId: string, mode: ShellRoomLayoutMode): void {
    const surface = this.#mux.getOpenTuiSurface(paneId);
    if (surface && isShellLayoutModeAwareSurface(surface)) {
      surface.setLayoutMode(mode);
    }
  }

  #setSourceLayoutMode(source: OpenTuiRenderablePaneSource, mode: ShellRoomLayoutMode): void {
    if (isShellLayoutModeAwareSurface(source.surface)) {
      source.surface.setLayoutMode(mode);
    }
  }
}

export const startShellApp = async (input: ShellAppInput = {}): Promise<ShellAppController> => {
  const renderer = input.renderer ?? (await createShellRenderer());
  const app = new ShellApp({
    ...input,
    renderer,
    ownsRenderer: input.renderer === undefined,
  });
  app.start();
  return app;
};
