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

export const normalizeRecordPageSize = (value: string | number | null | undefined): number => {
  const parsed = typeof value === "number" ? value : Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) {
    return 5;
  }
  return Math.max(1, Math.min(200, parsed));
};
