import type {
  GlobalRoomSnapshotOutput,
  ProductTerminalComposedSurfaceState,
  RuntimeStore,
} from "@agenter/client-sdk";
import type { TerminalRenderRichLine } from "@agenter/termless-core";
import type { TerminalTransportInteractionFrameState } from "@agenter/terminal-transport-protocol";
import type { CliShellInteractionEnhancementProfile } from "./interaction-capabilities";
import type { CliShellLiveTerminalView } from "./live-terminal-mirror";

import type { CliShellStore } from "../bootstrap";
import type { CliShellManagedState } from "../managed";
export type CliShellDialoguePlacement = "left" | "right" | "floating";
export type CliShellDialoguePlacementRequest = CliShellDialoguePlacement | "smart";

export interface CliShellDialogueBlock {
  kind: "message" | "date-divider";
  authoredByUser?: boolean;
  authorLabel?: string;
  timeLabel?: string;
  body?: string;
  dateLabel?: string;
}

export interface CliShellTuiModel {
  terminalId: string;
  terminalObservationReady: boolean;
  focusTarget: "terminal" | "dialogue";
  activeFocusTarget?: "terminal" | "dialogue";
  terminalView: {
    snapshotSeq: number;
    plainLines: string[];
    richLines: TerminalRenderRichLine[];
    cursorAbsRow: number;
    cursorCol: number;
    cursorVisible: boolean;
    rows: number;
    cols: number;
    viewportStart: number;
    viewportEnd: number;
    scrollbackRows: number;
    interaction?: TerminalTransportInteractionFrameState;
    connected: boolean;
    running: boolean;
  };
  toolbarLeft: string;
  toolbarHeartbeat: string;
  toolbarHeartbeatProjection: string;
  toolbarManaged: string;
  toolbarUnread: string;
  dialogueOpen: boolean;
  dialoguePlacement: CliShellDialoguePlacement | null;
  dialogueBlocks: CliShellDialogueBlock[];
  dialogueDraft: string;
  dialogueScrollOffset: number;
  dialogueTitle: string;
  interactionProfile?: CliShellInteractionEnhancementProfile;
}

export type CliShellPointerAction =
  | "toggleManaged"
  | "openDialogue"
  | "closeDialogue"
  | "focusDialogueInput"
  | "submitDialogue"
  | "placeLeft"
  | "placeRight"
  | "placeFloating";

export interface CliShellScrollRegion {
  row: number;
  col: number;
  width: number;
  height: number;
}

export interface CliShellSelectionRegion extends CliShellScrollRegion {
  owner: "terminal" | "dialogue";
}

export interface CliShellSelectionSource extends CliShellSelectionRegion {
  lines: readonly TerminalRenderRichLine[];
  /**
   * Absolute row in the owner's backend buffer that corresponds to `row`.
   * Selection state is anchored to backend content coordinates so highlights can
   * be re-projected after viewport scrolling instead of sticking to screen rows.
   */
  sourceStartRow?: number;
}

export interface CliShellTuiInteractionLayout {
  terminalScrollRegion: CliShellScrollRegion | null;
  terminalScrollbarRegion: CliShellScrollRegion | null;
  selectionRegions: CliShellSelectionRegion[];
}

export interface CliShellTuiViewState {
  dialogueOpen: boolean;
  focusTarget: "terminal" | "dialogue";
  activeFocusTarget?: "terminal" | "dialogue";
  requestedPlacement: CliShellDialoguePlacementRequest;
  dialogueDraft: string;
  dialogueScrollOffset?: number;
  managed: CliShellManagedState;
  statusNotice: string | null;
}

export interface CliShellTuiAppProjection {
  roomSnapshot: GlobalRoomSnapshotOutput | null;
  liveTerminal?: CliShellLiveTerminalView | null;
}

export interface CliShellObservationReadyBaseline {
  version: number;
  timestamp: number | null;
}

export type CliShellTuiStore = Pick<
  CliShellStore,
  | "readSettings"
  | "getAuthSession"
  | "grantGlobalTerminalWriteLease"
  | "revokeGlobalTerminalWriteLease"
  | "queryAttention"
  | "commitAttention"
  | "settleAttention"
  | "listProductDelegations"
  | "createProductDelegation"
  | "revokeProductDelegation"
> &
  Pick<
    RuntimeStore,
    | "getState"
    | "subscribe"
    | "connect"
    | "disconnect"
    | "hydrateSessionArtifacts"
    | "retainGlobalTerminals"
    | "hydrateGlobalTerminals"
    | "readGlobalTerminal"
    | "retainGlobalRoomSnapshot"
    | "hydrateGlobalRoomSnapshot"
    | "sendGlobalRoomMessage"
    | "inputGlobalTerminal"
    | "setGlobalTerminalConfig"
    | "publishGlobalTerminalComposedSurface"
  >;

export type CliShellComposedSurfaceState = ProductTerminalComposedSurfaceState;
