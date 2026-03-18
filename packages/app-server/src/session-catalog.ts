import { existsSync, mkdirSync, readdirSync, renameSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { readSessionDocument, writeSessionDocument, type PersistedSessionStorageState } from "./session-doc";

export type SessionStatus = "stopped" | "starting" | "running" | "error";
export type SessionStorageState = PersistedSessionStorageState;

const isoNow = (): string => new Date().toISOString();
const createId = (): string => crypto.randomUUID();

const toUtcBucket = (isoLike: string): [string, string, string] => {
  const value = new Date(isoLike);
  const date = Number.isNaN(value.valueOf()) ? new Date() : value;
  const year = String(date.getUTCFullYear()).padStart(4, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return [year, month, day];
};

const scanBucketedSessionRoots = (baseDir: string): string[] => {
  const roots: string[] = [];
  try {
    for (const year of readdirSync(baseDir, { withFileTypes: true })) {
      if (!year.isDirectory()) {
        continue;
      }
      const yearDir = join(baseDir, year.name);
      for (const month of readdirSync(yearDir, { withFileTypes: true })) {
        if (!month.isDirectory()) {
          continue;
        }
        const monthDir = join(yearDir, month.name);
        for (const day of readdirSync(monthDir, { withFileTypes: true })) {
          if (!day.isDirectory()) {
            continue;
          }
          const dayDir = join(monthDir, day.name);
          for (const session of readdirSync(dayDir, { withFileTypes: true })) {
            if (session.isDirectory()) {
              roots.push(join(dayDir, session.name));
            }
          }
        }
      }
    }
  } catch {
    return roots;
  }
  return roots;
};

export interface SessionMeta {
  id: string;
  name: string;
  cwd: string;
  avatar: string;
  createdAt: string;
  updatedAt: string;
  status: SessionStatus;
  storageState: SessionStorageState;
  lastError?: string;
  archivedAt?: string;
  archivedFrom?: string;
  sessionRoot: string;
  storeTarget: "global" | "workspace";
}

const normalizePersistedStatus = (status: SessionStatus | undefined): SessionStatus => {
  if (status === "running" || status === "starting") {
    return "stopped";
  }
  return status ?? "stopped";
};

export interface SessionCatalogOptions {
  globalRoot?: string;
  archiveRoot?: string;
}

export class SessionCatalog {
  private readonly byId = new Map<string, SessionMeta>();
  private readonly globalRoot: string;
  private readonly archiveRoot: string;

  constructor(options: SessionCatalogOptions = {}) {
    this.globalRoot = options.globalRoot ?? join(homedir(), ".agenter", "sessions");
    this.archiveRoot = options.archiveRoot ?? join(homedir(), ".agenter", "archive", "sessions");
  }

  getGlobalRoot(): string {
    return this.globalRoot;
  }

  getArchiveRoot(): string {
    return this.archiveRoot;
  }

  list(): SessionMeta[] {
    return [...this.byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  get(sessionId: string): SessionMeta | undefined {
    return this.byId.get(sessionId);
  }

  create(input: { name?: string; cwd: string; avatar: string; storeTarget: "global" | "workspace" }): SessionMeta {
    const id = createId();
    const createdAt = isoNow();
    const cwd = resolve(input.cwd);
    const session: SessionMeta = {
      id,
      name: input.name?.trim().length ? input.name.trim() : this.deriveName(cwd),
      cwd,
      avatar: input.avatar,
      createdAt,
      updatedAt: createdAt,
      status: "stopped",
      storageState: "active",
      sessionRoot: this.resolveActiveSessionRoot({
        id,
        cwd,
        avatar: input.avatar,
        createdAt,
        storeTarget: input.storeTarget,
      }),
      storeTarget: input.storeTarget,
    };
    mkdirSync(session.sessionRoot, { recursive: true });
    this.persistMeta(session);
    this.byId.set(id, session);
    return session;
  }

  update(
    sessionId: string,
    patch: {
      name?: string;
      status?: SessionStatus;
      lastError?: string;
    },
  ): SessionMeta {
    const current = this.byId.get(sessionId);
    if (!current) {
      throw new Error(`session not found: ${sessionId}`);
    }
    const next: SessionMeta = {
      ...current,
      name: patch.name?.trim().length ? patch.name.trim() : current.name,
      status: patch.status ?? current.status,
      lastError: patch.lastError,
      updatedAt: isoNow(),
    };
    this.persistMeta(next);
    this.byId.set(sessionId, next);
    return next;
  }

  archive(sessionId: string): SessionMeta {
    const current = this.byId.get(sessionId);
    if (!current) {
      throw new Error(`session not found: ${sessionId}`);
    }
    if (current.storageState === "archived") {
      return current;
    }

    const archivedAt = isoNow();
    const nextRoot = this.resolveArchiveSessionRoot(current.id, archivedAt);
    mkdirSync(dirname(nextRoot), { recursive: true });
    renameSync(current.sessionRoot, nextRoot);
    const next: SessionMeta = {
      ...current,
      status: "stopped",
      storageState: "archived",
      updatedAt: archivedAt,
      archivedAt,
      archivedFrom: current.sessionRoot,
      sessionRoot: nextRoot,
    };
    this.persistMeta(next);
    this.byId.set(sessionId, next);
    return next;
  }

  restore(sessionId: string): SessionMeta {
    const current = this.byId.get(sessionId);
    if (!current) {
      throw new Error(`session not found: ${sessionId}`);
    }
    if (current.storageState !== "archived") {
      return current;
    }

    const nextRoot = this.resolveActiveSessionRoot(current);
    mkdirSync(dirname(nextRoot), { recursive: true });
    renameSync(current.sessionRoot, nextRoot);
    const restoredAt = isoNow();
    const next: SessionMeta = {
      ...current,
      status: "stopped",
      storageState: "active",
      updatedAt: restoredAt,
      archivedAt: undefined,
      archivedFrom: undefined,
      sessionRoot: nextRoot,
    };
    this.persistMeta(next);
    this.byId.set(sessionId, next);
    return next;
  }

  remove(sessionId: string): boolean {
    const current = this.byId.get(sessionId);
    if (current) {
      rmSync(current.sessionRoot, { recursive: true, force: true });
    }
    return this.byId.delete(sessionId);
  }

  refresh(workspaces: string[]): void {
    const workspaceSet = new Set(workspaces.map((item) => resolve(item)));
    const discovered = new Map<string, SessionMeta>();

    for (const sessionRoot of this.scanGlobalSessionRoots()) {
      const parsed = this.readSessionMeta(sessionRoot, "global");
      if (parsed) {
        discovered.set(parsed.id, parsed);
      }
    }

    for (const sessionRoot of this.scanArchiveSessionRoots()) {
      const parsed = this.readSessionMeta(sessionRoot, "archive");
      if (!parsed) {
        continue;
      }
      if (parsed.storeTarget === "workspace" && !workspaceSet.has(parsed.cwd)) {
        continue;
      }
      discovered.set(parsed.id, parsed);
    }

    for (const workspace of workspaceSet) {
      for (const sessionRoot of this.scanWorkspaceSessionRoots(workspace)) {
        const parsed = this.readSessionMeta(sessionRoot, "workspace");
        if (parsed) {
          discovered.set(parsed.id, parsed);
        }
      }
    }

    const next = new Map<string, SessionMeta>();
    for (const meta of discovered.values()) {
      const current = this.byId.get(meta.id);
      next.set(meta.id, current?.status === "running" || current?.status === "starting" ? { ...meta, status: current.status } : meta);
    }

    for (const current of this.byId.values()) {
      if ((current.status === "running" || current.status === "starting") && !next.has(current.id)) {
        next.set(current.id, current);
      }
    }

    this.byId.clear();
    for (const [sessionId, meta] of next.entries()) {
      this.byId.set(sessionId, meta);
    }
  }

  private scanGlobalSessionRoots(): string[] {
    return scanBucketedSessionRoots(this.globalRoot);
  }

  private scanArchiveSessionRoots(): string[] {
    return scanBucketedSessionRoots(this.archiveRoot);
  }

  private scanWorkspaceSessionRoots(workspacePath: string): string[] {
    const avatarRoot = join(workspacePath, ".agenter", "avatar");
    try {
      const roots: string[] = [];
      const avatars = readdirSync(avatarRoot, { withFileTypes: true });
      for (const avatar of avatars) {
        if (!avatar.isDirectory()) {
          continue;
        }
        roots.push(...scanBucketedSessionRoots(join(avatarRoot, avatar.name, "sessions")));
      }
      return roots;
    } catch {
      return [];
    }
  }

  private readSessionMeta(sessionRoot: string, target: "global" | "workspace" | "archive"): SessionMeta | undefined {
    const doc = readSessionDocument(join(sessionRoot, "session.json"));
    const session = doc?.session;
    if (!session?.id) {
      return undefined;
    }

    const cwd = session.cwd ? resolve(session.cwd) : ".";
    const createdAt = session.createdAt ?? isoNow();
    const storageState = session.storageState ?? (target === "archive" ? "archived" : "active");

    return {
      id: session.id,
      name: session.name ?? this.deriveName(cwd),
      cwd,
      avatar: session.avatar ?? "agenter-bot",
      createdAt,
      updatedAt: session.updatedAt ?? createdAt,
      status: normalizePersistedStatus(session.status as SessionStatus | undefined),
      storageState,
      lastError: session.lastError,
      archivedAt: session.archivedAt,
      archivedFrom: session.archivedFrom,
      sessionRoot,
      storeTarget: (session.storeTarget as "global" | "workspace" | undefined) ?? (target === "global" ? "global" : "workspace"),
    };
  }

  private persistMeta(meta: SessionMeta): void {
    const filePath = join(meta.sessionRoot, "session.json");
    const existing = readSessionDocument(filePath);
    writeSessionDocument(filePath, {
      session: {
        ...existing?.session,
        id: meta.id,
        name: meta.name,
        cwd: meta.cwd,
        avatar: meta.avatar,
        storeTarget: meta.storeTarget,
        status: meta.status,
        createdAt: meta.createdAt,
        updatedAt: meta.updatedAt,
        storageState: meta.storageState,
        lastError: meta.lastError,
        archivedAt: meta.archivedAt,
        archivedFrom: meta.archivedFrom,
      },
      calls: existing?.calls ?? [],
    });
  }

  private resolveActiveSessionRoot(input: Pick<SessionMeta, "id" | "cwd" | "avatar" | "createdAt" | "storeTarget">): string {
    const [year, month, day] = toUtcBucket(input.createdAt);
    if (input.storeTarget === "workspace") {
      return join(input.cwd, ".agenter", "avatar", input.avatar, "sessions", year, month, day, input.id);
    }
    return join(this.globalRoot, year, month, day, input.id);
  }

  private resolveArchiveSessionRoot(sessionId: string, archivedAt: string): string {
    const [year, month, day] = toUtcBucket(archivedAt);
    return join(this.archiveRoot, year, month, day, sessionId);
  }

  private deriveName(cwd: string): string {
    const part = resolve(cwd)
      .split("/")
      .filter((token) => token.length > 0)
      .at(-1);
    return part ?? "workspace";
  }
}
