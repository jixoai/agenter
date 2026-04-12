import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { homedir } from "node:os";

import { toWorkspaceCwd, toWorkspacePath } from "../workspace-target";
import type {
  WorkspaceExecProfileRecord,
  WorkspaceGrantInput,
  WorkspaceGrantRecord,
  WorkspaceMountKind,
  WorkspaceMountRecord,
  WorkspaceRecord,
  WorkspaceSystemSnapshot,
} from "./types";

const nowIso = (): string => new Date().toISOString();

const EMPTY_SNAPSHOT: WorkspaceSystemSnapshot = {
  version: 1,
  workspaces: [],
  mounts: [],
  grants: [],
  execProfiles: [],
};

const resolveWorkspaceId = (workspacePath: string): string =>
  createHash("sha1").update(`workspace:${workspacePath}`).digest("hex").slice(0, 24);

const normalizeRelativeGrantPath = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed || trimmed === ".") {
    return "/";
  }
  const normalized = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return normalized.replace(/\/+$/, "") || "/";
};

export interface WorkspaceSystemStoreOptions {
  filePath?: string;
}

export class WorkspaceSystemStore {
  private readonly filePath: string;
  private snapshot: WorkspaceSystemSnapshot;

  constructor(options: WorkspaceSystemStoreOptions = {}) {
    this.filePath = options.filePath ?? join(homedir(), ".agenter", "workspace-system", "state.json");
    this.snapshot = this.readSnapshot();
  }

  getStatePath(): string {
    return this.filePath;
  }

  snapshotState(): WorkspaceSystemSnapshot {
    return {
      version: 1,
      workspaces: this.snapshot.workspaces.map((item) => ({ ...item })),
      mounts: this.snapshot.mounts.map((item) => ({ ...item })),
      grants: this.snapshot.grants.map((item) => ({ ...item })),
      execProfiles: this.snapshot.execProfiles.map((item) => ({ ...item, env: { ...item.env } })),
    };
  }

  ensureWorkspace(workspacePath: string): WorkspaceRecord {
    const normalized = toWorkspacePath(workspacePath);
    const existing = this.snapshot.workspaces.find((item) => item.workspacePath === normalized);
    if (existing) {
      return existing;
    }
    const createdAt = nowIso();
    const record: WorkspaceRecord = {
      workspaceId: resolveWorkspaceId(normalized),
      workspacePath: normalized,
      createdAt,
      updatedAt: createdAt,
    };
    this.snapshot.workspaces.push(record);
    this.flush();
    return record;
  }

  attachRuntime(input: { runtimeId: string; workspacePath: string; kind?: WorkspaceMountKind }): WorkspaceMountRecord {
    const workspace = this.ensureWorkspace(input.workspacePath);
    const kind = input.kind ?? "workspace";
    const existing = this.snapshot.mounts.find(
      (item) =>
        item.runtimeId === input.runtimeId &&
        item.workspacePath === workspace.workspacePath &&
        item.kind === kind &&
        typeof item.detachedAt !== "string",
    );
    if (existing) {
      return existing;
    }
    const createdAt = nowIso();
    const record: WorkspaceMountRecord = {
      mountId: `mount-${randomUUID()}`,
      runtimeId: input.runtimeId,
      workspaceId: workspace.workspaceId,
      workspacePath: workspace.workspacePath,
      kind,
      createdAt,
      updatedAt: createdAt,
    };
    this.snapshot.mounts.push(record);
    this.flush();
    return record;
  }

  detachRuntimeWorkspace(input: { runtimeId: string; workspacePath: string }): WorkspaceMountRecord | null {
    const normalized = toWorkspacePath(input.workspacePath);
    const existing = this.snapshot.mounts.find(
      (item) =>
        item.runtimeId === input.runtimeId && item.workspacePath === normalized && typeof item.detachedAt !== "string",
    );
    if (!existing) {
      return null;
    }
    existing.detachedAt = nowIso();
    existing.updatedAt = existing.detachedAt;
    for (const grant of this.snapshot.grants) {
      if (grant.mountId === existing.mountId && typeof grant.revokedAt !== "string") {
        grant.revokedAt = existing.detachedAt;
      }
    }
    this.flush();
    return existing;
  }

  listRuntimeMounts(runtimeId: string): WorkspaceMountRecord[] {
    return this.snapshot.mounts.filter((item) => item.runtimeId === runtimeId && typeof item.detachedAt !== "string");
  }

  setRuntimeWorkspaceGrants(input: {
    runtimeId: string;
    workspacePath: string;
    grants: WorkspaceGrantInput[];
    kind?: WorkspaceMountKind;
  }): WorkspaceGrantRecord[] {
    const mount = this.attachRuntime({
      runtimeId: input.runtimeId,
      workspacePath: input.workspacePath,
      kind: input.kind ?? "workspace",
    });
    const appliedAt = nowIso();
    for (const current of this.snapshot.grants) {
      if (current.mountId === mount.mountId && typeof current.revokedAt !== "string") {
        current.revokedAt = appliedAt;
      }
    }

    const workspaceRoot = toWorkspaceCwd(mount.workspacePath);
    const next = input.grants.map((grant) => {
      const relativePath = normalizeRelativeGrantPath(grant.relativePath);
      const absolutePath = resolve(workspaceRoot, `.${relativePath}`);
      const relativeToRoot = relative(workspaceRoot, absolutePath);
      if (relativeToRoot.startsWith("..") || isAbsolute(relativeToRoot)) {
        throw new Error(`workspace grant escapes root: ${grant.relativePath}`);
      }
      const record: WorkspaceGrantRecord = {
        grantId: `grant-${randomUUID()}`,
        mountId: mount.mountId,
        workspacePath: mount.workspacePath,
        relativePath,
        absolutePath,
        mode: grant.mode,
        createdAt: appliedAt,
      };
      this.snapshot.grants.push(record);
      return record;
    });
    this.flush();
    return next;
  }

  listRuntimeWorkspaceGrants(input: { runtimeId: string; workspacePath: string }): WorkspaceGrantRecord[] {
    const normalized = toWorkspacePath(input.workspacePath);
    const mount = this.snapshot.mounts.find(
      (item) =>
        item.runtimeId === input.runtimeId && item.workspacePath === normalized && typeof item.detachedAt !== "string",
    );
    if (!mount) {
      return [];
    }
    return this.snapshot.grants.filter((item) => item.mountId === mount.mountId && typeof item.revokedAt !== "string");
  }

  upsertExecProfile(input: {
    runtimeId: string;
    workspacePath: string;
    cwd: string;
    env?: Record<string, string>;
  }): WorkspaceExecProfileRecord {
    const mount = this.attachRuntime({
      runtimeId: input.runtimeId,
      workspacePath: input.workspacePath,
      kind: "workspace",
    });
    const existing = this.snapshot.execProfiles.find((item) => item.mountId === mount.mountId);
    if (existing) {
      existing.cwd = input.cwd;
      existing.env = { ...(input.env ?? {}) };
      existing.updatedAt = nowIso();
      this.flush();
      return existing;
    }
    const createdAt = nowIso();
    const record: WorkspaceExecProfileRecord = {
      profileId: `exec-${randomUUID()}`,
      mountId: mount.mountId,
      cwd: input.cwd,
      env: { ...(input.env ?? {}) },
      createdAt,
      updatedAt: createdAt,
    };
    this.snapshot.execProfiles.push(record);
    this.flush();
    return record;
  }

  private readSnapshot(): WorkspaceSystemSnapshot {
    try {
      const parsed = JSON.parse(readFileSync(this.filePath, "utf8")) as WorkspaceSystemSnapshot;
      if (parsed.version === 1) {
        return {
          version: 1,
          workspaces: parsed.workspaces ?? [],
          mounts: (parsed.mounts ?? []).map((mount) => ({
            ...mount,
            kind: mount.kind ?? "workspace",
          })),
          grants: parsed.grants ?? [],
          execProfiles: parsed.execProfiles ?? [],
        };
      }
    } catch {
      // Ignore missing or invalid files and start clean.
    }
    return {
      ...EMPTY_SNAPSHOT,
      workspaces: [],
      mounts: [],
      grants: [],
      execProfiles: [],
    };
  }

  private flush(): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, `${JSON.stringify(this.snapshot, null, 2)}\n`, "utf8");
  }
}
