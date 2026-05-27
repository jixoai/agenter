import type { GlobalTerminalApprovalRequest } from "@agenter/client-sdk";
import type { TerminalRenderRichLine } from "@agenter/termless-core";

export interface OpenComposeSelectionRegion {
  readonly owner: "terminal" | "dialogue";
  readonly row: number;
  readonly col: number;
  readonly width: number;
  readonly height: number;
}

export interface OpenComposeSelectionSourceDescriptor extends OpenComposeSelectionRegion {
  readonly sourceStartRow?: number;
}

export interface OpenComposeSelectionSource extends OpenComposeSelectionSourceDescriptor {
  readonly lines: readonly TerminalRenderRichLine[];
}

export type OpenComposeTerminalPermissionRequest = GlobalTerminalApprovalRequest;

export interface OpenComposeTerminalPermissionRequestDetail {
  readonly terminalId: string;
  readonly request: OpenComposeTerminalPermissionRequest;
}

export interface OpenComposeTerminalApprovalActionDetail {
  readonly terminalId: string;
  readonly requestId: string;
  readonly action: "approve" | "deny";
  readonly durationMs?: number;
}

export type OpenComposeTerminalRequestPermissionsHandler = (
  detail: OpenComposeTerminalPermissionRequestDetail,
) => boolean | void;
