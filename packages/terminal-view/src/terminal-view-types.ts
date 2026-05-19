import type { TerminalTransportSnapshot } from "@agenter/terminal-transport-protocol";
import type { TerminalTransportGeometryRole } from "@agenter/terminal-transport-protocol";

export type TerminalViewConnectionState = "idle" | "connecting" | "connected" | "closed" | "error";

export interface TerminalViewScreenMetrics {
  width: number;
  height: number;
}

export type TerminalViewPresentationSettleReason =
  | "initial-session-ready"
  | "live-apply"
  | "rebuild-session"
  | "stable-session";

export interface TerminalViewPresentationReadyDetail {
  terminalId: string;
  resolvedRenderer: "ghostty-web" | "wterm" | "xterm";
  reason: TerminalViewPresentationSettleReason;
  screenMetrics: TerminalViewScreenMetrics | null;
}

export type TerminalViewSnapshot = TerminalTransportSnapshot;
export type TerminalViewGeometryRole = TerminalTransportGeometryRole;

export interface TerminalViewGeometryAuthorityDetail {
  terminalId: string;
  requestedGeometryRole: TerminalViewGeometryRole;
  effectiveGeometryRole: TerminalViewGeometryRole;
  geometryOrder?: number;
  transportAttachmentId?: string;
  geometryAuthorityAttachmentId?: string;
  authorityReason?: string;
}

export type TerminalViewPermissionRequestStatus = "pending" | "approved" | "denied" | "expired";
export type TerminalViewPermissionInputMode = "raw" | "mixed";

export interface TerminalViewPermissionRequest {
  requestId: string;
  terminalId: string;
  participantId: string;
  assignedAdminId?: string;
  createdAt: number;
  expiresAt: number;
  status: TerminalViewPermissionRequestStatus;
  requestedInput?: {
    mode: TerminalViewPermissionInputMode;
    text: string;
  };
  decidedAt?: number;
  decidedBy?: string;
  leaseId?: string;
}

export interface TerminalViewPermissionRequestDetail {
  terminalId: string;
  request: TerminalViewPermissionRequest;
}

export interface TerminalViewApprovalActionDetail {
  terminalId: string;
  requestId: string;
  action: "approve" | "deny";
}

export type TerminalViewRequestPermissionsHandler = (detail: TerminalViewPermissionRequestDetail) => boolean | void;
