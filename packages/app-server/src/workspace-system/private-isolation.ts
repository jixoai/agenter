import { readdirSync, realpathSync } from "node:fs";
import { relative, resolve } from "node:path";

import {
  resolveWorkspaceAvatarPrivateRoot,
  resolveWorkspaceAvatarNicknamesRoot,
  resolveWorkspacePrivateAvatarsRoot,
} from "./paths";

const resolveExistingPath = (path: string): string => {
  try {
    return realpathSync(path);
  } catch {
    return resolve(path);
  }
};

const toRulePath = (workspacePath: string, absolutePath: string): string | null => {
  const relation = relative(resolveExistingPath(workspacePath), resolveExistingPath(absolutePath)).replace(/\\/gu, "/");
  if (relation.startsWith("..")) {
    return null;
  }
  return relation.length === 0 ? "/" : `/${relation}`;
};

const listSiblingDirectories = (root: string): string[] => {
  try {
    return readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
      .map((entry) => entry.name);
  } catch {
    return [];
  }
};

export const listWorkspaceHiddenPrivatePaths = (input: {
  workspacePath: string;
  avatar: string;
  hideNicknameAliases?: boolean;
}): string[] => {
  const privateRoot = resolveWorkspacePrivateAvatarsRoot(input.workspacePath);
  const currentAvatarRoot = resolveWorkspaceAvatarPrivateRoot(input.workspacePath, input.avatar);
  const currentPrivateRulePath = toRulePath(input.workspacePath, currentAvatarRoot);
  const hiddenPaths = new Set<string>();

  for (const entryName of listSiblingDirectories(privateRoot)) {
    const siblingRulePath = toRulePath(input.workspacePath, `${privateRoot}/${entryName}`);
    if (!siblingRulePath || siblingRulePath === currentPrivateRulePath) {
      continue;
    }
    hiddenPaths.add(siblingRulePath);
  }

  if (input.hideNicknameAliases ?? true) {
    const nicknameRoot = resolveWorkspaceAvatarNicknamesRoot(input.workspacePath);
    const nicknameRulePath = toRulePath(input.workspacePath, nicknameRoot);
    if (nicknameRulePath) {
      hiddenPaths.add(nicknameRulePath);
    }
  }

  return [...hiddenPaths].sort();
};
