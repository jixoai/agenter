import type { CliRenderer, Renderable } from "@opentui/core";

import type { ChildLayoutNode, FocusDirection, LayoutPaneInput, RootLayout, SplitDirection } from "./layout";
import { PaneRenderable, type PaneFrameRenderEvent } from "./pane-renderable";
import {
  getPaneSourceLayoutKind,
  normalizeTerminalPaneSource,
  type OpenTuiRenderablePaneSource,
  type PaneSource,
  type TerminalInputChunk,
  type TerminalLikePaneSource,
  type TerminalProtocolPaneSource,
} from "./pane-source";

export interface TerminalPaneRenderable {
  readonly root: Renderable;
  syncNode(node: ChildLayoutNode): void;
  refresh(): void;
  writeInput(chunk: TerminalInputChunk): void | Promise<void>;
  destroy(): void;
}

export interface TerminalPaneFactoryInput {
  readonly renderer: CliRenderer;
  readonly node: ChildLayoutNode;
  readonly source: TerminalProtocolPaneSource;
  readonly title: string;
  readonly onFocus: (paneId: string) => void;
  readonly onCloseRequest?: (paneId: string) => void;
  readonly onFrameRendered?: (event: PaneFrameRenderEvent) => void;
}

export type TerminalPaneFactory = (input: TerminalPaneFactoryInput) => TerminalPaneRenderable;

interface MountedTerminalPane {
  readonly source: TerminalLikePaneSource;
  readonly pane: TerminalPaneRenderable;
  readonly unsubscribe: (() => void) | null;
}

interface MountedOpenTuiPane {
  readonly source: OpenTuiRenderablePaneSource;
  readonly unsubscribe: null;
}

type MountedPane = MountedTerminalPane | MountedOpenTuiPane;

export interface ShellNextMuxRenderableInput {
  renderer: CliRenderer;
  layout: RootLayout;
  sources: readonly PaneSource[];
  titleForPane?: (node: ChildLayoutNode, source: PaneSource) => string;
  terminalPaneFactory?: TerminalPaneFactory;
  onFocus?: (paneId: string) => void;
  onCloseRequest?: (paneId: string) => void;
  onFrameRendered?: (event: PaneFrameRenderEvent) => void;
}

const isTerminalSource = (source: PaneSource): source is TerminalLikePaneSource => source.kind !== "opentui-renderable";

const sourceKeyForNode = (node: LayoutPaneInput): string => node.sourceId ?? node.id;

const defaultTerminalPaneFactory: TerminalPaneFactory = (input) => new PaneRenderable(input);

export class ShellNextMuxRenderable {
  readonly #renderer: CliRenderer;
  readonly #layout: RootLayout;
  readonly #sources = new Map<string, PaneSource>();
  readonly #mounted = new Map<string, MountedPane>();
  readonly #input: Omit<ShellNextMuxRenderableInput, "renderer" | "layout" | "sources">;
  readonly #terminalPaneFactory: TerminalPaneFactory;

  constructor(input: ShellNextMuxRenderableInput) {
    this.#renderer = input.renderer;
    this.#layout = input.layout;
    this.#input = input;
    this.#terminalPaneFactory = input.terminalPaneFactory ?? defaultTerminalPaneFactory;
    for (const source of input.sources) {
      this.registerSource(source);
    }
  }

  get layout(): RootLayout {
    return this.#layout;
  }

  get focusedNode(): ChildLayoutNode | null {
    return this.#layout.children.find((node) => node.focused) ?? null;
  }

  registerSource(source: PaneSource): void {
    this.#sources.set(source.id.value, source);
  }

  mount(): void {
    this.syncLayout();
  }

  syncLayout(): void {
    const livePaneIds = new Set(this.#layout.children.map((node) => node.id));
    for (const [paneId, mounted] of this.#mounted) {
      if (livePaneIds.has(paneId)) {
        continue;
      }
      mounted.unsubscribe?.();
      if ("pane" in mounted) {
        mounted.pane.destroy();
      } else {
        void mounted.source.dispose();
      }
      this.#mounted.delete(paneId);
    }

    for (const node of this.#layout.children) {
      const source = this.#resolveSource(node);
      const mounted = this.#mounted.get(node.id);
      if (mounted) {
        this.#syncMounted(node, mounted);
        continue;
      }
      this.#mountNode(node, source);
    }
    this.#renderer.requestRender();
  }

  focusPane(paneId: string): boolean {
    const focused = this.#layout.focus(paneId);
    if (!focused) {
      return false;
    }
    this.#input.onFocus?.(paneId);
    this.syncLayout();
    return true;
  }

  focusAdjacent(direction: FocusDirection): boolean {
    const moved = this.#layout.focusAdjacent(direction);
    if (!moved) {
      return false;
    }
    const focused = this.focusedNode;
    if (focused) {
      this.#input.onFocus?.(focused.id);
    }
    this.syncLayout();
    return true;
  }

  splitFocused(direction: SplitDirection, pane: LayoutPaneInput, source: PaneSource): boolean {
    const focused = this.focusedNode;
    if (!focused) {
      return false;
    }
    this.registerSource(source);
    const split = this.#layout.split(focused.id, direction, {
      ...pane,
      sourceId: pane.sourceId ?? source.id.value,
      sourceKind: getPaneSourceLayoutKind(source),
    });
    if (!split) {
      this.#sources.delete(source.id.value);
      void source.dispose();
      return false;
    }
    this.syncLayout();
    return true;
  }

  closeFocused(): boolean {
    const focused = this.focusedNode;
    if (!focused) {
      return false;
    }
    const closed = this.#layout.close(focused.id);
    if (!closed) {
      return false;
    }
    this.syncLayout();
    return true;
  }

  closePane(paneId: string): boolean {
    const closed = this.#layout.close(paneId);
    if (!closed) {
      return false;
    }
    this.syncLayout();
    return true;
  }

  getTerminalSource(paneId: string): TerminalProtocolPaneSource | null {
    const mounted = this.#mounted.get(paneId);
    if (!mounted || !("pane" in mounted)) {
      return null;
    }
    return normalizeTerminalPaneSource(mounted.source);
  }

  dispatchFocusedPaneKey(key: Parameters<NonNullable<OpenTuiRenderablePaneSource["surface"]["handleKeypress"]>>[0]): boolean {
    const focused = this.focusedNode;
    if (!focused) {
      return false;
    }
    const mounted = this.#mounted.get(focused.id);
    if (!mounted || "pane" in mounted) {
      return false;
    }
    return mounted.source.surface.handleKeypress?.(key) === true;
  }

  writeFocusedInput(chunk: TerminalInputChunk): void | Promise<void> {
    const focused = this.focusedNode;
    if (!focused) {
      return undefined;
    }
    const mounted = this.#mounted.get(focused.id);
    if (!mounted || !("pane" in mounted)) {
      return undefined;
    }
    return mounted.pane.writeInput(chunk);
  }

  refreshPane(paneId: string): void {
    const mounted = this.#mounted.get(paneId);
    if (!mounted || !("pane" in mounted)) {
      return;
    }
    mounted.pane.refresh();
    this.#renderer.requestRender();
  }

  destroy(): void {
    for (const mounted of this.#mounted.values()) {
      mounted.unsubscribe?.();
      if ("pane" in mounted) {
        mounted.pane.destroy();
      } else {
        void mounted.source.dispose();
      }
    }
    this.#mounted.clear();
  }

  #resolveSource(node: ChildLayoutNode): PaneSource {
    const sourceId = sourceKeyForNode(node);
    const source = this.#sources.get(sourceId);
    if (!source) {
      throw new Error(`missing shell-next pane source: ${sourceId}`);
    }
    return source;
  }

  #mountNode(node: ChildLayoutNode, source: PaneSource): void {
    if (isTerminalSource(source)) {
      const protocol = normalizeTerminalPaneSource(source);
      const pane = this.#terminalPaneFactory({
        renderer: this.#renderer,
        node,
        source: protocol,
        title: this.#input.titleForPane?.(node, source) ?? node.id,
        onFocus: (paneId) => this.focusPane(paneId),
        onCloseRequest: this.#input.onCloseRequest,
        onFrameRendered: this.#input.onFrameRendered,
      });
      this.#renderer.root.add(pane.root);
      const unsubscribe = protocol.subscribe?.(() => this.refreshPane(node.id)) ?? null;
      this.#mounted.set(node.id, { source, pane, unsubscribe });
      return;
    }
    this.#renderer.root.add(source.surface.root);
    source.surface.syncNode(node);
    if (node.focused) {
      source.surface.focus?.();
    }
    this.#mounted.set(node.id, { source, unsubscribe: null });
  }

  #syncMounted(node: ChildLayoutNode, mounted: MountedPane): void {
    if ("pane" in mounted) {
      mounted.pane.syncNode(node);
      return;
    }
    mounted.source.surface.syncNode(node);
    if (node.focused) {
      mounted.source.surface.focus?.();
    }
  }
}
