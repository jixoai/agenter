import { existsSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

import type { AgenterAvatarInit, AvatarPromptPaths, AvatarSource, ResolveAvatarInput, ResolvedAvatar } from "./types";

const sanitizeNickname = (value: string): string => {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-");
  return normalized.length > 0 ? normalized : "default";
};

export const normalizeAvatarNickname = (value: string): string => sanitizeNickname(value);

export const defaultAvatarNickname = (): string => {
  return "default";
};

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

export const resolveGlobalAvatarsRoot = (homeDir = homedir()): string =>
  join(homeDir, ".agenter", "avatars", "by-principal");

export const resolveGlobalAvatarNicknamesRoot = (homeDir = homedir()): string =>
  join(homeDir, ".agenter", "avatars", "by-nickname");

export const resolveGlobalAvatarCanonicalRoot = (principalId: string, homeDir = homedir()): string =>
  join(resolveGlobalAvatarsRoot(homeDir), principalId.trim().toLowerCase());

export const resolveGlobalAvatarAliasRoot = (nickname: string, homeDir = homedir()): string =>
  join(resolveGlobalAvatarNicknamesRoot(homeDir), sanitizeNickname(nickname));

export const resolveGlobalAvatarRoot = (nickname: string, homeDir = homedir()): string =>
  resolveAliasTargetOrSelf(resolveGlobalAvatarAliasRoot(nickname, homeDir));

const dedupeSources = (sources: AvatarSource[]): AvatarSource[] => {
  const map = new Map<string, AvatarSource>();
  for (const source of sources) {
    if (!source.name.trim() || !source.path.trim()) {
      continue;
    }
    map.set(source.name, { name: source.name, path: resolve(source.path) });
  }
  return [...map.values()];
};

export const resolveAvatarSources = (input: ResolveAvatarInput): ResolvedAvatar => {
  const nickname = sanitizeNickname(input.nickname ?? defaultAvatarNickname());
  const homeDir = input.homeDir || homedir();
  return {
    nickname,
    sources: dedupeSources([
      {
        name: "user",
        path: resolveGlobalAvatarRoot(nickname, homeDir),
      },
    ]),
  };
};

const pickExisting = (sources: AvatarSource[], fileName: string): string | undefined => {
  let matched: string | undefined;
  for (const source of sources) {
    const next = join(source.path, fileName);
    if (existsSync(next)) {
      matched = next;
    }
  }
  return matched;
};

export const resolveAvatarPromptPaths = (avatar: ResolvedAvatar): AvatarPromptPaths => {
  return {
    AGENTER: pickExisting(avatar.sources, "AGENTER.mdx"),
    AGENTER_SYSTEM: pickExisting(avatar.sources, "AGENTER_SYSTEM.mdx"),
    SYSTEM_TEMPLATE: pickExisting(avatar.sources, "SYSTEM_TEMPLATE.mdx"),
    RESPONSE_CONTRACT: pickExisting(avatar.sources, "RESPONSE_CONTRACT.mdx"),
  };
};

export const resolveAvatarIconCandidates = (avatar: ResolvedAvatar): string[] => {
  const fileNames = ["icon.webp", "icon.png", "icon.jpg", "icon.jpeg", "icon.svg"];
  const candidates: string[] = [];
  for (const source of avatar.sources) {
    for (const fileName of fileNames) {
      const next = join(source.path, fileName);
      if (existsSync(next)) {
        candidates.push(next);
      }
    }
  }
  return candidates;
};

export class AgenterAvatar {
  readonly nickname: string;
  readonly sources: AvatarSource[];

  constructor(init: AgenterAvatarInit) {
    this.nickname = sanitizeNickname(init.nickname);
    this.sources = dedupeSources(init.sources);
  }

  resolvePromptPaths(): AvatarPromptPaths {
    return resolveAvatarPromptPaths({
      nickname: this.nickname,
      sources: this.sources,
    });
  }
}
