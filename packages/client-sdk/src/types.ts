import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter, RuntimeEventEnvelope, RuntimeSnapshotPayload } from "@agenter/app-server";

export type RouterOutputs = inferRouterOutputs<AppRouter>;

export type SessionListOutput = RouterOutputs["session"]["list"];
export type SessionInstance = SessionListOutput["instances"][number];
export type RuntimeEvent = RuntimeEventEnvelope;
export type RuntimeSnapshot = RuntimeSnapshotPayload;

export interface RuntimeClientState {
  connected: boolean;
  lastEventId: number;
  instances: SessionInstance[];
  runtimes: RuntimeSnapshot["runtimes"];
  chatsByInstance: Record<string, Array<{ id: string; role: "user" | "assistant"; content: string; timestamp: number }>>;
}
