import type { CliRenderer } from "@opentui/core";

import type { ChildLayoutNode } from "../renderable-mux/layout";
import type { TerminalPaneFactory } from "../renderable-mux/mux-renderable";
import type { PaneSource } from "../renderable-mux/pane-source";
import type { ShellStatusbarState } from "../renderable-mux/statusbar";
import type { ShellRoomBootstrapResult } from "../app-runtime/bootstrap";
import type { ShellRoomAppStore } from "../app-room/room-app";
import type { ShellKeybindings, ShellSettings } from "../app-room/settings";
import type { LocalBunTerminalExitEvent } from "../sources/bun-terminal-protocol-source";
import type { ShellRoomSurfaceStore } from "../surfaces/room-surface";
import type { ShellApprovalStore } from "../surfaces/top-layer-surface";

export interface ShellFallbackRoomInput {
  readonly store: ShellRoomSurfaceStore;
  readonly chatId: string;
  readonly accessToken?: string;
  readonly title?: string | null;
  readonly attached?: undefined;
}

export interface ShellAttachedRoomInput {
  readonly store: ShellRoomAppStore;
  readonly attached: ShellRoomBootstrapResult;
  readonly shellName?: string;
  readonly settings?: ShellSettings;
  readonly keybindings?: ShellKeybindings;
}

export type ShellRoomInput = ShellFallbackRoomInput | ShellAttachedRoomInput;

export interface ShellRootPaneDefinition {
  readonly id: string;
  readonly sourceId?: string;
  readonly sourceKind: "terminal-protocol" | "opentui-renderable";
}

export interface ShellTerminalSourceRequest {
  readonly id: string;
  readonly cwd: string;
  readonly command?: readonly string[];
  readonly node: ChildLayoutNode;
  readonly onExit: (event: LocalBunTerminalExitEvent) => void;
}

export interface ShellTerminalSourcePolicy {
  createInitialSource(input: ShellTerminalSourceRequest): PaneSource;
  createSplitSource?(input: ShellTerminalSourceRequest): PaneSource | null;
  describeSplitUnavailable?(): string;
}

export interface ShellStatusProvider {
  getStatus(): ShellStatusbarState;
  subscribe?(listener: () => void): () => void;
}

export interface ShellAppInput {
  readonly renderer?: CliRenderer;
  readonly cwd?: string;
  readonly command?: readonly string[];
  readonly initialStatus?: ShellStatusbarState;
  readonly statusProvider?: ShellStatusProvider;
  readonly approvalStore?: ShellApprovalStore;
  readonly room?: ShellRoomInput;
  readonly rootPane?: ShellRootPaneDefinition;
  readonly initialSurfaces?: readonly ("help" | "chat")[];
  readonly showTopLayer?: boolean;
  readonly showStatusbar?: boolean;
  readonly syncStatusbarWithLayout?: boolean;
  readonly terminalResizeDebounceMs?: number;
  readonly terminalPaneFactory?: TerminalPaneFactory;
  readonly terminalSourcePolicy?: ShellTerminalSourcePolicy;
  readonly onTerminalSplitUnavailable?: (reason: string) => void;
}

export interface ShellAppController {
  readonly finished: Promise<void>;
  destroy(): void;
}
