import type { TerminalTransportSnapshot } from "@agenter/terminal-transport-protocol";

export type TerminalViewConnectionState = "idle" | "connecting" | "connected" | "closed" | "error";

export interface TerminalViewScreenMetrics {
  width: number;
  height: number;
}

export type TerminalViewSnapshot = TerminalTransportSnapshot;
