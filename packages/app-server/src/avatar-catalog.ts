import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";

import {
  defaultAvatarNickname,
  normalizeAvatarNickname,
  resolveGlobalAvatarAliasRoot,
  resolveGlobalAvatarNicknamesRoot,
  resolveGlobalAvatarRoot,
} from "@agenter/avatar";
import type { AvatarClassify } from "@agenter/auth-service";

import { resolveAvatarRuntimeId } from "./avatar-runtime-id";
import { ensureAvatarSeatPrincipal } from "./avatar-seat-store";
import {
  resolveWorkspaceAvatarAliasRoot,
  resolveWorkspaceAvatarNicknamesRoot,
  resolveWorkspaceAvatarPrivateRoot,
} from "./workspace-system";
import { GLOBAL_WORKSPACE_PATH, isGlobalWorkspacePath } from "./workspace-target";

export interface WorkspaceAvatarCatalogEntry {
  avatarPrincipalId: string | null;
  runtimeId: string;
  nickname: string;
  displayName: string | null;
  classify: AvatarClassify | null;
  iconUrl: string | null;
  defaultAvatar: boolean;
  sourceScope: "global";
  globalAvailable: boolean;
  workspacePrivateSlotReady: boolean;
  globalPath: string;
  workspacePrivatePath: string;
  effectivePath: string;
}

const compareAvatarNickname = (left: string, right: string): number => {
  if (left === defaultAvatarNickname()) {
    return -1;
  }
  if (right === defaultAvatarNickname()) {
    return 1;
  }
  return left.localeCompare(right);
};

export const resolveWorkspaceAvatarRoot = (workspacePath: string, homeDir: string): string => {
  return isGlobalWorkspacePath(workspacePath, homeDir)
    ? resolveGlobalAvatarNicknamesRoot(homeDir)
    : resolveWorkspaceAvatarNicknamesRoot(workspacePath, homeDir);
};

const listAvatarNicknames = (root: string): string[] => {
  if (!existsSync(root)) {
    return [];
  }
  try {
    return readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
      .map((entry) => normalizeAvatarNickname(entry.name));
  } catch {
    return [];
  }
};

export const listGlobalAvatarNicknamesFromStorage = (homeDir = homedir()): string[] => {
  const nicknames = new Set<string>([normalizeAvatarNickname(defaultAvatarNickname())]);
  for (const nickname of listAvatarNicknames(resolveGlobalAvatarNicknamesRoot(homeDir))) {
    nicknames.add(nickname);
  }
  return [...nicknames].sort(compareAvatarNickname);
};

export const listWorkspaceAvatarNicknamesFromStorage = (workspacePath: string, homeDir = homedir()): string[] => {
  const normalizedWorkspacePath = isGlobalWorkspacePath(workspacePath, homeDir) ? GLOBAL_WORKSPACE_PATH : workspacePath;
  const nicknames = new Set<string>(listGlobalAvatarNicknamesFromStorage(homeDir));
  if (!isGlobalWorkspacePath(normalizedWorkspacePath, homeDir)) {
    for (const nickname of listAvatarNicknames(resolveWorkspaceAvatarNicknamesRoot(normalizedWorkspacePath, homeDir))) {
      nicknames.add(nickname);
    }
  }
  return [...nicknames].sort(compareAvatarNickname);
};

export const buildWorkspaceAvatarCatalogEntry = (input: {
  workspacePath: string;
  nickname: string;
  homeDir: string;
  avatarPrincipalId?: string | null;
  displayName?: string | null;
  classify?: AvatarClassify | null;
  iconUrl?: string | null;
  globalAvailable?: boolean;
}): WorkspaceAvatarCatalogEntry => {
  const nickname = normalizeAvatarNickname(input.nickname);
  const globalPath = resolveGlobalAvatarRoot(nickname, input.homeDir);
  const workspacePrivatePath = resolveWorkspaceAvatarPrivateRoot(input.workspacePath, nickname, input.homeDir);
  const globalAvailable =
    input.globalAvailable ?? (existsSync(resolveGlobalAvatarAliasRoot(nickname, input.homeDir)) || existsSync(globalPath));
  const workspacePrivateSlotReady =
    !isGlobalWorkspacePath(input.workspacePath, input.homeDir) &&
    existsSync(resolveWorkspaceAvatarAliasRoot(input.workspacePath, nickname, input.homeDir));

  return {
    avatarPrincipalId: input.avatarPrincipalId ?? null,
    runtimeId: resolveAvatarRuntimeId(nickname),
    nickname,
    displayName: input.displayName ?? null,
    classify: input.classify ?? null,
    iconUrl: input.iconUrl ?? null,
    defaultAvatar: nickname === defaultAvatarNickname(),
    sourceScope: "global",
    globalAvailable,
    workspacePrivateSlotReady,
    globalPath,
    workspacePrivatePath,
    effectivePath: workspacePrivateSlotReady ? workspacePrivatePath : globalPath,
  };
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
  const targetNickname = normalizeAvatarNickname(input.targetNickname);

  if (!isGlobalWorkspacePath(workspacePath, homeDir)) {
    ensureAvatarSeatPrincipal({
      workspacePath,
      avatar: targetNickname,
      homeDir,
    });
  }

  return buildWorkspaceAvatarCatalogEntry({
    workspacePath,
    nickname: targetNickname,
    homeDir,
  });
};
