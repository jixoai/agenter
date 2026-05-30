import type { WorkspaceCliCatalogEntry } from "@agenter/client-sdk";

export type WorkspaceShellSurface = "root-workspace" | "public-workspace";
export type WorkspaceShellMountKind = "avatar-root" | "workspace" | null;
export type WorkspaceShellRuntimeStatus = "running" | "starting" | "stopped" | "paused" | "error" | null | undefined;

export interface WorkspaceShellSurfaceDescriptor {
  badgeLabel: string;
  title: string;
  summary: string;
  promptTag: string;
}

export interface WorkspaceShellLaunch {
  avatar: string;
  command: string;
  commandLabel: string;
  cwd: string | null;
  runtimeId: string;
  surface: WorkspaceShellSurface;
  workspacePath: string;
}

export const normalizeWorkspaceShellSurface = (value: string | null | undefined): WorkspaceShellSurface | null => {
  if (value === "root-workspace" || value === "public-workspace") {
    return value;
  }
  return null;
};

export const resolveWorkspaceShellSurface = (input: {
  entry: Pick<WorkspaceCliCatalogEntry, "preferredExecutionSurface">;
  currentSurfaceKind: WorkspaceShellSurface;
}): WorkspaceShellSurface => input.entry.preferredExecutionSurface ?? input.currentSurfaceKind;

export const resolveWorkspaceShellLaunchCwd = (input: {
  surface: WorkspaceShellSurface;
  workspacePath: string;
  mountKind: WorkspaceShellMountKind;
  hasRootGrantAccess: boolean;
}): string | null => {
  if (input.surface === "public-workspace") {
    return input.workspacePath;
  }
  if (input.mountKind === "avatar-root" || input.hasRootGrantAccess) {
    return input.workspacePath;
  }
  return null;
};

export const describeWorkspaceShellSurface = (surface: WorkspaceShellSurface): WorkspaceShellSurfaceDescriptor =>
  surface === "root-workspace"
    ? {
        badgeLabel: "Root workspace",
        title: "Root workspace shell",
        summary: "Runs through the active runtime root shell with avatar-private env and runtime CLI.",
        promptTag: "root",
      }
    : {
        badgeLabel: "Public workspace",
        title: "Public workspace shell",
        summary: "Runs through the collaboration-oriented public-workspace shell surface.",
        promptTag: "workspace",
      };

export const buildWorkspaceShellPromptLabel = (input: { avatar: string; surface: WorkspaceShellSurface }): string =>
  `${input.avatar}@${describeWorkspaceShellSurface(input.surface).promptTag}`;

const HOME_PATH_PATTERNS = [/^\/Users\/[^/]+/u, /^\/home\/[^/]+/u] as const;

export const formatWorkspaceShellPath = (value: string | null | undefined): string => {
  const normalized = value?.trim();
  if (!normalized) {
    return "~";
  }
  return normalized;
};

const formatWorkspaceShellPromptPath = (value: string): string => {
  for (const pattern of HOME_PATH_PATTERNS) {
    if (pattern.test(value)) {
      return value.replace(pattern, "~");
    }
  }
  return value;
};

export const resolveWorkspaceShellPromptFolderName = (value: string | null | undefined): string => {
  const formatted = formatWorkspaceShellPromptPath(formatWorkspaceShellPath(value));
  if (formatted === "~" || formatted === "/") {
    return formatted;
  }
  const normalized = formatted.replace(/\/+$/u, "");
  const segments = normalized.split("/").filter(Boolean);
  return segments.at(-1) ?? formatted;
};

export const resolveWorkspaceShellRuntimeRunning = (status: WorkspaceShellRuntimeStatus): boolean =>
  status === "running";

export const resolveWorkspaceShellRuntimeStarting = (status: WorkspaceShellRuntimeStatus): boolean =>
  status === "starting";
