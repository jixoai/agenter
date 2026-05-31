import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import { toWorkspacePath } from "../workspace-target";
import { AVATAR_HOME_ENV, parseEnvAvatarHome, serializeEnvAvatarHome } from "./env-home";
import { normalizeWorkspaceGrantPattern, sortWorkspaceGrantRecords } from "./grants";
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

interface LegacyWorkspaceGrantRecord {
  grantId: string;
  mountId: string;
  workspacePath: string;
  relativePath: string;
  absolutePath: string;
  mode: "ro" | "rw";
  createdAt: string;
  revokedAt?: string;
}

interface LegacyWorkspaceSystemSnapshot {
  version: 1;
  workspaces: WorkspaceRecord[];
  mounts: WorkspaceMountRecord[];
  grants: LegacyWorkspaceGrantRecord[];
  execProfiles: WorkspaceExecProfileRecord[];
}

interface WorkspaceSystemSnapshotV2 {
  version: 2;
  workspaces: WorkspaceRecord[];
  mounts: Array<
    Omit<WorkspaceMountRecord, "runtimeWorkspaceId" | "alias"> & {
      runtimeWorkspaceId?: number;
      alias?: string;
    }
  >;
  grants: WorkspaceGrantRecord[];
  execProfiles: WorkspaceExecProfileRecord[];
}

const EMPTY_SNAPSHOT: WorkspaceSystemSnapshot = {
  version: 3,
  workspaces: [],
  mounts: [],
  grants: [],
  execProfiles: [],
};

const resolveWorkspaceId = (workspacePath: string): string =>
  createHash("sha1").update(`workspace:${workspacePath}`).digest("hex").slice(0, 24);

const buildDefaultWorkspaceAlias = (workspacePath: string, kind: WorkspaceMountKind): string => {
  if (kind === "avatar-root") {
    return "root";
  }
  const normalized = toWorkspacePath(workspacePath);
  const segments = normalized.split("/").filter((segment) => segment.length > 0);
  if (segments.length >= 2) {
    return `${segments.at(-2)}/${segments.at(-1)}`;
  }
  if (segments.length === 1) {
    return segments[0]!;
  }
  return normalized;
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
      version: 3,
      workspaces: this.snapshot.workspaces.map((item) => ({ ...item })),
      mounts: this.snapshot.mounts.map((item) => ({ ...item, env: { ...item.env } })),
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

  attachRuntime(input: {
    runtimeId: string;
    workspacePath: string;
    kind?: WorkspaceMountKind;
    alias?: string;
    env?: Record<string, string>;
  }): WorkspaceMountRecord {
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
      if (input.env) {
        existing.env = { ...input.env };
        existing.updatedAt = nowIso();
      }
      if (typeof input.alias === "string" && input.alias.trim().length > 0 && existing.alias !== input.alias.trim()) {
        existing.alias = input.alias.trim();
        existing.updatedAt = nowIso();
        this.flush();
      }
      return existing;
    }
    const detached = [...this.snapshot.mounts]
      .reverse()
      .find(
        (item) =>
          item.runtimeId === input.runtimeId &&
          item.workspacePath === workspace.workspacePath &&
          item.kind === kind &&
          typeof item.detachedAt === "string",
      );
    const createdAt = nowIso();
    const alias = input.alias?.trim() || detached?.alias || buildDefaultWorkspaceAlias(workspace.workspacePath, kind);
    if (detached) {
      detached.alias = alias;
      if (input.env) {
        detached.env = { ...input.env };
      }
      detached.detachedAt = undefined;
      detached.updatedAt = createdAt;
      this.flush();
      return detached;
    }
    const record: WorkspaceMountRecord = {
      mountId: `mount-${randomUUID()}`,
      runtimeId: input.runtimeId,
      workspaceId: workspace.workspaceId,
      runtimeWorkspaceId: kind === "avatar-root" ? 0 : this.resolveNextRuntimeWorkspaceId(input.runtimeId),
      alias,
      workspacePath: workspace.workspacePath,
      kind,
      env: { ...(input.env ?? {}) },
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
    return this.snapshot.mounts
      .filter((item) => item.runtimeId === runtimeId && typeof item.detachedAt !== "string")
      .sort(
        (left, right) =>
          left.runtimeWorkspaceId - right.runtimeWorkspaceId || left.workspacePath.localeCompare(right.workspacePath),
      );
  }

  getRuntimeMountByWorkspaceId(input: { runtimeId: string; runtimeWorkspaceId: number }): WorkspaceMountRecord | null {
    return (
      this.snapshot.mounts.find(
        (item) =>
          item.runtimeId === input.runtimeId &&
          item.runtimeWorkspaceId === input.runtimeWorkspaceId &&
          typeof item.detachedAt !== "string",
      ) ?? null
    );
  }

  setRuntimeWorkspaceGrants(input: {
    runtimeId: string;
    workspacePath: string;
    grants: WorkspaceGrantInput[];
    kind?: WorkspaceMountKind;
    env?: Record<string, string>;
  }): WorkspaceGrantRecord[] {
    const mount = this.attachRuntime({
      runtimeId: input.runtimeId,
      workspacePath: input.workspacePath,
      kind: input.kind ?? "workspace",
      env: input.env,
    });
    const appliedAt = nowIso();
    for (const current of this.snapshot.grants) {
      if (current.mountId === mount.mountId && typeof current.revokedAt !== "string") {
        current.revokedAt = appliedAt;
      }
    }
    const next = input.grants.map((grant, ruleIndex) => {
      const record: WorkspaceGrantRecord = {
        grantId: `grant-${randomUUID()}`,
        mountId: mount.mountId,
        workspacePath: mount.workspacePath,
        pattern: normalizeWorkspaceGrantPattern(grant.pattern),
        ruleIndex,
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
    return sortWorkspaceGrantRecords(
      this.snapshot.grants.filter((item) => item.mountId === mount.mountId && typeof item.revokedAt !== "string"),
    );
  }

  getRuntimeWorkspaceExecProfile(input: {
    runtimeId: string;
    workspacePath: string;
  }): WorkspaceExecProfileRecord | null {
    const normalized = toWorkspacePath(input.workspacePath);
    const mount = this.snapshot.mounts.find(
      (item) =>
        item.runtimeId === input.runtimeId && item.workspacePath === normalized && typeof item.detachedAt !== "string",
    );
    if (!mount) {
      return null;
    }
    return this.snapshot.execProfiles.find((item) => item.mountId === mount.mountId) ?? null;
  }

  setRuntimeWorkspaceAlias(input: {
    runtimeId: string;
    runtimeWorkspaceId: number;
    alias: string;
  }): WorkspaceMountRecord | null {
    const normalizedAlias = input.alias.trim();
    if (normalizedAlias.length === 0) {
      throw new Error("workspace alias must not be empty");
    }
    const mount = this.getRuntimeMountByWorkspaceId(input);
    if (!mount) {
      return null;
    }
    mount.alias = normalizedAlias;
    mount.updatedAt = nowIso();
    this.flush();
    return mount;
  }

  getRuntimeWorkspaceAvatarHome(input: {
    runtimeId: string;
    runtimeWorkspaceId: number;
  }): string[] {
    const mount = this.getRuntimeMountByWorkspaceId(input);
    if (!mount) {
      return [];
    }
    return parseEnvAvatarHome(mount.env[AVATAR_HOME_ENV]);
  }

  setRuntimeWorkspaceAvatarHome(input: {
    runtimeId: string;
    runtimeWorkspaceId: number;
    paths: readonly string[];
  }): WorkspaceMountRecord | null {
    const mount = this.getRuntimeMountByWorkspaceId(input);
    if (!mount) {
      return null;
    }
    mount.env = {
      ...mount.env,
      [AVATAR_HOME_ENV]: serializeEnvAvatarHome(input.paths),
    };
    mount.updatedAt = nowIso();
    this.flush();
    return mount;
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
      const parsed = JSON.parse(readFileSync(this.filePath, "utf8")) as
        | WorkspaceSystemSnapshot
        | WorkspaceSystemSnapshotV2
        | LegacyWorkspaceSystemSnapshot;
      if (parsed.version === 3) {
        return {
          version: 3,
          workspaces: parsed.workspaces ?? [],
          mounts: (parsed.mounts ?? []).map((mount) => ({
            ...mount,
            kind: mount.kind ?? "workspace",
            env: { ...(mount.env ?? {}) },
          })),
          grants: sortWorkspaceGrantRecords(
            (parsed.grants ?? []).map((grant, index) => ({
              ...grant,
              pattern: normalizeWorkspaceGrantPattern(grant.pattern),
              ruleIndex: grant.ruleIndex ?? index,
            })),
          ),
          execProfiles: parsed.execProfiles ?? [],
        };
      }
      if (parsed.version === 2) {
        return {
          version: 3,
          workspaces: parsed.workspaces ?? [],
          mounts: (parsed.mounts ?? []).map((mount) => ({
            ...mount,
            kind: mount.kind ?? "workspace",
            env: { ...(mount.env ?? {}) },
            runtimeWorkspaceId:
              typeof mount.runtimeWorkspaceId === "number"
                ? mount.runtimeWorkspaceId
                : mount.kind === "avatar-root"
                  ? 0
                  : this.resolveMigratedRuntimeWorkspaceId(parsed.mounts ?? [], mount),
            alias:
              typeof mount.alias === "string" && mount.alias.trim().length > 0
                ? mount.alias.trim()
                : buildDefaultWorkspaceAlias(mount.workspacePath, mount.kind ?? "workspace"),
          })),
          grants: sortWorkspaceGrantRecords(
            (parsed.grants ?? []).map((grant, index) => ({
              ...grant,
              pattern: normalizeWorkspaceGrantPattern(grant.pattern),
              ruleIndex: grant.ruleIndex ?? index,
            })),
          ),
          execProfiles: parsed.execProfiles ?? [],
        };
      }
      if (parsed.version === 1) {
        const nextRuleIndexByMount = new Map<string, number>();
        return {
          version: 3,
          workspaces: parsed.workspaces ?? [],
          mounts: (parsed.mounts ?? []).map((mount) => ({
            ...mount,
            kind: mount.kind ?? "workspace",
            env: {},
            runtimeWorkspaceId:
              (mount.kind ?? "workspace") === "avatar-root"
                ? 0
                : this.resolveMigratedRuntimeWorkspaceId(parsed.mounts ?? [], mount),
            alias: buildDefaultWorkspaceAlias(mount.workspacePath, mount.kind ?? "workspace"),
          })),
          grants: sortWorkspaceGrantRecords(
            (parsed.grants ?? []).map((grant) => {
              const ruleIndex = nextRuleIndexByMount.get(grant.mountId) ?? 0;
              nextRuleIndexByMount.set(grant.mountId, ruleIndex + 1);
              return {
                grantId: grant.grantId,
                mountId: grant.mountId,
                workspacePath: grant.workspacePath,
                pattern: normalizeWorkspaceGrantPattern(grant.relativePath),
                ruleIndex,
                mode: grant.mode,
                createdAt: grant.createdAt,
                revokedAt: grant.revokedAt,
              } satisfies WorkspaceGrantRecord;
            }),
          ),
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

  private resolveNextRuntimeWorkspaceId(runtimeId: string): number {
    return (
      this.snapshot.mounts
        .filter((item) => item.runtimeId === runtimeId && item.kind === "workspace")
        .reduce((maxId, item) => Math.max(maxId, item.runtimeWorkspaceId), 0) + 1
    );
  }

  private resolveMigratedRuntimeWorkspaceId(
    mounts: Array<{
      runtimeId: string;
      kind?: WorkspaceMountKind;
      mountId: string;
    }>,
    target: {
      runtimeId: string;
      kind?: WorkspaceMountKind;
      mountId: string;
    },
  ): number {
    if ((target.kind ?? "workspace") === "avatar-root") {
      return 0;
    }
    const ordered = mounts
      .filter((mount) => mount.runtimeId === target.runtimeId && (mount.kind ?? "workspace") === "workspace")
      .map((mount) => mount.mountId);
    const index = ordered.indexOf(target.mountId);
    return index >= 0 ? index + 1 : ordered.length + 1;
  }

  private flush(): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, `${JSON.stringify(this.snapshot, null, 2)}\n`, "utf8");
  }
}
