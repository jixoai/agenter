import { platform } from "node:os";
import { delimiter, posix, win32 } from "node:path";

export const NOTE_AVATAR_HOME_ENV = "AVATAR_HOME";
export const NOTE_ENV_HOME_CANONICAL_DELIMITER = ";";

type EnvHomePlatform = NodeJS.Platform;

const resolvePlatform = (value?: EnvHomePlatform): EnvHomePlatform => value ?? platform();

const splitEnvHome = (envValue: string, inputPlatform: EnvHomePlatform): string[] => {
  if (inputPlatform === "win32") {
    return envValue.split(NOTE_ENV_HOME_CANONICAL_DELIMITER);
  }
  const delimiters = new Set([NOTE_ENV_HOME_CANONICAL_DELIMITER, delimiter]);
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

export const parseNoteAvatarHomeEnv = (
  envValue?: string,
  input: {
    platform?: EnvHomePlatform;
  } = {},
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
      throw new Error(`${NOTE_AVATAR_HOME_ENV} entry must be absolute: ${segment}`);
    }
    normalized.push(normalizeForPlatform(segment, inputPlatform));
  }
  return dedupeLastWins(normalized);
};

export const serializeNoteAvatarHomeEnv = (
  paths: readonly string[],
  input: {
    platform?: EnvHomePlatform;
  } = {},
): string => {
  const inputPlatform = resolvePlatform(input.platform);
  const normalized: string[] = [];
  for (const rawPath of paths) {
    const path = rawPath.trim();
    if (path.length === 0) {
      continue;
    }
    if (!isAbsoluteForPlatform(path, inputPlatform)) {
      throw new Error(`${NOTE_AVATAR_HOME_ENV} entry must be absolute: ${path}`);
    }
    normalized.push(normalizeForPlatform(path, inputPlatform));
  }
  return dedupeLastWins(normalized).join(NOTE_ENV_HOME_CANONICAL_DELIMITER);
};
