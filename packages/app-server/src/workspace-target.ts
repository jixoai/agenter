import { homedir } from "node:os";
import { basename, resolve } from "node:path";

export const GLOBAL_WORKSPACE_PATH = "~/" as const;

const normalizeGlobalToken = (value: string): boolean => {
  const trimmed = value.trim();
  return trimmed === "~" || trimmed === GLOBAL_WORKSPACE_PATH;
};

export const isGlobalWorkspacePath = (value: string, homeDir = homedir()): boolean => {
  if (normalizeGlobalToken(value)) {
    return true;
  }
  return resolve(value) === resolve(homeDir);
};

export const resolveWorkspaceFsPath = (value: string, homeDir = homedir()): string => {
  const trimmed = value.trim();
  if (normalizeGlobalToken(trimmed) || trimmed === "~") {
    return resolve(homeDir);
  }
  if (trimmed.startsWith("~/")) {
    return resolve(homeDir, trimmed.slice(2));
  }
  return resolve(trimmed);
};

export const toWorkspacePath = (value: string, homeDir = homedir()): string => {
  return isGlobalWorkspacePath(value, homeDir) ? GLOBAL_WORKSPACE_PATH : resolveWorkspaceFsPath(value, homeDir);
};

export const toWorkspaceCwd = (value: string, homeDir = homedir()): string => {
  return isGlobalWorkspacePath(value, homeDir) ? resolve(homeDir) : resolveWorkspaceFsPath(value, homeDir);
};

export const workspaceDisplayName = (workspacePath: string): string => {
  if (workspacePath === GLOBAL_WORKSPACE_PATH) {
    return "~/";
  }
  const name = basename(workspacePath);
  return name.length > 0 ? name : workspacePath;
};
