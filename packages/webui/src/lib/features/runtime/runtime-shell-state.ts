import { describeCompactWorkspace } from "$lib/features/workspaces/workspace-sorting";
import type { RuntimeChatCycle, RuntimeClientState, SessionEntry } from "@agenter/client-sdk";

export type RuntimeTabId = "heartbeat" | "attention" | "settings";

export interface AvatarSessionRailItem {
  sessionId: string;
  label: string;
  workspacePath: string;
  workspaceName: string;
  detail: string;
  status: SessionEntry["status"] | null;
  unreadCount: number;
  iconUrl: string | null;
  href: string;
  active: boolean;
  pinned: boolean;
  pinEnabled: boolean;
}

export type RunningAvatarRailItem = AvatarSessionRailItem;

export interface RuntimeTabItem {
  id: RuntimeTabId;
  label: string;
  badgeLabel?: string;
  badgeClassName?: string;
  badgeAnimated?: boolean;
}

export const RUNTIME_TAB_LABELS: Record<RuntimeTabId, string> = {
  heartbeat: "Heartbeat",
  attention: "Attention",
  settings: "Settings",
};

export const basenameWorkspace = (workspacePath: string): string => {
  return describeCompactWorkspace(workspacePath);
};

export const normalizeRuntimeTab = (value: string | null | undefined): RuntimeTabId => {
  if (value === "heartbeat" || value === "attention" || value === "settings") {
    return value;
  }
  return "heartbeat";
};

export const extractRuntimeSessionId = (pathname: string): string | null => {
  const match = /^\/avatars\/runtime\/([^/]+)(?:\/[^/]+)?$/u.exec(pathname);
  return match?.[1] ?? null;
};

export const extractRuntimeTab = (pathname: string): RuntimeTabId | null => {
  const match = /^\/avatars\/runtime\/[^/]+\/([^/]+)$/u.exec(pathname);
  return match ? normalizeRuntimeTab(match[1]) : null;
};

export const resolveRuntimeStatusLabel = (status: SessionEntry["status"]): string => {
  switch (status) {
    case "running":
      return "Running";
    case "starting":
      return "Starting";
    case "error":
      return "Error";
    case "stopped":
      return "Stopped";
    case "paused":
      return "Paused";
    default:
      return status;
  }
};

export const resolveRuntimeStatusTone = (status: SessionEntry["status"]): string => {
  switch (status) {
    case "running":
      return "bg-emerald-500";
    case "starting":
      return "bg-amber-500";
    case "error":
      return "bg-rose-500";
    default:
      return "bg-muted-foreground/50";
  }
};

export const resolveCycleBadgeClassName = (cycle: RuntimeChatCycle | null, active: boolean): string | undefined => {
  if (!cycle) {
    return undefined;
  }
  if (cycle.status === "error") {
    return "bg-rose-500 text-white";
  }
  if (cycle.kind === "compact") {
    return active ? "bg-amber-500 text-white" : "bg-amber-400 text-black";
  }
  return active ? "bg-teal-600 text-white" : "bg-emerald-500 text-white";
};

export const buildRuntimeTabs = (input: {
  activeCycle: RuntimeChatCycle | null;
  latestCycle: RuntimeChatCycle | null;
}): RuntimeTabItem[] => {
  const cycle = input.activeCycle ?? input.latestCycle;
  return [
    {
      id: "heartbeat",
      label: "Heartbeat",
      badgeLabel: cycle ? (cycle.cycleId === null ? "P" : String(cycle.cycleId)) : undefined,
      badgeClassName: resolveCycleBadgeClassName(cycle, Boolean(input.activeCycle)),
      badgeAnimated: Boolean(input.activeCycle),
    },
    { id: "attention", label: "Attention" },
    { id: "settings", label: "Settings" },
  ];
};

export const buildAvatarSessionRailItems = (
  state: RuntimeClientState,
  input: {
    activeSessionId: string | null;
    openedSessionIds?: readonly string[];
    pinnedSessionIds?: readonly string[];
    resolveSessionIconUrl: (sessionId: string) => string | null;
  },
): AvatarSessionRailItem[] => {
  const openedSessionIds = new Set((input.openedSessionIds ?? []).filter((sessionId) => sessionId.length > 0));
  const pinnedSessionIds = new Set((input.pinnedSessionIds ?? []).filter((sessionId) => sessionId.length > 0));
  return state.sessions
    .filter(
      (session) =>
        session.status === "running" ||
        session.status === "starting" ||
        openedSessionIds.has(session.id) ||
        pinnedSessionIds.has(session.id),
    )
    .map((session) => ({
      sessionId: session.id,
      label: session.avatar || session.name,
      workspacePath: session.workspacePath,
      workspaceName: basenameWorkspace(session.workspacePath),
      detail: `${basenameWorkspace(session.workspacePath)} · ${resolveRuntimeStatusLabel(session.status)}`,
      status: session.status,
      unreadCount: state.unreadBySession[session.id] ?? 0,
      iconUrl: input.resolveSessionIconUrl(session.id),
      href: `/avatars/runtime/${encodeURIComponent(session.id)}/heartbeat`,
      active: input.activeSessionId === session.id,
      pinned: pinnedSessionIds.has(session.id),
      pinEnabled: true,
    }));
};

export const buildRunningAvatarRailItems = buildAvatarSessionRailItems;
