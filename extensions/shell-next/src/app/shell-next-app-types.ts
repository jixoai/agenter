import type { CliRenderer } from "@opentui/core";

import type { ChildLayoutNode } from "../renderable-mux/layout";
import type { TerminalPaneFactory } from "../renderable-mux/mux-renderable";
import type { PaneSource } from "../renderable-mux/pane-source";
import type { ShellNextStatusbarState } from "../renderable-mux/statusbar";
import type { ShellNextRoomBootstrapResult } from "../product/bootstrap";
import type { ShellNextRoomAppStore } from "../product-room/room-app";
import type { ShellNextKeybindings, ShellNextSettings } from "../product-room/settings";
import type { LocalBunTerminalExitEvent } from "../sources/bun-terminal-protocol-source";
import type { ShellNextRoomSurfaceStore } from "../surfaces/room-surface";
import type { ShellNextApprovalStore } from "../surfaces/top-layer-surface";

export interface ShellNextFallbackRoomInput {
  readonly store: ShellNextRoomSurfaceStore;
  readonly chatId: string;
  readonly accessToken?: string;
  readonly title?: string | null;
  readonly attached?: undefined;
}

export interface ShellNextAttachedRoomInput {
  readonly store: ShellNextRoomAppStore;
  readonly attached: ShellNextRoomBootstrapResult;
  readonly shellName?: string;
  readonly settings?: ShellNextSettings;
  readonly keybindings?: ShellNextKeybindings;
}

export type ShellNextRoomInput = ShellNextFallbackRoomInput | ShellNextAttachedRoomInput;

export interface ShellNextRootPaneDefinition {
  readonly id: string;
  readonly sourceId?: string;
  readonly sourceKind: "terminal-protocol" | "opentui-renderable";
}

export interface ShellNextTerminalSourceRequest {
  readonly id: string;
  readonly cwd: string;
  readonly command?: readonly string[];
  readonly node: ChildLayoutNode;
  readonly onExit: (event: LocalBunTerminalExitEvent) => void;
}

export interface ShellNextTerminalSourcePolicy {
  createInitialSource(input: ShellNextTerminalSourceRequest): PaneSource;
  createSplitSource?(input: ShellNextTerminalSourceRequest): PaneSource | null;
  describeSplitUnavailable?(): string;
}

export interface ShellNextAppInput {
  readonly renderer?: CliRenderer;
  readonly cwd?: string;
  readonly command?: readonly string[];
  readonly initialStatus?: ShellNextStatusbarState;
  readonly approvalStore?: ShellNextApprovalStore;
  readonly room?: ShellNextRoomInput;
  readonly rootPane?: ShellNextRootPaneDefinition;
  readonly initialSurfaces?: readonly ("help" | "chat")[];
  readonly showTopLayer?: boolean;
  readonly showStatusbar?: boolean;
  readonly syncStatusbarWithLayout?: boolean;
  readonly terminalPaneFactory?: TerminalPaneFactory;
  readonly terminalSourcePolicy?: ShellNextTerminalSourcePolicy;
  readonly onTerminalSplitUnavailable?: (reason: string) => void;
}

export interface ShellNextAppController {
  readonly finished: Promise<void>;
  destroy(): void;
}
