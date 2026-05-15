import { mkdirSync, readdirSync, readFileSync, renameSync, watch, type FSWatcher } from "node:fs";
import { join } from "node:path";

import type { TerminalPendingInputMode } from "./types";

interface InputInboxOptions {
  inputDir: string;
  pollMs?: number;
  onInput: (input: string, sourceFile: string, mode: TerminalPendingInputMode) => Promise<void>;
  onError?: (error: Error, sourceFile: string) => void;
}

const resolvePendingInputMode = (name: string): TerminalPendingInputMode | null => {
  if (name.endsWith(".mixed.txt")) {
    return "mixed";
  }
  if (name.endsWith(".raw.txt")) {
    return "raw";
  }
  return null;
};

const isInputFile = (name: string): boolean => resolvePendingInputMode(name) !== null;

export class InputInbox {
  private readonly pendingDir: string;
  private readonly doneDir: string;
  private readonly failedDir: string;
  private readonly pollMs: number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private watcher: FSWatcher | null = null;
  private scanScheduled = false;
  private running = false;
  private queue = Promise.resolve();
  private readonly inQueue = new Set<string>();

  constructor(private readonly options: InputInboxOptions) {
    this.pendingDir = join(options.inputDir, "pending");
    this.doneDir = join(options.inputDir, "done");
    this.failedDir = join(options.inputDir, "failed");
    this.pollMs = options.pollMs ?? 120;

    mkdirSync(this.pendingDir, { recursive: true });
    mkdirSync(this.doneDir, { recursive: true });
    mkdirSync(this.failedDir, { recursive: true });
  }

  start(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    try {
      this.watcher = watch(this.pendingDir, () => {
        this.scheduleScan();
      });
    } catch {
      this.watcher = null;
    }
    this.timer = setInterval(() => {
      this.scheduleScan();
    }, Math.max(this.pollMs, 2_000));
    this.scheduleScan();
  }

  poke(): void {
    this.scheduleScan();
  }

  stop(): void {
    this.running = false;
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.watcher?.close();
    this.watcher = null;
    this.scanScheduled = false;
  }

  private scheduleScan(): void {
    if (!this.running || this.scanScheduled) {
      return;
    }
    this.scanScheduled = true;
    setTimeout(() => {
      this.scanScheduled = false;
      this.scan();
    }, 0);
  }

  private scan(): void {
    if (!this.running) {
      return;
    }
    const files = (() => {
      try {
        return readdirSync(this.pendingDir).filter(isInputFile).sort();
      } catch (cause) {
        const error = cause as NodeJS.ErrnoException;
        if (error?.code === "ENOENT") {
          return [];
        }
        throw cause;
      }
    })();
    if (files.length === 0) {
      return;
    }

    for (const name of files) {
      if (this.inQueue.has(name)) {
        continue;
      }
      this.inQueue.add(name);
      const src = join(this.pendingDir, name);
      this.queue = this.queue.then(async () => {
        try {
          const mode = resolvePendingInputMode(name);
          if (!mode) {
            throw new Error(`unsupported pending input suffix: ${name}`);
          }
          const raw = readFileSync(src, "utf8");
          await this.options.onInput(raw, name, mode);
          renameSync(src, join(this.doneDir, `${name}.done`));
        } catch (cause) {
          const error = cause instanceof Error ? cause : new Error(String(cause));
          this.options.onError?.(error, name);
          try {
            renameSync(src, join(this.failedDir, `${name}.failed`));
          } catch {
            // ignore move errors
          }
        } finally {
          this.inQueue.delete(name);
        }
      });
    }
  }
}
