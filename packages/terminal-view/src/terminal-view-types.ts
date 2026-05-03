import type { TerminalTransportSnapshot } from "@agenter/terminal-transport-protocol";

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
