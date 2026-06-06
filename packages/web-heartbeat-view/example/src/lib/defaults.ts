import type { HeartbeatCapabilityMode } from "@agenter/web-heartbeat-view";

// Default to the daemon started from this worktree.
export const defaultWsUrl = "ws://127.0.0.1:4580/trpc";

export const normalizeMode = (value: string | null | undefined): HeartbeatCapabilityMode =>
  value === "configable" ? "configable" : "readonly";

export const normalizeSilentConnect = (value: boolean | string | null | undefined): boolean => {
  if (typeof value === "boolean") {
    return value;
  }
  const normalized = value?.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
};
