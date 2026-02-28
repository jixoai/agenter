export interface TerminalProfile {
  debounceMs?: number;
  throttleMs?: number;
  maxLinesPerFile?: number;
  cols?: number;
  rows?: number;
  color?: TerminalColorMode;
  logStyle?: TerminalLogStyle;
  /** Workspace root directory. New sessions create `{pid}-{timestamp}` under this directory. */
  outputRoot?: string;
  /** Resume by explicit workspace path. */
  workspacePath?: string;
  /** Resume by process pid: find `{outputRoot}/{pid}-*` workspace. */
  resumePid?: number;
  /** Optional working directory for spawned process. */
  cwd?: string;
  /** Enable persistent cursor diagnostics log for experiments. */
  debugCursor?: boolean;
  /** Enable workspace git history logs (`normal` keyframes, `verbose` every write). */
  gitLog?: false | TerminalGitLogMode;
}

export type TerminalStatus = "IDLE" | "BUSY";

export type TerminalColorMode = "none" | "16" | "256" | "truecolor";
export type TerminalColorOption = TerminalColorMode | "auto";
export type TerminalLogStyle = "rich" | "plain";
export type TerminalLogStyleOption = TerminalLogStyle | "auto";
export type TerminalGitLogMode = "normal" | "verbose";
export type TerminalGitLogOption = TerminalGitLogMode | "off";

export interface RichSpan {
  text: string;
  fg?: string;
  bg?: string;
  bold?: boolean;
  underline?: boolean;
  inverse?: boolean;
}

export interface RichLine {
  spans: RichSpan[];
}

export interface RenderResult {
  /** Semantic HTML lines (absolute scrollback, trimEnd applied) */
  lines: string[];
  /** Plain text lines (without semantic tags) */
  plainLines: string[];
  /** Styled lines rendered from xterm cells */
  richLines: RichLine[];
  /** Absolute row of cursor in scrollback */
  cursorAbsRow: number;
  /** Column of cursor */
  cursorCol: number;
  /** Whether hardware cursor should be shown */
  cursorVisible: boolean;
}

export interface PageMeta {
  status: TerminalStatus;
  cursorRow: number;
  cursorCol: number;
  preFile: string | null;
  viewportBase: number;
  logStyle: TerminalLogStyle;
  rows?: number;
  cols?: number;
}

export const DEFAULTS = {
  debounceMs: 200,
  throttleMs: 5000,
  maxLinesPerFile: 200,
  cols: 120,
  rows: 30,
  scrollback: 10000,
  idleTimeoutMs: 2000,
} as const;
