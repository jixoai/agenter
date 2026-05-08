import "./xterm-headless-runtime.js";

import { createXtermBackend as createOfficialXtermBackend } from "@termless/xtermjs";

import type { TerminalBackend } from "./termless-types.js";

export type OfficialXtermBackend = TerminalBackend;

export const createXtermBackend = (...args: Parameters<typeof createOfficialXtermBackend>): OfficialXtermBackend =>
  createOfficialXtermBackend(...args);
