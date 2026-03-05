import { mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

export type SessionStatus = "stopped" | "starting" | "running" | "error";

const isoNow = (): string => new Date().toISOString();
const createId = (): string => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export interface SessionMeta {
  id: string;
  name: string;
  cwd: string;
  avatar: string;
  createdAt: string;
  updatedAt: string;
  status: SessionStatus;
  lastError?: string;
  sessionRoot: string;
  storeTarget: "global" | "workspace";
}

interface SessionJsonLike {
  session?: Partial<SessionMeta> & { id?: string };
  createdAt?: string;
  updatedAt?: string;
}

const normalizePersistedStatus = (status: SessionStatus | undefined): SessionStatus => {
  if (status === "running" || status === "starting") {
    return "stopped";
  }
  return status ?? "stopped";
};

export interface SessionCatalogOptions {
  globalRoot?: string;
}

export class SessionCatalog {
  private readonly byId = new Map<string, SessionMeta>();
  private readonly globalRoot: string;

  constructor(options: SessionCatalogOptions = {}) {
    this.globalRoot = options.globalRoot ?? join(homedir(), ".agenter", "sessions");
  }

  getGlobalRoot(): string {
    return this.globalRoot;
  }

  list(): SessionMeta[] {
    return [...this.byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  get(sessionId: string): SessionMeta | undefined {
    return this.byId.get(sessionId);
  }

  create(input: { name?: string; cwd: string; avatar: string; storeTarget: "global" | "workspace" }): SessionMeta {
    const id = createId();
    const now = isoNow();
    const cwd = resolve(input.cwd);
    const sessionRoot =
      input.storeTarget === "workspace"
        ? join(cwd, ".agenter", "avatar", input.avatar, "sessions", id)
        : join(this.globalRoot, id);

    mkdirSync(sessionRoot, { recursive: true });

    const session: SessionMeta = {
      id,
      name: input.name?.trim().length ? input.name.trim() : this.deriveName(cwd),
      cwd,
      avatar: input.avatar,
      createdAt: now,
      updatedAt: now,
      status: "stopped",
      storeTarget: input.storeTarget,
      sessionRoot,
    };
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
    const discovered = new Map<string, SessionMeta>();

    for (const sessionRoot of this.scanGlobalSessionRoots()) {
      const parsed = this.readSessionMeta(sessionRoot, "global");
      if (parsed) {
        discovered.set(parsed.id, parsed);
      }
    }

    for (const workspace of workspaces) {
      for (const sessionRoot of this.scanWorkspaceSessionRoots(workspace)) {
        const parsed = this.readSessionMeta(sessionRoot, "workspace");
        if (parsed) {
          discovered.set(parsed.id, parsed);
        }
      }
    }

    for (const meta of discovered.values()) {
      const current = this.byId.get(meta.id);
      if (current?.status === "running" || current?.status === "starting") {
        continue;
      }
      this.byId.set(meta.id, current ? { ...meta, status: current.status } : meta);
    }
  }

  private scanGlobalSessionRoots(): string[] {
    try {
      return readdirSync(this.globalRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => join(this.globalRoot, entry.name));
    } catch {
      return [];
    }
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
        const sessionsDir = join(avatarRoot, avatar.name, "sessions");
        try {
          const sessions = readdirSync(sessionsDir, { withFileTypes: true });
          for (const session of sessions) {
            if (session.isDirectory()) {
              roots.push(join(sessionsDir, session.name));
            }
          }
        } catch {
          // ignore missing per-avatar session directories.
        }
      }
      return roots;
    } catch {
      return [];
    }
  }

  private readSessionMeta(sessionRoot: string, target: "global" | "workspace"): SessionMeta | undefined {
    try {
      const text = readFileSync(join(sessionRoot, "session.json"), "utf8");
      const parsed = JSON.parse(text) as SessionJsonLike;
      const session = parsed.session;
      const sessionId = session?.id;
      if (!session || !sessionId) {
        return undefined;
      }
      const createdAt = session.createdAt ?? parsed.createdAt ?? isoNow();
      const updatedAt = session.updatedAt ?? parsed.updatedAt ?? createdAt;
      return {
        id: sessionId,
        name: session.name ?? this.deriveName(session.cwd ?? "workspace"),
        cwd: session.cwd ? resolve(session.cwd) : ".",
        avatar: session.avatar ?? "agenter-bot",
        createdAt,
        updatedAt,
        status: normalizePersistedStatus(session.status as SessionStatus | undefined),
        lastError: session.lastError,
        sessionRoot,
        storeTarget: (session.storeTarget as "global" | "workspace" | undefined) ?? target,
      };
    } catch {
      return undefined;
    }
  }

  private deriveName(cwd: string): string {
    const part = resolve(cwd)
      .split("/")
      .filter((token) => token.length > 0)
      .at(-1);
    return part ?? "workspace";
  }
}
