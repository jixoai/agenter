export { executeWorkspaceBash, type WorkspaceBashExecInput, type WorkspaceBashExecResult } from "./exec";
export { GrantedWorkspaceFs, type GrantedWorkspaceFsOptions } from "./granted-fs";
export {
  compileWorkspaceGrantRules,
  hasWorkspaceGrantRootAccess,
  normalizeWorkspaceGrantPattern,
  normalizeWorkspaceGrantSubjectPath,
  resolveWorkspaceGrantMode,
  resolveWorkspaceGrantModeFromAbsolutePath,
  sortWorkspaceGrantRecords,
} from "./grants";
export {
  normalizeWorkspaceRuntimePath,
  resolveWorkspaceAvatarAliasRoot,
  resolveWorkspaceAvatarAssetRoot,
  resolveWorkspaceAvatarCanonicalRoot,
  resolveWorkspaceAvatarNicknamesRoot,
  resolveWorkspaceAvatarPrivateRoot,
  resolveWorkspaceAvatarSeatPath,
  resolveWorkspacePrivateAvatarsRoot,
  resolveWorkspacePublicAssetRoot,
  resolveWorkspacePublicRoot,
  resolveWorkspaceSystemRoot,
  resolveWorkspaceToolCommandName,
} from "./paths";
export { listWorkspaceHiddenPrivatePaths } from "./private-isolation";
export {
  createRootWorkspaceShellWorld,
  RootWorkspaceShellWorld,
  type RootWorkspaceShellExecInput,
  type RootWorkspaceShellWorldOptions,
  type RootWorkspaceBashExecResult,
  type RootWorkspaceMountInput,
} from "./root-exec";
export { WorkspaceSystemStore, type WorkspaceSystemStoreOptions } from "./store";
export type {
  WorkspaceAssetKind,
  WorkspaceAssetRoots,
  WorkspaceExecProfileRecord,
  WorkspaceGrantInput,
  WorkspaceGrantMode,
  WorkspaceGrantRecord,
  WorkspaceMountKind,
  WorkspaceMountRecord,
  WorkspaceRecord,
  WorkspaceSystemSnapshot,
} from "./types";
