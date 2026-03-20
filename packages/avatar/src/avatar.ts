import { existsSync } from "node:fs";
import { homedir, userInfo } from "node:os";
import { join, resolve } from "node:path";

import type { AgenterAvatarInit, AvatarPromptPaths, AvatarSource, ResolveAvatarInput, ResolvedAvatar } from "./types";

const sanitizeNickname = (value: string): string => {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-");
  return normalized.length > 0 ? normalized : "agenter-bot";
};

export const normalizeAvatarNickname = (value: string): string => sanitizeNickname(value);

export const defaultAvatarNickname = (): string => {
  const envUser = process.env.USER ?? process.env.LOGNAME ?? process.env.USERNAME;
  const systemUser = envUser && envUser.trim().length > 0 ? envUser : userInfo().username;
  return `${sanitizeNickname(systemUser)}-bot`;
};

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
        path: join(homeDir, ".agenter", "avatar", nickname),
      },
      {
        name: "project",
        path: join(resolve(input.projectRoot), ".agenter", "avatar", nickname),
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

export const resolveAvatarLayerSettingsPath = (sourceSettingsFilePath: string, nickname: string): string => {
  const baseDir = resolve(sourceSettingsFilePath, "..");
  return join(baseDir, "avatar", sanitizeNickname(nickname), "settings.json");
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
