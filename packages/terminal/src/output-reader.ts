import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface ReadTerminalOutputOptions {
  outputDir: string;
  /** Tail-based offset. 0 starts from latest tail line. */
  offset?: number;
  /** Tail window size. -1 means no limit. */
  limit?: number;
}

interface OutputFileSegment {
  name: string;
  preFile: string | null;
  bodyLines: string[];
}

const HEADER_COMMENT = /^\s*<!--[\s\S]*?-->/;
const META_BLOCK = /^\s*meta:\s*([\s\S]*?)^\s*ati-source:/m;
const META_PRE_FILE = /^\s*pre-file:\s*(.+)\s*$/m;

const parseQuotedValue = (raw: string): string => {
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
};

const normalizePreFile = (raw: string | null): string | null => {
  if (!raw) {
    return null;
  }
  const value = parseQuotedValue(raw);
  if (value.length === 0 || value === "none") {
    return null;
  }
  return value;
};

const parseBodyLines = (raw: string): string[] => {
  const body = raw.replace(HEADER_COMMENT, "").replace(/^\r?\n/, "");
  const lines = body.split("\n");
  if (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }
  return lines;
};

const parsePreFile = (raw: string): string | null => {
  const metaMatch = META_BLOCK.exec(raw);
  if (!metaMatch) {
    return null;
  }
  const preMatch = META_PRE_FILE.exec(metaMatch[1] ?? "");
  if (!preMatch) {
    return null;
  }
  return normalizePreFile(preMatch[1] ?? null);
};

const readOutputFile = (outputDir: string, fileName: string): OutputFileSegment | null => {
  const path = join(outputDir, fileName);
  if (!existsSync(path)) {
    return null;
  }
  const raw = readFileSync(path, "utf8");
  return {
    name: fileName,
    preFile: parsePreFile(raw),
    bodyLines: parseBodyLines(raw),
  };
};

const validateWindow = (offset: number, limit: number): void => {
  if (!Number.isInteger(offset) || offset < 0) {
    throw new Error(`Invalid offset: ${offset}. Expected integer >= 0.`);
  }
  if (!Number.isInteger(limit)) {
    throw new Error(`Invalid limit: ${limit}. Expected integer.`);
  }
  if (limit < -1) {
    throw new Error(`Invalid limit: ${limit}. Expected -1 or integer >= 0.`);
  }
};

const collectAllBodyLines = (outputDir: string): string[] => {
  const visited = new Set<string>();
  const chain: OutputFileSegment[] = [];
  let current = "latest.log.html";

  while (current) {
    if (visited.has(current)) {
      break;
    }
    visited.add(current);
    const segment = readOutputFile(outputDir, current);
    if (!segment) {
      break;
    }
    chain.push(segment);
    current = segment.preFile ?? "";
  }

  const ordered = chain.reverse();
  return ordered.flatMap((segment) => segment.bodyLines);
};

const applyTailWindow = (allLines: string[], offset: number, limit: number): string[] => {
  if (limit === 0 || allLines.length === 0) {
    return [];
  }

  const end = Math.max(0, allLines.length - offset);
  if (end <= 0) {
    return [];
  }

  if (limit === -1) {
    return allLines.slice(0, end);
  }

  const start = Math.max(0, end - limit);
  return allLines.slice(start, end);
};

const resolveWindowOptions = (options: ReadTerminalOutputOptions): { offset: number; limit: number } => {
  const offset = options.offset ?? 0;
  const limit = options.limit ?? -1;
  validateWindow(offset, limit);
  return { offset, limit };
};

export const readTerminalOutputLines = (options: ReadTerminalOutputOptions): string[] => {
  const { offset, limit } = resolveWindowOptions(options);
  const allLines = collectAllBodyLines(options.outputDir);
  return applyTailWindow(allLines, offset, limit);
};

export const streamTerminalOutput = (options: ReadTerminalOutputOptions): ReadableStream<string> => {
  const lines = readTerminalOutputLines(options);
  return new ReadableStream<string>({
    start(controller) {
      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index] ?? "";
        const suffix = index < lines.length - 1 ? "\n" : "";
        controller.enqueue(`${line}${suffix}`);
      }
      controller.close();
    },
  });
};

export const readTerminalOutput = async (options: ReadTerminalOutputOptions): Promise<string> => {
  const stream = streamTerminalOutput(options);
  const reader = stream.getReader();
  const chunks: string[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    if (value !== undefined) {
      chunks.push(value);
    }
  }

  return chunks.join("");
};
