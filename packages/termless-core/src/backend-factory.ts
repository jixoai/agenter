import { createRequire } from "node:module";

import { createXtermBackend } from "./termless-xtermjs.js";
import type { TerminalBackend } from "./termless-types.js";
import type { Cell } from "./termless-types.js";

export type TerminalBackendKind = "xterm" | "ghostty-native";

export const TERMINAL_BACKEND_KINDS = ["xterm", "ghostty-native"] as const satisfies readonly TerminalBackendKind[];
export const DEFAULT_TERMINAL_BACKEND = "xterm" as const satisfies TerminalBackendKind;

export interface CreateTerminalBackendInput {
  backend?: TerminalBackendKind;
  cols: number;
  rows: number;
  scrollbackLimit: number;
}

export interface RangeReadableTerminalBackend extends TerminalBackend {
  getLinesRange(startRow: number, rowCount: number): Cell[][];
  getViewportLines(): Cell[][];
}

export const isTerminalBackendKind = (value: unknown): value is TerminalBackendKind =>
  typeof value === "string" && TERMINAL_BACKEND_KINDS.includes(value as TerminalBackendKind);

export const assertTerminalBackendKind = (value: unknown): TerminalBackendKind => {
  if (!isTerminalBackendKind(value)) {
    throw new Error(`unsupported terminal backend: ${String(value)}`);
  }
  return value;
};

interface GhosttyNativeModule {
  createGhosttyNativeBackend(opts?: Partial<{ cols: number; rows: number; scrollbackLimit: number }>): TerminalBackend;
}

const require = createRequire(import.meta.url);

const loadGhosttyNativeModule = (): GhosttyNativeModule => {
  return require("@jixo/ghostty-native") as GhosttyNativeModule;
};

const createOfficialTerminalBackend = (
  backend: TerminalBackendKind,
  input: Omit<CreateTerminalBackendInput, "backend">,
): TerminalBackend => {
  try {
    if (backend === "xterm") {
      return createXtermBackend({
        cols: input.cols,
        rows: input.rows,
        scrollbackLimit: input.scrollbackLimit,
      });
    }
    return loadGhosttyNativeModule().createGhosttyNativeBackend({
      cols: input.cols,
      rows: input.rows,
      scrollbackLimit: input.scrollbackLimit,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`terminal backend unavailable: ${backend}: ${message}`);
  }
};

const withRangeReads = (backend: TerminalBackend): RangeReadableTerminalBackend => {
  const extended = backend as TerminalBackend & Partial<RangeReadableTerminalBackend>;
  if (typeof extended.getLinesRange !== "function") {
    extended.getLinesRange = (startRow: number, rowCount: number): Cell[][] => {
      const safeStart = Math.max(0, Math.trunc(startRow));
      const safeRows = Math.max(1, Math.trunc(rowCount));
      return Array.from({ length: safeRows }, (_, index) => backend.getLine(safeStart + index));
    };
  }
  if (typeof extended.getViewportLines !== "function") {
    extended.getViewportLines = (): Cell[][] => {
      const scrollback = backend.getScrollback();
      return extended.getLinesRange!(scrollback.viewportOffset, scrollback.screenLines);
    };
  }
  return extended as RangeReadableTerminalBackend;
};

export const createTerminalBackend = (input: CreateTerminalBackendInput): RangeReadableTerminalBackend => {
  const backend = input.backend ?? DEFAULT_TERMINAL_BACKEND;
  switch (backend) {
    case "xterm":
      return withRangeReads(createOfficialTerminalBackend(backend, input));
    case "ghostty-native":
      return withRangeReads(createOfficialTerminalBackend(backend, input));
    default:
      throw new Error(`unsupported terminal backend: ${backend satisfies never}`);
  }
};
