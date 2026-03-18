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
