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
export type TerminalGitLogMode = "none" | "normal" | "verbose";
export type TerminalGitLogOption = TerminalGitLogMode;

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

export interface StructuredRenderResult {
  /** Styled lines rendered from xterm cells (absolute scrollback) */
  richLines: RichLine[];
  /** Absolute row of cursor in scrollback */
  cursorAbsRow: number;
  /** Column of cursor */
  cursorCol: number;
  /** Whether hardware cursor should be shown */
  cursorVisible: boolean;
  /** Current terminal rows */
  rows: number;
  /** Current terminal cols */
  cols: number;
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

export interface TerminalStructuredSnapshot extends StructuredRenderResult {
  /** Monotonic render sequence */
  seq: number;
  /** Unix epoch milliseconds */
  timestamp: number;
  /** Runtime terminal status */
  status: TerminalStatus;
}

export interface TerminalDirtyMarkResult {
  ok: boolean;
  hash: string | null;
  reason?: string;
}

export interface TerminalDirtySliceResult {
  ok: boolean;
  changed: boolean;
  fromHash: string | null;
  toHash: string | null;
  diff: string;
  bytes: number;
  reason?: string;
}

export interface TerminalDirtySliceOptions {
  remark?: boolean;
  wait?: boolean;
  timeoutMs?: number;
  pollMs?: number;
}

export interface TerminalPendingInputOptions {
  extension?: "xml" | "txt";
  wait?: boolean;
  timeoutMs?: number;
  pollMs?: number;
}

export interface TerminalPendingInputResult {
  ok: boolean;
  id: string;
  file: string;
  doneFile?: string;
  failedFile?: string;
  reason?: string;
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
