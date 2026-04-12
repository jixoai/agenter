export { executeWorkspaceBash, type WorkspaceBashExecInput, type WorkspaceBashExecResult } from "./exec";
export {
  executeRootWorkspaceBash,
  type RootWorkspaceBashExecInput,
  type RootWorkspaceBashExecResult,
  type RootWorkspaceMountInput,
} from "./root-exec";
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
export { WorkspaceSystemStore, type WorkspaceSystemStoreOptions } from "./store";
export type {
  WorkspaceAssetRoots,
  WorkspaceAssetKind,
  WorkspaceExecProfileRecord,
  WorkspaceGrantInput,
  WorkspaceGrantMode,
  WorkspaceGrantRecord,
  WorkspaceMountKind,
  WorkspaceMountRecord,
  WorkspaceRecord,
  WorkspaceSystemSnapshot,
} from "./types";
