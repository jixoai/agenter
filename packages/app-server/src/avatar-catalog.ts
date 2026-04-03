import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import { defaultAvatarNickname, normalizeAvatarNickname } from "@agenter/avatar";

import { GLOBAL_WORKSPACE_PATH, isGlobalWorkspacePath, toWorkspaceCwd } from "./workspace-target";

export interface WorkspaceAvatarCatalogEntry {
  nickname: string;
  defaultAvatar: boolean;
  sourceScope: "global" | "workspace";
  globalAvailable: boolean;
  workspaceAvailable: boolean;
  globalPath: string;
  workspacePath: string;
  effectivePath: string;
}

export const resolveWorkspaceAvatarRoot = (workspacePath: string, homeDir: string): string => {
  return join(toWorkspaceCwd(workspacePath, homeDir), ".agenter", "avatar");
};

const listAvatarNicknames = (root: string): string[] => {
  if (!existsSync(root)) {
    return [];
  }
  try {
    return readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => normalizeAvatarNickname(entry.name));
  } catch {
    return [];
  }
};

const buildCatalogEntry = (input: {
  workspacePath: string;
  nickname: string;
  homeDir: string;
}): WorkspaceAvatarCatalogEntry => {
  const globalPath = join(resolveWorkspaceAvatarRoot(GLOBAL_WORKSPACE_PATH, input.homeDir), input.nickname);
  const workspacePath = join(resolveWorkspaceAvatarRoot(input.workspacePath, input.homeDir), input.nickname);
  const globalAvailable = existsSync(globalPath);
  const workspaceAvailable = !isGlobalWorkspacePath(input.workspacePath, input.homeDir) && existsSync(workspacePath);
  const sourceScope = workspaceAvailable ? "workspace" : "global";
  return {
    nickname: input.nickname,
    defaultAvatar: input.nickname === defaultAvatarNickname(),
    sourceScope,
    globalAvailable,
    workspaceAvailable,
    globalPath,
    workspacePath,
    effectivePath: sourceScope === "workspace" ? workspacePath : globalPath,
  };
};

export const listWorkspaceAvatarCatalog = (workspacePath: string, homeDir = homedir()): WorkspaceAvatarCatalogEntry[] => {
  const normalizedWorkspacePath = isGlobalWorkspacePath(workspacePath, homeDir) ? GLOBAL_WORKSPACE_PATH : workspacePath;
  const nicknames = new Set<string>([normalizeAvatarNickname(defaultAvatarNickname())]);
  listAvatarNicknames(resolveWorkspaceAvatarRoot(GLOBAL_WORKSPACE_PATH, homeDir)).forEach((nickname) =>
    nicknames.add(nickname),
  );
  if (!isGlobalWorkspacePath(normalizedWorkspacePath, homeDir)) {
    listAvatarNicknames(resolveWorkspaceAvatarRoot(normalizedWorkspacePath, homeDir)).forEach((nickname) =>
      nicknames.add(nickname),
    );
  }

  return [...nicknames]
    .sort((left, right) => {
      if (left === defaultAvatarNickname()) {
        return -1;
      }
      if (right === defaultAvatarNickname()) {
        return 1;
      }
      return left.localeCompare(right);
    })
    .map((nickname) =>
      buildCatalogEntry({
        workspacePath: normalizedWorkspacePath,
        nickname,
        homeDir,
      }),
    );
};

export const forkAvatarIntoWorkspace = (input: {
  workspacePath: string;
  nickname: string;
  homeDir?: string;
}): WorkspaceAvatarCatalogEntry => {
  return copyAvatarIntoWorkspace({
    workspacePath: input.workspacePath,
    sourceNickname: input.nickname,
    targetNickname: input.nickname,
    homeDir: input.homeDir,
  });
};

export const copyAvatarIntoWorkspace = (input: {
  workspacePath: string;
  sourceNickname: string;
  targetNickname: string;
  homeDir?: string;
}): WorkspaceAvatarCatalogEntry => {
  const homeDir = input.homeDir ?? homedir();
  const workspacePath = isGlobalWorkspacePath(input.workspacePath, homeDir) ? GLOBAL_WORKSPACE_PATH : input.workspacePath;
  if (isGlobalWorkspacePath(workspacePath, homeDir)) {
    return buildCatalogEntry({
      workspacePath,
      nickname: normalizeAvatarNickname(input.targetNickname),
      homeDir,
    });
  }

  const sourceNickname = normalizeAvatarNickname(input.sourceNickname);
  const targetNickname = normalizeAvatarNickname(input.targetNickname);
  const workspaceSourcePath = join(resolveWorkspaceAvatarRoot(workspacePath, homeDir), sourceNickname);
  const globalSourcePath = join(resolveWorkspaceAvatarRoot(GLOBAL_WORKSPACE_PATH, homeDir), sourceNickname);
  const sourcePath = existsSync(workspaceSourcePath) ? workspaceSourcePath : globalSourcePath;
  const targetPath = join(resolveWorkspaceAvatarRoot(workspacePath, homeDir), targetNickname);

  mkdirSync(dirname(targetPath), { recursive: true });
  if (!existsSync(targetPath) && existsSync(sourcePath)) {
    cpSync(sourcePath, targetPath, {
      recursive: true,
      force: true,
    });
  } else if (!existsSync(targetPath)) {
    mkdirSync(targetPath, { recursive: true });
  }

  return buildCatalogEntry({
    workspacePath,
    nickname: targetNickname,
    homeDir,
  });
};
