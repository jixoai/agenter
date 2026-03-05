import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter, RuntimeEventEnvelope, RuntimeSnapshotPayload } from "@agenter/app-server";

export type RouterOutputs = inferRouterOutputs<AppRouter>;

export type SessionListOutput = RouterOutputs["session"]["list"];
export type SessionEntry = SessionListOutput["sessions"][number];
export type RuntimeEvent = RuntimeEventEnvelope;
export type RuntimeSnapshot = RuntimeSnapshotPayload;

export interface RuntimeClientState {
  connected: boolean;
  lastEventId: number;
  sessions: SessionEntry[];
  runtimes: RuntimeSnapshot["runtimes"];
  activityBySession: Record<string, "idle" | "active">;
  terminalSnapshotsBySession: Record<
    string,
    Record<
      string,
      {
        seq: number;
        timestamp: number;
        cols: number;
        rows: number;
        lines: string[];
        cursor: { x: number; y: number };
      }
    >
  >;
  chatsBySession: Record<
    string,
    Array<{
      id: string;
      role: "user" | "assistant";
      content: string;
      timestamp: number;
      channel?: "to_user" | "self_talk" | "tool_call" | "tool_result";
      format?: "plain" | "markdown";
      tool?: {
        name: string;
        ok?: boolean;
      };
    }>
  >;
  tasksBySession: Record<string, RuntimeSnapshot["runtimes"][string]["tasks"]>;
  recentWorkspaces: string[];
}
