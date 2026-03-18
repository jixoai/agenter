import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import type { TerminalGitLogMode, TerminalStatus } from "./types";

type GitLogEvent = "write" | "archive" | "resize-seal" | "resize-snapshot" | "status-idle";

export interface GitLogCommitInput {
  event: GitLogEvent;
  file: string;
  status: TerminalStatus;
  rows: number;
  cols: number;
  cursorRow: number;
  cursorCol: number;
  preFile: string | null;
  nextFile?: string | null;
}

const decodeText = (data: ArrayBufferLike | ArrayBufferView | null | undefined): string => {
  if (!data) {
    return "";
  }
  return new TextDecoder().decode(data).trim();
};

interface GitCommandResult {
  ok: boolean;
  code: number;
  stdout: string;
  stderr: string;
}

export class TerminalGitLogger {
  private readonly debugPath: string;
  private queue: Promise<void> = Promise.resolve();
  private ready = false;
  private readonly env: Record<string, string>;

  constructor(
    private readonly workspace: string,
    private readonly mode: Exclude<TerminalGitLogMode, "none">,
  ) {
    const debugDir = join(workspace, "debug");
    mkdirSync(debugDir, { recursive: true });
    this.debugPath = join(debugDir, "git-log.ndjson");
    this.env = {
      ...Object.fromEntries(
        Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
      ),
      GIT_AUTHOR_NAME: process.env.GIT_AUTHOR_NAME ?? "ati",
      GIT_AUTHOR_EMAIL: process.env.GIT_AUTHOR_EMAIL ?? "ati@local",
      GIT_COMMITTER_NAME: process.env.GIT_COMMITTER_NAME ?? "ati",
      GIT_COMMITTER_EMAIL: process.env.GIT_COMMITTER_EMAIL ?? "ati@local",
    };
  }

  getMode(): Exclude<TerminalGitLogMode, "none"> {
    return this.mode;
  }

  init(): void {
    if (this.ready) {
      return;
    }
    this.queue = this.queue.then(async () => {
      const gitDir = join(this.workspace, ".git");
      if (!existsSync(gitDir)) {
        const initResult = this.runGit(["init", "-q"]);
        this.logDebug("git.init", {
          ok: initResult.ok,
          code: initResult.code,
          stderr: initResult.stderr,
        });
        if (!initResult.ok) {
          return;
        }
      } else {
        this.logDebug("git.init.skip", { reason: "exists" });
      }
      this.ready = true;
    });
  }

  commit(input: GitLogCommitInput): void {
    this.queue = this.queue.then(async () => {
      if (!this.ready) {
        this.logDebug("git.commit.skip", { reason: "not-ready", event: input.event });
        return;
      }
      const addResult = this.runGit(["add", "-A"]);
      if (!addResult.ok) {
        this.logDebug("git.add.error", {
          event: input.event,
          code: addResult.code,
          stderr: addResult.stderr,
        });
        return;
      }
      const subject = `ati(log): ${input.event} ${this.mode}`;
      const body = [
        `workspace=${this.workspace}`,
        `event=${input.event}`,
        `mode=${this.mode}`,
        `file=${input.file}`,
        `status=${input.status}`,
        `size=${input.rows}x${input.cols}`,
        `cursor=${input.cursorRow},${input.cursorCol}`,
        `pre=${input.preFile ?? "none"}`,
        `next=${input.nextFile ?? "none"}`,
        `ts=${new Date().toISOString()}`,
      ].join("\n");
      const commitResult = this.runGit(["commit", "--allow-empty", "-m", subject, "-m", body]);
      this.logDebug("git.commit", {
        ok: commitResult.ok,
        event: input.event,
        mode: this.mode,
        code: commitResult.code,
        stderr: commitResult.stderr,
      });
    });
  }

  async flush(): Promise<void> {
    await this.queue;
  }

  private runGit(args: string[]): GitCommandResult {
    try {
      const result = Bun.spawnSync({
        cmd: ["git", "-C", this.workspace, ...args],
        env: this.env,
        stderr: "pipe",
        stdout: "pipe",
      });
      return {
        ok: result.exitCode === 0,
        code: result.exitCode,
        stdout: decodeText(result.stdout),
        stderr: decodeText(result.stderr),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logDebug("git.exec.error", {
        args: args.join(" "),
        error: message,
      });
      return {
        ok: false,
        code: -1,
        stdout: "",
        stderr: message,
      };
    }
  }

  private logDebug(event: string, meta: Record<string, unknown>): void {
    try {
      appendFileSync(
        this.debugPath,
        `${JSON.stringify({
          ts: new Date().toISOString(),
          source: "git-log",
          event,
          ...meta,
        })}\n`,
        "utf8",
      );
    } catch {
      // ignore debug write failures
    }
  }
}
