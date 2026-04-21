import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const splitEnvLine = (line: string): [key: string, value: string] | null => {
  const trimmed = line.trim();
  if (trimmed.length === 0 || trimmed.startsWith("#")) {
    return null;
  }
  const separatorIndex = trimmed.indexOf("=");
  if (separatorIndex <= 0) {
    return null;
  }
  const key = trimmed.slice(0, separatorIndex).trim();
  const value = trimmed.slice(separatorIndex + 1).trim();
  return key.length > 0 ? [key, value] : null;
};

const parseEnvFile = (content: string): Map<string, string> => {
  const entries = new Map<string, string>();
  for (const line of content.split(/\r?\n/u)) {
    const parsed = splitEnvLine(line);
    if (!parsed) {
      continue;
    }
    entries.set(parsed[0], parsed[1]);
  }
  return entries;
};

const serializeEnvFile = (entries: Map<string, string>): string =>
  `${[...entries.entries()]
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n")}\n`;

export const resolveLocalEnvPath = (homeDir: string): string => join(homeDir, ".agenter", "local.env");

export const readLocalEnvValue = (homeDir: string, key: string): string | null => {
  const filePath = resolveLocalEnvPath(homeDir);
  if (!existsSync(filePath)) {
    return null;
  }
  return parseEnvFile(readFileSync(filePath, "utf8")).get(key) ?? null;
};

export const writeLocalEnvValue = (homeDir: string, key: string, value: string): string => {
  const filePath = resolveLocalEnvPath(homeDir);
  mkdirSync(join(homeDir, ".agenter"), { recursive: true });
  const entries = existsSync(filePath) ? parseEnvFile(readFileSync(filePath, "utf8")) : new Map<string, string>();
  entries.set(key, value.trim());
  writeFileSync(filePath, serializeEnvFile(entries), "utf8");
  return filePath;
};
