import type { GlobalRoomSnapshotOutput, GlobalTerminalApprovalRequest, RuntimeStore } from "@agenter/client-sdk";
import type { TerminalTransportInteractionFrameState } from "@agenter/terminal-transport-protocol";
import type { TerminalRenderRichLine } from "@agenter/termless-core";
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

export interface CliShellSelectionSourceDescriptor extends CliShellSelectionRegion {
  /**
   * Absolute row in the owner's backend buffer that corresponds to `row`.
   * Selection state is anchored to backend content coordinates so highlights can
   * be re-projected after viewport scrolling instead of sticking to screen rows.
   */
  sourceStartRow?: number;
}

export interface CliShellSelectionSource extends CliShellSelectionSourceDescriptor {
  lines: readonly TerminalRenderRichLine[];
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
  terminalSelectionAnchor?: {
    row: number;
    col: number;
  };
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
  "readSettings" | "getAuthSession" | "queryAttention" | "commitAttention" | "settleAttention"
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
    | "retainTerminalPermissionRequests"
    | "hydrateGlobalTerminalApprovals"
    | "approveGlobalTerminalRequest"
    | "denyGlobalTerminalRequest"
  >;

export type CliShellTerminalPermissionRequest = GlobalTerminalApprovalRequest;

export interface CliShellTerminalPermissionRequestDetail {
  terminalId: string;
  request: CliShellTerminalPermissionRequest;
}

export interface CliShellTerminalApprovalActionDetail {
  terminalId: string;
  requestId: string;
  action: "approve" | "deny";
  durationMs?: number;
}

export type CliShellTerminalRequestPermissionsHandler = (
  detail: CliShellTerminalPermissionRequestDetail,
) => boolean | void;

export interface CliShellComposedSurfaceState {
  shellTerminalId: string;
  terminalId: string;
  shellSnapshotSeq: number;
  cols: number;
  rows: number;
  dialogueOpen: boolean;
  dialoguePlacement: CliShellDialoguePlacement | null;
  dialogueDraft: string;
  bottomLine: string;
  managedLabel: string;
  unreadLabel: string;
  heartbeatLabel: string;
  terminalLines: string[];
  terminalRichLines?: TerminalRenderRichLine[];
  selectionSources?: CliShellSelectionSourceDescriptor[];
  cursor: { x: number; y: number; visible?: boolean };
  scrollback: {
    viewportOffset: number;
    totalLines: number;
    screenLines: number;
  };
}
