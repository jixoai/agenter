import { normalizeAvatarNickname } from "@agenter/avatar";

import { AVATAR_CLASSIFY_VALUES, type AvatarClassify, type AvatarPrincipalMetadata } from "./types";

const avatarClassifySet = new Set<string>(AVATAR_CLASSIFY_VALUES);
const builtInAvatarProfiles = {
  default: {
    classify: "assistant",
    displayName: "Default",
  },
  assistant: {
    classify: "assistant",
    displayName: "Assistant",
  },
  backend: {
    classify: "backend",
    displayName: "Backend",
  },
  architect: {
    classify: "frontend",
    displayName: "Architect",
  },
  design: {
    classify: "design",
    displayName: "Design",
  },
  frontend: {
    classify: "frontend",
    displayName: "Frontend",
  },
  ops: {
    classify: "ops",
    displayName: "Ops",
  },
  reviewer: {
    classify: "reviewer",
    displayName: "Reviewer",
  },
} as const satisfies Record<string, { classify: AvatarClassify | null; displayName: string }>;
type BuiltInAvatarNickname = keyof typeof builtInAvatarProfiles;

const readTrimmedString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const resolveAvatarOwnerKey = (nickname: string): string => normalizeAvatarNickname(nickname);

export const normalizeAvatarClassify = (value: unknown): AvatarClassify | null => {
  const normalized = readTrimmedString(value)?.toLowerCase();
  if (!normalized || !avatarClassifySet.has(normalized)) {
    return null;
  }
  return normalized as AvatarClassify;
};

export const formatAvatarDisplayName = (nickname: string): string => {
  const normalized = normalizeAvatarNickname(nickname);
  const title = normalized
    .split(/[-_]+/u)
    .filter((segment) => segment.length > 0)
    .map((segment) => `${segment.slice(0, 1).toUpperCase()}${segment.slice(1)}`)
    .join(" ");
  return title.length > 0 ? title : "Default";
};

export const resolveBuiltInAvatarProfile = (
  nickname: string,
): { nickname: string; displayName: string; classify: AvatarClassify | null } | null => {
  const normalized = normalizeAvatarNickname(nickname);
  const profile = builtInAvatarProfiles[normalized as BuiltInAvatarNickname];
  if (!profile) {
    return null;
  }
  return {
    nickname: normalized,
    displayName: profile.displayName,
    classify: profile.classify,
  };
};

export const normalizeAvatarPrincipalMetadata = (input: {
  nickname: string;
  displayName?: unknown;
  classify?: unknown;
}): AvatarPrincipalMetadata => {
  return {
    nickname: normalizeAvatarNickname(input.nickname),
    displayName: readTrimmedString(input.displayName),
    classify: normalizeAvatarClassify(input.classify),
  };
};

export const canonicalizeAvatarPrincipalMetadata = (input: {
  nickname: string;
  displayName?: unknown;
  classify?: unknown;
}): AvatarPrincipalMetadata => {
  const normalized = normalizeAvatarPrincipalMetadata(input);
  const builtIn = resolveBuiltInAvatarProfile(normalized.nickname);
  if (!builtIn) {
    return normalized;
  }
  return {
    nickname: builtIn.nickname,
    displayName: builtIn.displayName,
    classify: builtIn.classify,
  };
};

export const readAvatarPrincipalMetadata = (value: unknown): AvatarPrincipalMetadata | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const nickname = readTrimmedString((value as Record<string, unknown>).nickname);
  if (!nickname) {
    return null;
  }
  return normalizeAvatarPrincipalMetadata({
    nickname,
    displayName: (value as Record<string, unknown>).displayName,
    classify: (value as Record<string, unknown>).classify,
  });
};
