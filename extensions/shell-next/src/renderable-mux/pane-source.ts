import type {
  TerminalTransportOwnerCoordinate,
  TerminalTransportSelectionRange,
  TerminalTransportSelectionOverlay,
} from "@agenter/terminal-transport-protocol";
import type { TerminalRenderRichLine } from "@agenter/termless-core";
import type { KeyEvent, Renderable } from "@opentui/core";

import type { ChildLayoutNode, LayoutSourceKind } from "./layout-types";

export interface PaneSourceId {
  readonly value: string;
}

export interface TerminalPaneSize {
  readonly cols: number;
  readonly rows: number;
}

export interface TerminalFrameSnapshot {
  readonly size: TerminalPaneSize;
  readonly lines: readonly string[];
  readonly richLines?: readonly TerminalRenderRichLine[];
  readonly cursor?: {
    readonly x: number;
    readonly y: number;
    readonly visible: boolean;
  };
  readonly viewportStart?: number;
  readonly scrollbackRows?: number;
  readonly selectionOverlays?: readonly TerminalTransportSelectionOverlay[];
  readonly revision: number;
}

export type TerminalInputChunk = string | Uint8Array;

export interface TerminalSelectionTextEvent {
  readonly ownerId?: string;
  readonly text: string;
  readonly target?: TerminalCopyTarget;
}

export type TerminalCopyTarget = "clipboard" | "primary";

export interface TerminalProtocolPaneSource {
  readonly kind: "terminal-protocol";
  readonly id: PaneSourceId;
  readFrame(): TerminalFrameSnapshot;
  readTitle?(): string | null;
  writeInput(chunk: TerminalInputChunk): void | Promise<void>;
  resize(size: TerminalPaneSize): void | Promise<void>;
  scrollViewport?(deltaRows: number): boolean;
  setViewportStart?(viewportStart: number): boolean;
  followCursor?(): boolean;
  selectionStart?(point: TerminalTransportOwnerCoordinate): boolean;
  selectionUpdate?(point: TerminalTransportOwnerCoordinate): boolean;
  selectionEnd?(point: TerminalTransportOwnerCoordinate): boolean;
  selectWordAt?(point: TerminalTransportOwnerCoordinate): boolean;
  selectLineAt?(point: TerminalTransportOwnerCoordinate): boolean;
  selectRange?(range: TerminalTransportSelectionRange): boolean;
  clearSelection?(ownerId?: string): boolean;
  copySelection?(ownerId?: string, target?: TerminalCopyTarget): boolean | string;
  subscribeSelectionText?(listener: (event: TerminalSelectionTextEvent) => void): () => void;
  notifyPaintCommitted?(): void;
  subscribe?(listener: () => void): () => void;
  dispose(): void | Promise<void>;
}

export interface BunPtyLaunchOptions {
  readonly command: string;
  readonly args?: readonly string[];
  readonly cwd?: string;
  readonly env?: Readonly<Record<string, string>>;
}

export interface BunPtyPaneSource {
  readonly kind: "bun-pty";
  readonly id: PaneSourceId;
  readonly launch: BunPtyLaunchOptions;
  readonly protocol: TerminalProtocolPaneSource;
  dispose(): void | Promise<void>;
}

export interface CommandTaskLaunchOptions {
  readonly command: string;
  readonly args?: readonly string[];
  readonly cwd?: string;
  readonly env?: Readonly<Record<string, string>>;
  readonly label?: string;
}

export interface CommandTaskPaneSource {
  readonly kind: "command-task";
  readonly id: PaneSourceId;
  readonly task: CommandTaskLaunchOptions;
  readonly bunPty: BunPtyPaneSource;
  dispose(): void | Promise<void>;
}

export interface OpenTuiRenderableSurface {
  readonly root: Renderable;
  syncNode(node: ChildLayoutNode): void;
  focus?(): void;
  handleKeypress?(key: KeyEvent): boolean | void;
  dispose?(): void | Promise<void>;
}

export interface OpenTuiRenderablePaneSource {
  readonly kind: "opentui-renderable";
  readonly id: PaneSourceId;
  readonly surface: OpenTuiRenderableSurface;
  dispose(): void | Promise<void>;
}

export type TerminalLikePaneSource = TerminalProtocolPaneSource | BunPtyPaneSource | CommandTaskPaneSource;

export type PaneSource = TerminalLikePaneSource | OpenTuiRenderablePaneSource;

export const createPaneSourceId = (value: string): PaneSourceId => ({ value });

export const getPaneSourceLayoutKind = (source: PaneSource): LayoutSourceKind =>
  source.kind === "opentui-renderable" ? "opentui-renderable" : "terminal-protocol";

export const normalizeTerminalPaneSource = (source: TerminalLikePaneSource): TerminalProtocolPaneSource => {
  switch (source.kind) {
    case "terminal-protocol":
      return source;
    case "bun-pty":
      return source.protocol;
    case "command-task":
      return source.bunPty.protocol;
  }
};

export const createBunPtyPaneSource = (input: {
  id: PaneSourceId;
  launch: BunPtyLaunchOptions;
  protocol: TerminalProtocolPaneSource;
}): BunPtyPaneSource => ({
  kind: "bun-pty",
  id: input.id,
  launch: input.launch,
  protocol: input.protocol,
  dispose: () => input.protocol.dispose(),
});

export const createCommandTaskPaneSource = (input: {
  id: PaneSourceId;
  task: CommandTaskLaunchOptions;
  protocol: TerminalProtocolPaneSource;
}): CommandTaskPaneSource => ({
  kind: "command-task",
  id: input.id,
  task: input.task,
  bunPty: createBunPtyPaneSource({
    id: input.id,
    launch: {
      command: input.task.command,
      args: input.task.args,
      cwd: input.task.cwd,
      env: input.task.env,
    },
    protocol: input.protocol,
  }),
  dispose: () => input.protocol.dispose(),
});

export const createOpenTuiRenderablePaneSource = (input: {
  id: PaneSourceId;
  surface: OpenTuiRenderableSurface;
}): OpenTuiRenderablePaneSource => ({
  kind: "opentui-renderable",
  id: input.id,
  surface: input.surface,
  dispose: () => input.surface.dispose?.(),
});
