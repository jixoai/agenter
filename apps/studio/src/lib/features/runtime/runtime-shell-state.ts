import type { AvatarSessionIdentityResolverInput } from "$lib/features/avatars/avatar-session-identity";
import { resolveAvatarSessionIdentity } from "$lib/features/avatars/avatar-session-identity";
import type { WorkbenchPageTabBadgeTone } from "$lib/features/navigation/workbench-page-tabs.types";
import { describeCompactWorkspace } from "$lib/features/workspaces/workspace-sorting";
import type { RuntimeChatCycle, RuntimeClientState, SessionEntry } from "@agenter/client-sdk";

export { resolveAvatarSessionIdentity } from "$lib/features/avatars/avatar-session-identity";

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
  avatarPrincipalId: string | null;
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
  badgeTone?: WorkbenchPageTabBadgeTone;
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

export const resolveCycleBadgeTone = (
  cycle: RuntimeChatCycle | null,
  active: boolean,
): WorkbenchPageTabBadgeTone | undefined => {
  if (!cycle) {
    return undefined;
  }
  if (cycle.status === "error") {
    return "critical";
  }
  if (cycle.kind === "compact") {
    return "warning";
  }
  return active ? "accent" : "positive";
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
      badgeTone: resolveCycleBadgeTone(cycle, Boolean(input.activeCycle)),
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
  } & AvatarSessionIdentityResolverInput,
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
    .map((session) => {
      const identity = resolveAvatarSessionIdentity(session, input);
      return {
        sessionId: session.id,
        label: session.avatar || session.name,
        workspacePath: session.workspacePath,
        workspaceName: basenameWorkspace(session.workspacePath),
        detail: `${basenameWorkspace(session.workspacePath)} · ${resolveRuntimeStatusLabel(session.status)}`,
        status: session.status,
        unreadCount: state.unreadBySession[session.id] ?? 0,
        iconUrl: identity.iconUrl,
        avatarPrincipalId: identity.avatarPrincipalId,
        href: `/avatars/runtime/${encodeURIComponent(session.id)}/heartbeat`,
        active: input.activeSessionId === session.id,
        pinned: pinnedSessionIds.has(session.id),
        pinEnabled: true,
      };
    });
};

export const buildRunningAvatarRailItems = buildAvatarSessionRailItems;
