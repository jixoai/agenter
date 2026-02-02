import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import { FactType, ObjectiveFact } from "./types";

export const nowMs = (): number => Date.now();

export const createId = (): string => randomUUID();

export const createFact = (
  type: FactType,
  content: string,
  metadata?: Record<string, unknown>
): ObjectiveFact => {
  return {
    id: createId(),
    timestamp: nowMs(),
    type,
    content,
    metadata,
  };
};

export const safeJsonParse = (text: string): unknown => {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
};

export const normalizeText = (text: string): string => {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
};

export const splitKeywords = (text: string): string[] => {
  return normalizeText(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length > 1);
};

export const loadEnvFile = async (filePath: string): Promise<void> => {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const index = trimmed.indexOf("=");
      if (index === -1) continue;
      const key = trimmed.slice(0, index).trim();
      const value = trimmed.slice(index + 1).trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // Ignore missing .env
  }
};

// 同步加载 .env 文件（用于测试）
export const loadEnv = (): void => {
  try {
    const fs = require("fs");
    const content = fs.readFileSync(".env", "utf-8");
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const index = trimmed.indexOf("=");
      if (index === -1) continue;
      const key = trimmed.slice(0, index).trim();
      const value = trimmed.slice(index + 1).trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // Ignore missing .env
  }
};

export const ensureDir = async (dirPath: string): Promise<void> => {
  await fs.mkdir(dirPath, { recursive: true });
};

export const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

export const extractAfterToken = (content: string, token: string): string | null => {
  const index = content.indexOf(token);
  if (index === -1) return null;
  const slice = content.slice(index + token.length);
  const lineBreak = slice.search(/\r?\n/);
  const line = lineBreak === -1 ? slice : slice.slice(0, lineBreak);
  return line.trim();
};

export const extractJsonAfterToken = <T>(
  content: string,
  token: string
): T | null => {
  const slice = extractAfterToken(content, token);
  if (!slice) return null;
  return safeJsonParse(slice) as T | null;
};
