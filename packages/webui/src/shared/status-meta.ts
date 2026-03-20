import type { RuntimeConnectionStatus } from "@agenter/client-sdk";

import type { BadgeProps } from "../components/ui/badge";

export interface StatusMeta {
  label: string;
  variant: NonNullable<BadgeProps["variant"]>;
}

export const sessionStatusMeta = (status: "stopped" | "starting" | "running" | "error"): StatusMeta => {
  if (status === "running") {
    return { label: "running", variant: "success" };
  }
  if (status === "starting") {
    return { label: "starting", variant: "warning" };
  }
  if (status === "error") {
    return { label: "error", variant: "destructive" };
  }
  return { label: "stopped", variant: "secondary" };
};

export const runningCountMeta = (count: number): StatusMeta | null => {
  if (count <= 0) {
    return null;
  }
  return {
    label: `running ${count}`,
    variant: "success",
  };
};

export interface TransportStatusMeta {
  label: string;
  className: string;
}

export const transportStatusMeta = (status: RuntimeConnectionStatus): TransportStatusMeta => {
  if (status === "offline") {
    return { label: "Offline", className: "text-rose-700" };
  }
  if (status === "reconnecting") {
    return { label: "Reconnecting", className: "text-amber-700" };
  }
  if (status === "connecting") {
    return { label: "Connecting", className: "text-slate-500" };
  }
  return { label: "Connected", className: "text-slate-500" };
};
