import {
  closeSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";

const nowIso = (): string => new Date().toISOString();

const defaultPath = (): string => resolve(homedir(), ".agenter", "workspaces.yaml");

const parseYamlList = (text: string): string[] => {
  const lines = text.split(/\r?\n/);
  const items: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("- ")) {
      const value = trimmed.slice(2).trim();
      if (value.length > 0) {
        items.push(value);
      }
    }
  }
  return items;
};

const toYaml = (items: string[]): string => {
  const body = items.map((item) => `  - ${item}`).join("\n");
  return `updatedAt: ${nowIso()}\nworkspaces:\n${body}\n`;
};

const LOCK_RETRY_MS = 10;
const LOCK_TIMEOUT_MS = 2_000;
const STALE_LOCK_MS = 10_000;

const sleepSync = (ms: number): void => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    // busy wait for short lock retries
  }
};

const asSortedArray = (items: Set<string>): string[] => [...items].sort((a, b) => a.localeCompare(b));

export interface WorkspacesStoreOptions {
  filePath?: string;
}

export class WorkspacesStore {
  private readonly filePath: string;
  private readonly byPath = new Set<string>();

  constructor(options: WorkspacesStoreOptions = {}) {
    this.filePath = options.filePath ?? defaultPath();
    this.load();
  }

  getFilePath(): string {
    return this.filePath;
  }

  list(): string[] {
    return asSortedArray(this.byPath);
  }

  add(workspacePath: string): void {
    const normalized = resolve(workspacePath);
    this.withFileLock(() => {
      const merged = this.readFromDisk();
      const beforeSize = merged.size;
      for (const path of this.byPath) {
        merged.add(path);
      }
      merged.add(normalized);

      this.byPath.clear();
      for (const path of merged) {
        this.byPath.add(path);
      }

      if (merged.size === beforeSize) {
        return;
      }
      this.flushAtomic(asSortedArray(merged));
    });
  }

  private load(): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    const loaded = this.readFromDisk();
    this.byPath.clear();
    for (const path of loaded) {
      this.byPath.add(path);
    }
    if (loaded.size === 0) {
      this.flushAtomic([]);
    }
  }

  private readFromDisk(): Set<string> {
    const result = new Set<string>();
    try {
      const text = readFileSync(this.filePath, "utf8");
      for (const path of parseYamlList(text)) {
        result.add(resolve(path));
      }
      return result;
    } catch {
      return result;
    }
  }

  private flushAtomic(items: string[]): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    const tempPath = `${this.filePath}.tmp-${process.pid}-${Date.now()}`;
    writeFileSync(tempPath, toYaml(items), "utf8");
    renameSync(tempPath, this.filePath);
  }

  private withFileLock<T>(run: () => T): T {
    const lockPath = `${this.filePath}.lock`;
    mkdirSync(dirname(this.filePath), { recursive: true });
    const start = Date.now();

    while (true) {
      try {
        const fd = openSync(lockPath, "wx");
        closeSync(fd);
        break;
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code !== "EEXIST") {
          throw error;
        }
        this.cleanupStaleLock(lockPath);
        if (Date.now() - start > LOCK_TIMEOUT_MS) {
          throw new Error(`workspaces lock timeout: ${lockPath}`);
        }
        sleepSync(LOCK_RETRY_MS);
      }
    }

    try {
      return run();
    } finally {
      try {
        unlinkSync(lockPath);
      } catch {
        // best effort unlock
      }
    }
  }

  private cleanupStaleLock(lockPath: string): void {
    try {
      const stat = statSync(lockPath);
      if (Date.now() - stat.mtimeMs > STALE_LOCK_MS) {
        unlinkSync(lockPath);
      }
    } catch {
      // lock already gone
    }
  }
}
