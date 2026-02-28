import { mkdirSync, readdirSync, readFileSync, renameSync } from "node:fs";
import { join } from "node:path";

interface InputInboxOptions {
  inputDir: string;
  pollMs?: number;
  onMixedInput: (input: string, sourceFile: string) => Promise<void>;
  onError?: (error: Error, sourceFile: string) => void;
}

const isInputFile = (name: string): boolean => name.endsWith(".xml") || name.endsWith(".txt");

export class InputInbox {
  private readonly pendingDir: string;
  private readonly doneDir: string;
  private readonly failedDir: string;
  private readonly pollMs: number;
  private timer: ReturnType<typeof setInterval> | null = null;
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
    this.timer = setInterval(() => {
      this.scan();
    }, this.pollMs);
    this.scan();
  }

  stop(): void {
    this.running = false;
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private scan(): void {
    if (!this.running) {
      return;
    }
    const files = readdirSync(this.pendingDir).filter(isInputFile).sort();
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
          const raw = readFileSync(src, "utf8");
          await this.options.onMixedInput(raw, name);
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
