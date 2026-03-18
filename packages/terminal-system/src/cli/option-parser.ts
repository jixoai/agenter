import type { TerminalColorMode, TerminalColorOption, TerminalGitLogMode, TerminalLogStyle } from "../types";
import { DEFAULTS } from "../types";

type SizeValue = number | "auto";

export interface ParsedSizeOption {
  rows: SizeValue;
  cols: SizeValue;
  normalized: `${string}:${string}`;
}

export interface ResolvedSizeOption {
  requested: ParsedSizeOption;
  rows: number;
  cols: number;
}

const parseSizePart = (raw: string, axis: "rows" | "cols"): SizeValue => {
  const value = raw.trim().toLowerCase();
  if (value.length === 0 || value === "auto") {
    return "auto";
  }
  if (!/^\d+$/.test(value)) {
    throw new Error(`Invalid --size ${axis}: "${raw}"`);
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid --size ${axis}: "${raw}"`);
  }
  return parsed;
};

export const parseSizeOption = (rawInput: string | undefined): ParsedSizeOption => {
  const raw = (rawInput ?? "auto").trim().toLowerCase();
  if (raw.length === 0 || raw === "auto") {
    return {
      rows: "auto",
      cols: "auto",
      normalized: "auto:auto",
    };
  }

  const colonCount = [...raw].filter((ch) => ch === ":").length;
  if (colonCount > 1) {
    throw new Error(`Invalid --size format: "${rawInput ?? ""}"`);
  }

  if (colonCount === 0) {
    const rows = parseSizePart(raw, "rows");
    return {
      rows,
      cols: "auto",
      normalized: `${rows}:auto`,
    };
  }

  const [rawRows = "", rawCols = ""] = raw.split(":");
  const rows = parseSizePart(rawRows, "rows");
  const cols = parseSizePart(rawCols, "cols");
  return {
    rows,
    cols,
    normalized: `${rows}:${cols}`,
  };
};

const resolveInheritedSize = (): { rows: number; cols: number } => ({
  rows: process.stdout.rows ?? DEFAULTS.rows,
  cols: process.stdout.columns ?? DEFAULTS.cols,
});

export const resolveSizeWithFallback = (
  requested: ParsedSizeOption,
  inherited: { rows: number; cols: number },
): ResolvedSizeOption => ({
  requested,
  rows: requested.rows === "auto" ? inherited.rows : requested.rows,
  cols: requested.cols === "auto" ? inherited.cols : requested.cols,
});

export const resolveSizeOption = (requested: ParsedSizeOption): ResolvedSizeOption => {
  const inherited = resolveInheritedSize();
  return resolveSizeWithFallback(requested, inherited);
};

const normalizeColorInput = (rawInput: string | undefined): string => (rawInput ?? "auto").trim().toLowerCase();

const inferColorMode = (value: string): TerminalColorMode | null => {
  if (value === "none" || value === "off" || value === "0" || value === "dumb") {
    return "none";
  }
  if (value === "16" || value === "ansi" || value === "basic" || value === "xterm") {
    return "16";
  }
  if (value === "256" || value.includes("256")) {
    return "256";
  }
  if (value === "truecolor" || value === "24bit" || value.includes("truecolor") || value.includes("24bit")) {
    return "truecolor";
  }
  return null;
};

const parseForceColor = (raw: string | undefined): number | null => {
  if (raw === undefined) {
    return null;
  }
  const value = raw.trim().toLowerCase();
  if (value === "true") {
    return 1;
  }
  if (value === "false") {
    return 0;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

export const detectInheritedColor = (): TerminalColorMode => {
  if (process.env.NO_COLOR !== undefined) {
    return "none";
  }

  const forced = parseForceColor(process.env.FORCE_COLOR);
  if (forced !== null) {
    if (forced <= 0) {
      return "none";
    }
    if (forced >= 3) {
      return "truecolor";
    }
    if (forced >= 2) {
      return "256";
    }
    return "16";
  }

  const colorTerm = process.env.COLORTERM?.toLowerCase() ?? "";
  if (colorTerm.includes("truecolor") || colorTerm.includes("24bit")) {
    return "truecolor";
  }

  const term = process.env.TERM?.toLowerCase() ?? "";
  if (term.includes("256color")) {
    return "256";
  }
  if (term === "dumb") {
    return "none";
  }
  if (term.length > 0) {
    return "16";
  }
  return "256";
};

export const parseColorOption = (rawInput: string | undefined): TerminalColorOption => {
  const normalized = normalizeColorInput(rawInput);
  if (normalized === "auto" || normalized.length === 0) {
    return "auto";
  }
  const inferred = inferColorMode(normalized);
  if (!inferred) {
    throw new Error(`Unsupported --color value: "${rawInput ?? ""}"`);
  }
  return inferred;
};

export const resolveColorOption = (requested: TerminalColorOption): TerminalColorMode =>
  requested === "auto" ? detectInheritedColor() : requested;

export const parseLogStyleOption = (rawInput: string | undefined, keepStyle: boolean | undefined): TerminalLogStyle => {
  const normalized = (rawInput ?? "").trim().toLowerCase();
  if (normalized.length > 0) {
    if (normalized === "rich") {
      return "rich";
    }
    if (normalized === "plain") {
      return "plain";
    }
    throw new Error(`Unsupported --log-style value: "${rawInput}"`);
  }
  if (keepStyle === undefined) {
    return "rich";
  }
  return keepStyle ? "rich" : "plain";
};

export const parseGitLogOption = (rawInput: string | undefined): TerminalGitLogMode => {
  if (rawInput === undefined) {
    return "none";
  }
  const normalized = rawInput.trim().toLowerCase();
  if (normalized.length === 0 || normalized === "true" || normalized === "on" || normalized === "yes") {
    return "normal";
  }
  if (normalized === "off" || normalized === "false" || normalized === "none" || normalized === "no") {
    return "none";
  }
  if (normalized === "normal" || normalized === "verbose" || normalized === "none") {
    return normalized;
  }
  throw new Error(`Unsupported --git-log value: "${rawInput}"`);
};
