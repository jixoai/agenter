import type {
  GlobalRoomSnapshotOutput,
  RuntimeStore,
} from "@agenter/client-sdk";

import type { CliShellStore } from "../bootstrap";
import type { CliShellManagedState } from "../managed";

export type CliShellDialoguePlacement = "left" | "right" | "bottom" | "floating";
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
  terminalLines: string[];
  toolbarLeft: string;
  toolbarHeartbeat: string;
  toolbarManaged: string;
  toolbarUnread: string;
  dialogueOpen: boolean;
  dialoguePlacement: CliShellDialoguePlacement | null;
  dialogueBlocks: CliShellDialogueBlock[];
  dialogueDraft: string;
  dialogueTitle: string;
}

export interface CliShellTuiViewState {
  dialogueOpen: boolean;
  requestedPlacement: CliShellDialoguePlacementRequest;
  dialogueDraft: string;
  managed: CliShellManagedState;
  statusNotice: string | null;
}

export interface CliShellTuiAppProjection {
  roomSnapshot: GlobalRoomSnapshotOutput | null;
}

export type CliShellTuiStore = CliShellStore &
  Pick<
    RuntimeStore,
    | "getState"
    | "subscribe"
    | "connect"
    | "disconnect"
    | "hydrateSessionArtifacts"
    | "retainGlobalRoomSnapshot"
    | "hydrateGlobalRoomSnapshot"
    | "sendGlobalRoomMessage"
    | "inputGlobalTerminal"
    | "setGlobalTerminalConfig"
  >;
