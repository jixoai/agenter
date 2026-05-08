import type {
  GlobalRoomSnapshotOutput,
  RuntimeStore,
} from "@agenter/client-sdk";
import type { TerminalRenderRichLine } from "@agenter/termless-core";
import type { CliShellLiveTerminalView } from "./live-terminal-mirror";

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
  terminalView: {
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
    connected: boolean;
    running: boolean;
  };
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
  liveTerminal?: CliShellLiveTerminalView | null;
}

export type CliShellTuiStore = CliShellStore &
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
  >;
