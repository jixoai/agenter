import type { HeartbeatCapabilityMode } from "@agenter/web-heartbeat-view";

export const defaultWsUrl = "ws://127.0.0.1:4580/trpc";

export const normalizeMode = (value: string | null | undefined): HeartbeatCapabilityMode =>
  value === "configable" ? "configable" : "readonly";
