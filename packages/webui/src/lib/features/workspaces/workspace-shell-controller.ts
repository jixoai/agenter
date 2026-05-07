import { resolveWorkspaceShellPromptFolderName, type WorkspaceShellSurface } from "./workspace-shell-contract";

const CLEAR_LINE = "\r\u001b[2K";
const CLEAR_SCREEN = "\u001b[2J\u001b[H";
const CRLF = "\r\n";
const MAX_HISTORY = 50;
const ANSI = {
  brightBlue: "\u001b[94m",
  cyan: "\u001b[36m",
  dim: "\u001b[2m",
  red: "\u001b[31m",
  reset: "\u001b[0m",
} as const;
const ESCAPE_SEQUENCES = [
  "\u001b[A",
  "\u001b[B",
  "\u001b[C",
  "\u001b[D",
  "\u001bOA",
  "\u001bOB",
  "\u001bOC",
  "\u001bOD",
] as const;

export interface WorkspaceShellExecResult {
  cwd: string;
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface WorkspaceShellTerminalAdapter {
  focus(): void;
  write(data: string): void;
}

export interface WorkspaceShellControllerOptions {
  exec: (input: { command: string; cwd?: string; surface: WorkspaceShellSurface }) => Promise<WorkspaceShellExecResult>;
  initialCommand?: string | null;
  initialCwd?: string | null;
  onCwdChange?: (cwd: string) => void;
  onRunningChange?: (running: boolean) => void;
  promptLabel: string;
  surface: WorkspaceShellSurface;
  terminal: WorkspaceShellTerminalAdapter;
}

const normalizeTranscript = (value: string): string => value.replace(/\r?\n/g, CRLF);

const ensureTrailingNewline = (value: string): string =>
  value.length === 0 ? value : value.endsWith(CRLF) ? value : `${value}${CRLF}`;

const colorize = (value: string, color: string): string =>
  value.length === 0 ? value : `${color}${value}${ANSI.reset}`;

export class WorkspaceShellController {
  private readonly exec;
  private readonly onCwdChange;
  private readonly onRunningChange;
  private readonly promptLabel;
  private readonly surface;
  private readonly terminal;
  private readonly initialCommand;
  private currentCwd: string;
  private currentInput = "";
  private cursorIndex = 0;
  private history: string[] = [];
  private historyCursor: number | null = null;
  private historyDraft: string | null = null;
  private escapeBuffer = "";
  private disposed = false;
  private running = false;

  constructor(options: WorkspaceShellControllerOptions) {
    this.exec = options.exec;
    this.onCwdChange = options.onCwdChange;
    this.onRunningChange = options.onRunningChange;
    this.promptLabel = options.promptLabel;
    this.surface = options.surface;
    this.terminal = options.terminal;
    this.initialCommand = options.initialCommand?.trim().length ? options.initialCommand : null;
    this.currentCwd = options.initialCwd?.trim() ?? "";
  }

  async start(): Promise<void> {
    if (this.disposed) {
      return;
    }
    this.notifyCwdChange();
    this.redrawInput();
    if (this.initialCommand) {
      this.currentInput = this.initialCommand;
      this.cursorIndex = this.currentInput.length;
      this.redrawInput();
      await this.runCurrentInput();
      return;
    }
    this.terminal.focus();
  }

  dispose(): void {
    this.disposed = true;
  }

  handleData(data: string): void {
    if (this.disposed || data.length === 0) {
      return;
    }
    if (this.running) {
      return;
    }
    let remaining = `${this.escapeBuffer}${data}`;
    this.escapeBuffer = "";
    while (remaining.length > 0) {
      const matchedEscape = ESCAPE_SEQUENCES.find((sequence) => remaining.startsWith(sequence));
      if (matchedEscape) {
        this.handleEscapeSequence(matchedEscape);
        remaining = remaining.slice(matchedEscape.length);
        continue;
      }
      if (remaining.startsWith("\u001b") && ESCAPE_SEQUENCES.some((sequence) => sequence.startsWith(remaining))) {
        this.escapeBuffer = remaining;
        return;
      }
      const [character] = Array.from(remaining);
      if (!character) {
        return;
      }
      this.handleCharacter(character);
      remaining = remaining.slice(character.length);
    }
  }

  private handleEscapeSequence(sequence: (typeof ESCAPE_SEQUENCES)[number]): void {
    if (sequence === "\u001b[A" || sequence === "\u001bOA") {
      this.recallHistory("up");
      return;
    }
    if (sequence === "\u001b[B" || sequence === "\u001bOB") {
      this.recallHistory("down");
      return;
    }
    if (sequence === "\u001b[C" || sequence === "\u001bOC") {
      this.cursorIndex = Math.min(this.currentInput.length, this.cursorIndex + 1);
      this.redrawInput();
      return;
    }
    if (sequence === "\u001b[D" || sequence === "\u001bOD") {
      this.cursorIndex = Math.max(0, this.cursorIndex - 1);
      this.redrawInput();
    }
  }

  private handleCharacter(character: string): void {
    if (character === "\r") {
      void this.runCurrentInput();
      return;
    }
    if (character === "\u007f" || character === "\b") {
      if (this.cursorIndex === 0) {
        return;
      }
      this.currentInput = this.currentInput.slice(0, this.cursorIndex - 1) + this.currentInput.slice(this.cursorIndex);
      this.cursorIndex -= 1;
      this.historyCursor = null;
      this.historyDraft = null;
      this.redrawInput();
      return;
    }
    if (character === "\u0003") {
      this.terminal.write("^C");
      this.currentInput = "";
      this.cursorIndex = 0;
      this.historyCursor = null;
      this.historyDraft = null;
      this.terminal.write(CRLF);
      this.redrawInput();
      return;
    }
    if (character === "\u000c") {
      this.terminal.write(CLEAR_SCREEN);
      this.redrawInput();
      return;
    }
    if (character < " ") {
      return;
    }
    this.currentInput =
      this.currentInput.slice(0, this.cursorIndex) + character + this.currentInput.slice(this.cursorIndex);
    this.cursorIndex += character.length;
    this.historyCursor = null;
    this.historyDraft = null;
    this.redrawInput();
  }

  private recallHistory(direction: "up" | "down"): void {
    if (this.history.length === 0) {
      return;
    }
    if (direction === "up") {
      const nextCursor = this.historyCursor === null ? this.history.length - 1 : Math.max(0, this.historyCursor - 1);
      this.historyDraft = this.historyCursor === null ? this.currentInput : this.historyDraft;
      this.historyCursor = nextCursor;
      this.currentInput = this.history[nextCursor] ?? this.currentInput;
      this.cursorIndex = this.currentInput.length;
      this.redrawInput();
      return;
    }
    if (this.historyCursor === null) {
      return;
    }
    const nextCursor = this.historyCursor + 1;
    if (nextCursor >= this.history.length) {
      this.historyCursor = null;
      this.currentInput = this.historyDraft ?? "";
      this.historyDraft = null;
      this.cursorIndex = this.currentInput.length;
      this.redrawInput();
      return;
    }
    this.historyCursor = nextCursor;
    this.currentInput = this.history[nextCursor] ?? this.currentInput;
    this.cursorIndex = this.currentInput.length;
    this.redrawInput();
  }

  private rememberHistory(command: string): void {
    if (command.length === 0) {
      return;
    }
    if (this.history[this.history.length - 1] !== command) {
      this.history = [...this.history, command].slice(-MAX_HISTORY);
    }
    this.historyCursor = null;
    this.historyDraft = null;
  }

  private setRunning(nextRunning: boolean): void {
    this.running = nextRunning;
    this.onRunningChange?.(nextRunning);
  }

  private notifyCwdChange(): void {
    this.onCwdChange?.(this.currentCwd);
  }

  private getPromptText(): string {
    const folderName = resolveWorkspaceShellPromptFolderName(this.currentCwd);
    return [
      ANSI.reset,
      ANSI.cyan,
      this.promptLabel,
      ANSI.reset,
      ":",
      ANSI.brightBlue,
      folderName,
      ANSI.reset,
      ANSI.dim,
      "$",
      ANSI.reset,
      " ",
    ].join("");
  }

  private redrawInput(): void {
    this.terminal.write(`${CLEAR_LINE}${this.getPromptText()}${this.currentInput}`);
    const trailingChars = this.currentInput.length - this.cursorIndex;
    if (trailingChars > 0) {
      this.terminal.write(`\u001b[${trailingChars}D`);
    }
  }

  private async runCurrentInput(): Promise<void> {
    if (this.running) {
      return;
    }
    const command = this.currentInput.trim();
    this.terminal.write(CRLF);
    if (command.length === 0) {
      this.currentInput = "";
      this.cursorIndex = 0;
      this.redrawInput();
      return;
    }
    this.rememberHistory(command);
    const workingCwd = this.currentCwd || undefined;
    this.currentInput = "";
    this.cursorIndex = 0;
    this.setRunning(true);
    try {
      const result = await this.exec({
        command,
        cwd: workingCwd,
        surface: this.surface,
      });
      if (this.disposed) {
        return;
      }
      if (result.stdout.length > 0) {
        this.terminal.write(ensureTrailingNewline(normalizeTranscript(result.stdout)));
      }
      if (result.stderr.length > 0) {
        this.terminal.write(colorize(ensureTrailingNewline(normalizeTranscript(result.stderr)), ANSI.red));
      }
      if (result.exitCode !== 0) {
        this.terminal.write(colorize(`[exit ${result.exitCode}]`, ANSI.red) + CRLF);
      }
      this.currentCwd = result.cwd.trim().length > 0 ? result.cwd : this.currentCwd;
      this.notifyCwdChange();
    } catch (error) {
      if (this.disposed) {
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      this.terminal.write(colorize(message, ANSI.red) + CRLF + colorize("[exit 1]", ANSI.red) + CRLF);
    } finally {
      if (this.disposed) {
        return;
      }
      this.setRunning(false);
      this.redrawInput();
      this.terminal.focus();
    }
  }
}
