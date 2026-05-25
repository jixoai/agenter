import { assertTmuxSuccess, defaultTmuxExecutor } from "./executor";
import {
  paneListFormat,
  parseTmuxPaneList,
  parseTmuxSessionList,
  sessionListFormat,
  stripSingleTrailingNewline,
  toShellCommand,
} from "./format";
import type {
  TmuxBindKeyInput,
  TmuxClientOptions,
  TmuxCommand,
  TmuxClosePopupInput,
  TmuxDisplayPopupInput,
  TmuxExecResult,
  TmuxMovePaneInput,
  TmuxNewSessionInput,
  TmuxPane,
  TmuxSession,
  TmuxSplitDirection,
  TmuxSplitPaneInput,
} from "./types";

export class TmuxClient {
  readonly #executable: string;
  readonly #socketName: string | undefined;
  readonly #env: Record<string, string | undefined> | undefined;
  readonly #executor;

  constructor(options: TmuxClientOptions = {}) {
    this.#executable = options.executable?.trim() || "tmux";
    this.#socketName = options.socketName?.trim() || undefined;
    this.#env = options.env;
    this.#executor = options.executor ?? defaultTmuxExecutor;
  }

  buildCommand(args: readonly string[]): TmuxCommand {
    return {
      executable: this.#executable,
      args: this.#socketName ? ["-L", this.#socketName, ...args] : [...args],
    };
  }

  async exec(args: readonly string[], options: { allowFailure?: boolean } = {}): Promise<TmuxExecResult> {
    const command = this.buildCommand(args);
    const result = await this.#executor.exec(command, { env: this.#env });
    if (!options.allowFailure) {
      assertTmuxSuccess(command, result);
    }
    return result;
  }

  async capture(args: readonly string[], options: { allowFailure?: boolean } = {}): Promise<string> {
    const result = await this.exec(args, options);
    return stripSingleTrailingNewline(result.stdout);
  }

  async assertAvailable(): Promise<void> {
    const resolved = this.#executor.which ? await this.#executor.which(this.#executable) : this.#executable;
    if (!resolved) {
      throw new Error(`tmux executable not found: ${this.#executable}`);
    }
  }

  async hasSession(sessionName: string): Promise<boolean> {
    const result = await this.exec(["has-session", "-t", sessionName], { allowFailure: true });
    return result.exitCode === 0;
  }

  async listSessions(): Promise<TmuxSession[]> {
    const stdout = await this.capture(["list-sessions", "-F", sessionListFormat]);
    return parseTmuxSessionList(stdout);
  }

  async newSession(input: TmuxNewSessionInput): Promise<void> {
    const command = toShellCommand(input.command);
    await this.exec([
      "new-session",
      ...(input.detached ? ["-d"] : []),
      "-s",
      input.sessionName,
      ...(input.cwd ? ["-c", input.cwd] : []),
      ...(command ? [command] : []),
    ]);
  }

  async killSession(sessionName: string): Promise<void> {
    await this.exec(["kill-session", "-t", sessionName]);
  }

  async getOption(input: { target?: string; name: string; global?: boolean }): Promise<string | null> {
    const result = await this.exec(
      ["show-options", "-qv", ...(input.global ? ["-g"] : []), ...(input.target ? ["-t", input.target] : []), input.name],
      { allowFailure: true },
    );
    if (result.exitCode !== 0) {
      return null;
    }
    return stripSingleTrailingNewline(result.stdout);
  }

  async setOption(input: { target?: string; name: string; value: string; global?: boolean }): Promise<void> {
    await this.exec([
      "set-option",
      ...(input.global ? ["-g"] : []),
      ...(input.target ? ["-t", input.target] : []),
      input.name,
      input.value,
    ]);
  }

  async listPanes(input: { target?: string; all?: boolean } = {}): Promise<TmuxPane[]> {
    const stdout = await this.capture([
      "list-panes",
      ...(input.all ? ["-a"] : []),
      ...(input.target ? ["-t", input.target] : []),
      "-F",
      paneListFormat,
    ]);
    return parseTmuxPaneList(stdout);
  }

  async selectPane(target: string): Promise<void> {
    await this.exec(["select-pane", "-t", target]);
  }

  async killPane(target: string): Promise<void> {
    await this.exec(["kill-pane", "-t", target]);
  }

  async splitPane(input: TmuxSplitPaneInput = {}): Promise<string> {
    const args = [
      "split-window",
      "-P",
      "-F",
      "#{pane_id}",
      ...buildSplitDirectionArgs(input.direction),
      ...(input.detached ? ["-d"] : []),
      ...(input.cwd ? ["-c", input.cwd] : []),
      ...(input.size ? ["-l", input.size] : []),
      ...(input.target ? ["-t", input.target] : []),
      ...shellCommandTail(input.command),
    ];
    return (await this.capture(args)).trim();
  }

  async movePane(input: TmuxMovePaneInput): Promise<void> {
    await this.exec([
      "move-pane",
      ...(input.detached ? ["-d"] : []),
      ...buildSplitDirectionArgs(input.direction),
      "-s",
      input.source,
      "-t",
      input.target,
      ...(input.size ? ["-l", input.size] : []),
    ]);
  }

  async displayPopup(input: TmuxDisplayPopupInput = {}): Promise<void> {
    await this.exec([
      "display-popup",
      ...(input.targetClient ? ["-c", input.targetClient] : []),
      ...(input.target ? ["-t", input.target] : []),
      ...(input.closeOnExit ? ["-E"] : []),
      ...(input.width ? ["-w", input.width] : []),
      ...(input.height ? ["-h", input.height] : []),
      ...(input.title ? ["-T", input.title] : []),
      ...shellCommandTail(input.command),
    ]);
  }

  async closePopup(input: TmuxClosePopupInput = {}): Promise<void> {
    await this.exec(["display-popup", ...(input.targetClient ? ["-c", input.targetClient] : []), "-C"]);
  }

  async displayMessage(message: string, input: { target?: string } = {}): Promise<void> {
    await this.exec(["display-message", ...(input.target ? ["-t", input.target] : []), message]);
  }

  async refreshClient(): Promise<void> {
    await this.exec(["refresh-client", "-S"]);
  }

  async bindKey(input: TmuxBindKeyInput): Promise<void> {
    await this.exec(["bind-key", ...(input.table ? ["-T", input.table] : []), input.key, ...input.tmuxCommand]);
  }
}

const shellCommandTail = (command: string | readonly string[] | undefined): string[] => {
  const shellCommand = toShellCommand(command);
  return shellCommand ? [shellCommand] : [];
};

const buildSplitDirectionArgs = (direction: TmuxSplitDirection | undefined): string[] => {
  if (direction === "left") {
    return ["-h", "-b"];
  }
  if (direction === "right") {
    return ["-h"];
  }
  if (direction === "above") {
    return ["-v", "-b"];
  }
  if (direction === "below") {
    return ["-v"];
  }
  return [];
};
