import { closeSync, mkdirSync, openSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";

const nowIso = (): string => new Date().toISOString();
const defaultPath = (): string => resolve(homedir(), ".agenter", "workspaces.yaml");

const LOCK_RETRY_MS = 10;
const LOCK_TIMEOUT_MS = 2_000;
const STALE_LOCK_MS = 10_000;
const CURRENT_VERSION = 2;

type ArrayKey = "workspaces" | "favoriteWorkspaces" | "favoriteSessions";

interface WorkspacesDocument {
  version: number;
  updatedAt: string;
  workspaces: string[];
  favoriteWorkspaces: string[];
  favoriteSessions: string[];
}

export interface WorkspaceEntry {
  path: string;
  favorite: boolean;
}

const sleepSync = (ms: number): void => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    // busy wait for short lock retries
  }
};

const parseYamlScalar = (value: string): string => {
  const text = value.trim();
  if (text.length === 0) {
    return "";
  }
  if (text.startsWith('"') || text.startsWith("'")) {
    try {
      return JSON.parse(text);
    } catch {
      return text.slice(1, -1);
    }
  }
  return text;
};

const emptyDocument = (): WorkspacesDocument => ({
  version: CURRENT_VERSION,
  updatedAt: nowIso(),
  workspaces: [],
  favoriteWorkspaces: [],
  favoriteSessions: [],
});

const LEGACY_WORKSPACE_PATH_ASSIGNMENT = /(?:^|\/)path:\s*["']([^"']+)["']$/;

const repairWorkspacePath = (value: string): string => {
  const trimmed = value.trim();
  const match = trimmed.match(/^path:\s*["']([^"']+)["']$/) ?? trimmed.match(LEGACY_WORKSPACE_PATH_ASSIGNMENT);
  return match?.[1] ?? trimmed;
};

const normalizeWorkspacePath = (value: string): string => resolve(repairWorkspacePath(value));

const dedupe = (items: string[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    if (seen.has(item)) {
      continue;
    }
    seen.add(item);
    result.push(item);
  }
  return result;
};

const normalizeDocument = (input: Partial<WorkspacesDocument>): WorkspacesDocument => {
  const workspaces = dedupe((input.workspaces ?? []).map((item) => normalizeWorkspacePath(item)));
  const favoriteWorkspaces = dedupe(
    (input.favoriteWorkspaces ?? [])
      .map((item) => normalizeWorkspacePath(item))
      .filter((item) => workspaces.includes(item)),
  );
  const favoriteSessions = dedupe((input.favoriteSessions ?? []).map((item) => item.trim()).filter(Boolean));

  return {
    version: CURRENT_VERSION,
    updatedAt: input.updatedAt ?? nowIso(),
    workspaces,
    favoriteWorkspaces,
    favoriteSessions,
  };
};

const parseWorkspaceYaml = (text: string): WorkspacesDocument => {
  const draft: Partial<WorkspacesDocument> = {};
  let currentKey: ArrayKey | null = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) {
      continue;
    }
    if (trimmed.startsWith("version:")) {
      continue;
    }
    if (trimmed.startsWith("updatedAt:")) {
      draft.updatedAt = parseYamlScalar(trimmed.slice("updatedAt:".length));
      continue;
    }
    if (trimmed === "workspaces:") {
      currentKey = "workspaces";
      draft.workspaces = draft.workspaces ?? [];
      continue;
    }
    if (trimmed === "favoriteWorkspaces:") {
      currentKey = "favoriteWorkspaces";
      draft.favoriteWorkspaces = draft.favoriteWorkspaces ?? [];
      continue;
    }
    if (trimmed === "favoriteSessions:") {
      currentKey = "favoriteSessions";
      draft.favoriteSessions = draft.favoriteSessions ?? [];
      continue;
    }
    if (trimmed.startsWith("- ") && currentKey) {
      const value = parseYamlScalar(trimmed.slice(2));
      const target = draft[currentKey] ?? [];
      target.push(value);
      draft[currentKey] = target;
      continue;
    }
    currentKey = null;
  }

  return normalizeDocument(draft);
};

const toYaml = (doc: WorkspacesDocument): string => {
  const lines = [
    `version: ${CURRENT_VERSION}`,
    `updatedAt: ${nowIso()}`,
    "workspaces:",
    ...doc.workspaces.map((item) => `  - ${JSON.stringify(item)}`),
    "favoriteWorkspaces:",
    ...doc.favoriteWorkspaces.map((item) => `  - ${JSON.stringify(item)}`),
    "favoriteSessions:",
    ...doc.favoriteSessions.map((item) => `  - ${JSON.stringify(item)}`),
    "",
  ];

  return lines.join("\n");
};

export interface WorkspacesStoreOptions {
  filePath?: string;
}

export class WorkspacesStore {
  private readonly filePath: string;
  private doc: WorkspacesDocument;

  constructor(options: WorkspacesStoreOptions = {}) {
    this.filePath = options.filePath ?? defaultPath();
    this.doc = emptyDocument();
    this.load();
  }

  getFilePath(): string {
    return this.filePath;
  }

  list(): string[] {
    return [...this.doc.workspaces];
  }

  listRecent(limit = 8): string[] {
    const safeLimit = Math.max(1, Math.min(Math.floor(limit), 128));
    return this.doc.workspaces.slice(0, safeLimit);
  }

  listEntries(): WorkspaceEntry[] {
    const favorites = new Set(this.doc.favoriteWorkspaces);
    return this.doc.workspaces.map((path) => ({
      path,
      favorite: favorites.has(path),
    }));
  }

  favoriteSessionIds(): string[] {
    return [...this.doc.favoriteSessions];
  }

  isSessionFavorite(sessionId: string): boolean {
    return this.doc.favoriteSessions.includes(sessionId);
  }

  add(workspacePath: string): WorkspaceEntry {
    const normalized = normalizeWorkspacePath(workspacePath);
    return this.withFileLock(() => {
      const doc = this.readFromDisk();
      const nextWorkspaces = [normalized, ...doc.workspaces.filter((item) => item !== normalized)];
      const next = normalizeDocument({
        ...doc,
        updatedAt: nowIso(),
        workspaces: nextWorkspaces,
      });
      this.replace(next);
      this.flushAtomic(next);
      return {
        path: normalized,
        favorite: next.favoriteWorkspaces.includes(normalized),
      };
    });
  }

  toggleWorkspaceFavorite(workspacePath: string): WorkspaceEntry {
    const normalized = normalizeWorkspacePath(workspacePath);
    return this.withFileLock(() => {
      const doc = this.readFromDisk();
      const favorites = doc.favoriteWorkspaces.includes(normalized)
        ? doc.favoriteWorkspaces.filter((item) => item !== normalized)
        : [...doc.favoriteWorkspaces, normalized];
      const next = normalizeDocument({
        ...doc,
        updatedAt: nowIso(),
        workspaces: doc.workspaces.includes(normalized) ? doc.workspaces : [normalized, ...doc.workspaces],
        favoriteWorkspaces: favorites,
      });
      this.replace(next);
      this.flushAtomic(next);
      return {
        path: normalized,
        favorite: next.favoriteWorkspaces.includes(normalized),
      };
    });
  }

  toggleSessionFavorite(sessionId: string): { sessionId: string; favorite: boolean } {
    const normalized = sessionId.trim();
    if (normalized.length === 0) {
      throw new Error("sessionId is required");
    }
    return this.withFileLock(() => {
      const doc = this.readFromDisk();
      const favorites = doc.favoriteSessions.includes(normalized)
        ? doc.favoriteSessions.filter((item) => item !== normalized)
        : [...doc.favoriteSessions, normalized];
      const next = normalizeDocument({
        ...doc,
        updatedAt: nowIso(),
        favoriteSessions: favorites,
      });
      this.replace(next);
      this.flushAtomic(next);
      return {
        sessionId: normalized,
        favorite: next.favoriteSessions.includes(normalized),
      };
    });
  }

  removeSessionFavorite(sessionId: string): boolean {
    const normalized = sessionId.trim();
    if (normalized.length === 0) {
      return false;
    }
    return this.withFileLock(() => {
      const doc = this.readFromDisk();
      if (!doc.favoriteSessions.includes(normalized)) {
        this.replace(doc);
        return false;
      }
      const next = normalizeDocument({
        ...doc,
        updatedAt: nowIso(),
        favoriteSessions: doc.favoriteSessions.filter((item) => item !== normalized),
      });
      this.replace(next);
      this.flushAtomic(next);
      return true;
    });
  }

  remove(workspacePath: string): boolean {
    const normalized = normalizeWorkspacePath(workspacePath);
    return this.withFileLock(() => {
      const doc = this.readFromDisk();
      if (!doc.workspaces.includes(normalized)) {
        this.replace(doc);
        return false;
      }
      const next = normalizeDocument({
        ...doc,
        updatedAt: nowIso(),
        workspaces: doc.workspaces.filter((item) => item !== normalized),
        favoriteWorkspaces: doc.favoriteWorkspaces.filter((item) => item !== normalized),
      });
      this.replace(next);
      this.flushAtomic(next);
      return true;
    });
  }

  private load(): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    const loaded = this.readFromDisk();
    this.replace(loaded);
    this.flushAtomic(this.doc);
  }

  private readFromDisk(): WorkspacesDocument {
    try {
      return parseWorkspaceYaml(readFileSync(this.filePath, "utf8"));
    } catch {
      return emptyDocument();
    }
  }

  private replace(next: WorkspacesDocument): void {
    this.doc = normalizeDocument(next);
  }

  private flushAtomic(doc: WorkspacesDocument): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    const tempPath = `${this.filePath}.tmp-${process.pid}-${Date.now()}`;
    writeFileSync(tempPath, toYaml(doc), "utf8");
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
