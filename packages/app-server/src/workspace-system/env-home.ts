import { platform } from "node:os";
import { delimiter, join, posix, win32 } from "node:path";

export const AVATAR_HOME_ENV = "AVATAR_HOME";
export const SKILLS_HOME_ENV = "SKILLS_HOME";
export const ENV_HOME_CANONICAL_DELIMITER = ";";

const SKILL_HOME_RELATIVE_ROOTS = [
  ["skills"],
  [".codex", "skills"],
  [".claude", "skills"],
  [".agents", "skills"],
] as const;

type EnvHomePlatform = NodeJS.Platform;

const resolvePlatform = (value?: EnvHomePlatform): EnvHomePlatform => value ?? platform();

const splitEnvHome = (envValue: string, inputPlatform: EnvHomePlatform): string[] => {
  if (inputPlatform === "win32") {
    return envValue.split(ENV_HOME_CANONICAL_DELIMITER);
  }
  const delimiters = new Set([ENV_HOME_CANONICAL_DELIMITER, delimiter]);
  const segments: string[] = [];
  let current = "";
  for (const char of envValue) {
    if (delimiters.has(char)) {
      segments.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  segments.push(current);
  return segments;
};

const isAbsoluteForPlatform = (value: string, inputPlatform: EnvHomePlatform): boolean =>
  inputPlatform === "win32" ? win32.isAbsolute(value) : posix.isAbsolute(value);

const normalizeForPlatform = (value: string, inputPlatform: EnvHomePlatform): string =>
  inputPlatform === "win32" ? win32.normalize(value) : posix.normalize(value);

const dedupeLastWins = (paths: readonly string[]): string[] =>
  paths.filter((path, index) => paths.lastIndexOf(path) === index);

const parseEnvHomePathList = (
  envValue: string | undefined,
  input: {
    envName: string;
    platform?: EnvHomePlatform;
  },
): string[] => {
  if (!envValue) {
    return [];
  }
  const inputPlatform = resolvePlatform(input.platform);
  const normalized: string[] = [];
  for (const rawSegment of splitEnvHome(envValue, inputPlatform)) {
    const segment = rawSegment.trim();
    if (segment.length === 0) {
      continue;
    }
    if (!isAbsoluteForPlatform(segment, inputPlatform)) {
      throw new Error(`${input.envName} entry must be absolute: ${segment}`);
    }
    normalized.push(normalizeForPlatform(segment, inputPlatform));
  }
  return dedupeLastWins(normalized);
};

const serializeEnvHomePathList = (
  paths: readonly string[],
  input: {
    envName: string;
    platform?: EnvHomePlatform;
  },
): string => {
  const inputPlatform = resolvePlatform(input.platform);
  const normalized: string[] = [];
  for (const rawPath of paths) {
    const path = rawPath.trim();
    if (path.length === 0) {
      continue;
    }
    if (!isAbsoluteForPlatform(path, inputPlatform)) {
      throw new Error(`${input.envName} entry must be absolute: ${path}`);
    }
    normalized.push(normalizeForPlatform(path, inputPlatform));
  }
  return dedupeLastWins(normalized).join(ENV_HOME_CANONICAL_DELIMITER);
};

export const parseEnvAvatarHome = (
  envValue?: string,
  input: {
    platform?: EnvHomePlatform;
  } = {},
): string[] =>
  parseEnvHomePathList(envValue, {
    envName: AVATAR_HOME_ENV,
    platform: input.platform,
  });

export const serializeEnvAvatarHome = (
  paths: readonly string[],
  input: {
    platform?: EnvHomePlatform;
  } = {},
): string =>
  serializeEnvHomePathList(paths, {
    envName: AVATAR_HOME_ENV,
    platform: input.platform,
  });

export const parseEnvSkillsHome = (
  envValue?: string,
  input: {
    platform?: EnvHomePlatform;
  } = {},
): string[] =>
  parseEnvHomePathList(envValue, {
    envName: SKILLS_HOME_ENV,
    platform: input.platform,
  });

export interface WorkspaceSkillsHomeGroup {
  pwd: string;
  avatarHome: readonly string[];
}

const expandSkillHomeBaseRoot = (root: string): string[] =>
  SKILL_HOME_RELATIVE_ROOTS.map((segments) => join(root, ...segments));

export const deriveMultiWorkspaceSkillsHome = (
  input: {
    workspaceGroups: readonly WorkspaceSkillsHomeGroup[];
    platform?: EnvHomePlatform;
  },
): string[] => {
  const inputPlatform = resolvePlatform(input.platform);
  const roots: string[] = [];
  for (const group of input.workspaceGroups) {
    const pwd = group.pwd.trim();
    if (!isAbsoluteForPlatform(pwd, inputPlatform)) {
      throw new Error(`PWD entry must be absolute: ${group.pwd}`);
    }
    roots.push(...expandSkillHomeBaseRoot(normalizeForPlatform(pwd, inputPlatform)));
    for (const avatarHome of group.avatarHome) {
      const path = avatarHome.trim();
      if (!isAbsoluteForPlatform(path, inputPlatform)) {
        throw new Error(`${AVATAR_HOME_ENV} entry must be absolute: ${avatarHome}`);
      }
      roots.push(...expandSkillHomeBaseRoot(normalizeForPlatform(path, inputPlatform)));
    }
  }
  return dedupeLastWins(roots);
};

export const deriveEnvSkillsHome = (
  input: WorkspaceSkillsHomeGroup & {
    platform?: EnvHomePlatform;
  },
): string[] =>
  deriveMultiWorkspaceSkillsHome({
    workspaceGroups: [
      {
        pwd: input.pwd,
        avatarHome: input.avatarHome,
      },
    ],
    platform: input.platform,
  });

export const serializeEnvSkillsHome = (
  paths: readonly string[],
  input: {
    platform?: EnvHomePlatform;
  } = {},
): string =>
  serializeEnvHomePathList(paths, {
    envName: SKILLS_HOME_ENV,
    platform: input.platform,
  });
