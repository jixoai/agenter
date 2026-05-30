import type { WorkspaceEntry } from "@agenter/client-sdk";

export type WorkspaceHistorySortMode = "recent" | "path" | "name";

const GLOBAL_WORKSPACE_ALIAS = "~/";
const GLOBAL_WORKSPACE_OBJECTIVE_PATH = "~/.agenter";

const normalizeWorkspacePath = (path: string): string => {
  if (path === GLOBAL_WORKSPACE_ALIAS) {
    return GLOBAL_WORKSPACE_OBJECTIVE_PATH;
  }
  if (/^[A-Za-z]:[\\/]+$/u.test(path)) {
    return path.replace(/[\\/]+$/u, "");
  }
  const normalized = path.replace(/[\\/]+$/u, "");
  return normalized.length > 0 ? normalized : path;
};

const workspaceSegments = (path: string): string[] => {
  return normalizeWorkspacePath(path)
    .split(/[\\/]+/u)
    .filter(Boolean);
};

export const describeWorkspace = (path: string): string => normalizeWorkspacePath(path);

const inferHomeDirFromWorkspace = (path: string): string | null => {
  if (path === GLOBAL_WORKSPACE_ALIAS) {
    return null;
  }
  const normalized = normalizeWorkspacePath(path);
  const unixMatch = normalized.match(/^\/(?:Users|home)\/[^/]+/u);
  if (unixMatch) {
    return unixMatch[0];
  }
  const windowsMatch = normalized.match(/^[A-Za-z]:\\Users\\[^\\]+/u);
  if (windowsMatch) {
    return windowsMatch[0];
  }
  return null;
};

export const resolveObjectiveWorkspacePath = (
  workspace: Pick<WorkspaceEntry, "path"> & Partial<Pick<WorkspaceEntry, "objectivePath">>,
  knownWorkspaces: Array<Pick<WorkspaceEntry, "path">> = [],
): string => {
  if (workspace.objectivePath && workspace.objectivePath.trim().length > 0) {
    return workspace.objectivePath;
  }
  if (workspace.path !== GLOBAL_WORKSPACE_ALIAS) {
    return normalizeWorkspacePath(workspace.path);
  }
  const inferredHome = knownWorkspaces
    .map((entry) => inferHomeDirFromWorkspace(entry.path))
    .find((candidate): candidate is string => Boolean(candidate));
  if (!inferredHome) {
    return GLOBAL_WORKSPACE_OBJECTIVE_PATH;
  }
  return inferredHome.includes("\\") ? `${inferredHome}\\.agenter` : `${inferredHome}/.agenter`;
};

export const describeCompactWorkspace = (path: string, segmentCount = 2): string => {
  if (path === GLOBAL_WORKSPACE_ALIAS) {
    return GLOBAL_WORKSPACE_OBJECTIVE_PATH;
  }
  const segments = workspaceSegments(path);
  if (segments.length === 0) {
    return normalizeWorkspacePath(path);
  }
  return segments.slice(-segmentCount).join("/");
};

export const describeWorkspaceName = (path: string): string => {
  return workspaceSegments(path).at(-1) ?? normalizeWorkspacePath(path);
};

export const sortWorkspacesForCatalog = (workspaces: WorkspaceEntry[], recentPaths: string[]): WorkspaceEntry[] => {
  return [...workspaces].sort((left, right) => {
    if (left.path === GLOBAL_WORKSPACE_ALIAS) {
      return -1;
    }
    if (right.path === GLOBAL_WORKSPACE_ALIAS) {
      return 1;
    }
    if (left.favorite !== right.favorite) {
      return left.favorite ? -1 : 1;
    }
    const leftRank = recentPaths.indexOf(left.path);
    const rightRank = recentPaths.indexOf(right.path);
    if (leftRank !== rightRank) {
      if (leftRank === -1) {
        return 1;
      }
      if (rightRank === -1) {
        return -1;
      }
      return leftRank - rightRank;
    }
    return left.path.localeCompare(right.path);
  });
};

export const sortWorkspacesForHistory = (
  workspaces: WorkspaceEntry[],
  sortMode: WorkspaceHistorySortMode,
): WorkspaceEntry[] => {
  return [...workspaces].sort((left, right) => {
    if (sortMode === "path") {
      return left.path.localeCompare(right.path);
    }
    if (sortMode === "name") {
      return describeWorkspaceName(left.path).localeCompare(describeWorkspaceName(right.path));
    }
    const leftActivity = left.lastSessionActivityAt ?? "";
    const rightActivity = right.lastSessionActivityAt ?? "";
    if (leftActivity !== rightActivity) {
      return rightActivity.localeCompare(leftActivity);
    }
    return left.path.localeCompare(right.path);
  });
};
