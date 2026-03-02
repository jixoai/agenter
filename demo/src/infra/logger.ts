import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import type { DebugLogLine } from "../core/protocol";

const createId = (): string => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export class DebugLogger {
  private readonly ring: DebugLogLine[] = [];
  private readonly maxEntries: number;
  private readonly filePath: string;
  private listeners: Array<(log: DebugLogLine) => void> = [];

  constructor(logDir: string, maxEntries = 800) {
    this.maxEntries = maxEntries;
    mkdirSync(logDir, { recursive: true });
    const stamp = new Date().toISOString().replaceAll(":", "-");
    this.filePath = join(logDir, `demo-${stamp}.jsonl`);
  }

  getFilePath(): string {
    return this.filePath;
  }

  subscribe(listener: (log: DebugLogLine) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((it) => it !== listener);
    };
  }

  getRecent(limit = 200): DebugLogLine[] {
    if (limit >= this.ring.length) {
      return [...this.ring];
    }
    return this.ring.slice(this.ring.length - limit);
  }

  log(input: Omit<DebugLogLine, "id" | "timestamp">): DebugLogLine {
    const line: DebugLogLine = {
      id: createId(),
      timestamp: Date.now(),
      ...input,
    };

    this.ring.push(line);
    if (this.ring.length > this.maxEntries) {
      this.ring.shift();
    }

    appendFileSync(this.filePath, `${JSON.stringify(line)}\n`, "utf8");
    for (const listener of this.listeners) {
      listener(line);
    }

    return line;
  }
}
