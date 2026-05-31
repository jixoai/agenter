export type WorkspaceAssetKind = "skills" | "memory" | "tools" | "archive";
export type WorkspaceGrantMode = "ro" | "rw";
/**
 * Storage keeps the historical `"workspace"` identifier, but shell/UI semantics
 * should read it as the collaboration-oriented public-workspace surface.
 */
export type WorkspaceMountKind = "avatar-root" | "workspace";

export interface WorkspaceRecord {
  workspaceId: string;
  workspacePath: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceMountRecord {
  mountId: string;
  runtimeId: string;
  workspaceId: string;
  runtimeWorkspaceId: number;
  alias: string;
  workspacePath: string;
  kind: WorkspaceMountKind;
  env: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  detachedAt?: string;
}

export interface WorkspaceGrantRecord {
  grantId: string;
  mountId: string;
  workspacePath: string;
  pattern: string;
  ruleIndex: number;
  mode: WorkspaceGrantMode;
  createdAt: string;
  revokedAt?: string;
}

export interface WorkspaceExecProfileRecord {
  profileId: string;
  mountId: string;
  cwd: string;
  env: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceGrantInput {
  pattern: string;
  mode: WorkspaceGrantMode;
}

export interface WorkspaceAssetRoots {
  workspacePath: string;
  avatar: string;
  publicRoots: Record<WorkspaceAssetKind, string>;
  privateRoots: Record<WorkspaceAssetKind, string>;
}

export interface WorkspaceSystemSnapshot {
  version: 3;
  workspaces: WorkspaceRecord[];
  mounts: WorkspaceMountRecord[];
  grants: WorkspaceGrantRecord[];
  execProfiles: WorkspaceExecProfileRecord[];
}
