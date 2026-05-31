import { existsSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import {
  normalizeAvatarNickname,
  resolveGlobalAvatarAliasRoot,
  resolveGlobalAvatarCanonicalRoot,
  resolveGlobalAvatarNicknamesRoot,
  resolveGlobalAvatarRoot,
} from "@agenter/avatar";

import { isGlobalWorkspacePath, toWorkspaceCwd, toWorkspacePath } from "../workspace-target";
import type { WorkspaceAssetKind } from "./types";

export const normalizeWorkspaceAssetKind = (value: WorkspaceAssetKind): WorkspaceAssetKind => value;

const resolveAliasTargetOrSelf = (path: string): string => {
  if (!existsSync(path)) {
    return path;
  }
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
};

export const resolveWorkspaceSystemRoot = (workspacePath: string, homeDir = homedir()): string =>
  join(toWorkspaceCwd(workspacePath, homeDir), ".agenter");

export const resolveWorkspacePublicRoot = (workspacePath: string, homeDir = homedir()): string =>
  join(resolveWorkspaceSystemRoot(workspacePath, homeDir), "workspace");

export const resolveWorkspacePublicAssetRoot = (
  workspacePath: string,
  kind: WorkspaceAssetKind,
  homeDir = homedir(),
): string => join(resolveWorkspacePublicRoot(workspacePath, homeDir), normalizeWorkspaceAssetKind(kind));

export const resolveWorkspacePrivateAvatarsRoot = (workspacePath: string, homeDir = homedir()): string =>
  join(resolveWorkspaceSystemRoot(workspacePath, homeDir), "avatars", "by-principal");

export const resolveWorkspaceAvatarNicknamesRoot = (workspacePath: string, homeDir = homedir()): string => {
  if (isGlobalWorkspacePath(workspacePath, homeDir)) {
    return resolveGlobalAvatarNicknamesRoot(homeDir);
  }
  return join(resolveWorkspaceSystemRoot(workspacePath, homeDir), "avatars", "by-nickname");
};

export const resolveWorkspaceAvatarAliasRoot = (
  workspacePath: string,
  avatar: string,
  homeDir = homedir(),
): string => {
  if (isGlobalWorkspacePath(workspacePath, homeDir)) {
    return resolveGlobalAvatarAliasRoot(avatar, homeDir);
  }
  return join(resolveWorkspaceAvatarNicknamesRoot(workspacePath, homeDir), normalizeAvatarNickname(avatar));
};

export const resolveWorkspaceAvatarCanonicalRoot = (
  workspacePath: string,
  principalId: string,
  homeDir = homedir(),
): string => {
  if (isGlobalWorkspacePath(workspacePath, homeDir)) {
    return resolveGlobalAvatarCanonicalRoot(principalId, homeDir);
  }
  return join(resolveWorkspacePrivateAvatarsRoot(workspacePath, homeDir), principalId.trim().toLowerCase());
};

export const resolveWorkspaceAvatarPrivateRoot = (
  workspacePath: string,
  avatar: string,
  homeDir = homedir(),
): string => {
  if (isGlobalWorkspacePath(workspacePath, homeDir)) {
    return resolveGlobalAvatarRoot(avatar, homeDir);
  }
  const aliasRoot = resolveWorkspaceAvatarAliasRoot(workspacePath, avatar, homeDir);
  if (existsSync(aliasRoot)) {
    return resolveAliasTargetOrSelf(aliasRoot);
  }
  return resolveWorkspaceAvatarCanonicalRoot(workspacePath, avatar, homeDir);
};

export const resolveWorkspaceAvatarAssetRoot = (
  workspacePath: string,
  avatar: string,
  kind: WorkspaceAssetKind,
  homeDir = homedir(),
): string => join(resolveWorkspaceAvatarPrivateRoot(workspacePath, avatar, homeDir), normalizeWorkspaceAssetKind(kind));

export const resolveWorkspaceAvatarSeatPath = (workspacePath: string, avatar: string, homeDir = homedir()): string =>
  join(resolveWorkspaceAvatarPrivateRoot(workspacePath, avatar, homeDir), "settings.local.json");

export const resolveWorkspaceToolCommandName = (fileName: string): string => {
  const stem = fileName.replace(/\.[^.]+$/, "");
  const normalized = stem
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized.length > 0 ? `tool_${normalized}` : "tool_command";
};

export const normalizeWorkspaceRuntimePath = (workspacePath: string, homeDir = homedir()): string =>
  toWorkspacePath(workspacePath, homeDir);
