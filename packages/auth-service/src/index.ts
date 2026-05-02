export {
  buildAvatarIconUrl,
  buildProfileIconUrl,
  buildRoomIconUrl,
  buildSessionIconUrl,
  renderAvatarFallbackSvg,
  renderProfileFallbackSvg,
  renderRoomFallbackSvg,
  renderSessionFallbackSvg,
} from "./render/fallback-icons";
export { AVATAR_CLASSIFY_VALUES } from "./types";
export { resolveAuthServiceDataDir } from "./config";
export {
  canonicalizeAvatarPrincipalMetadata,
  formatAvatarDisplayName,
  normalizeAvatarClassify,
  normalizeAvatarPrincipalMetadata,
  readAvatarPrincipalMetadata,
  resolveBuiltInAvatarProfile,
  resolveAvatarOwnerKey,
} from "./avatar-metadata";
export {
  AUTH_SERVICE_RUNTIME_DESCRIPTOR_FILENAME,
  clearOwnedAuthServiceRuntimeDescriptor,
  readAuthServiceRuntimeDescriptor,
  resolveAuthServiceRuntimeDescriptorPath,
  writeAuthServiceRuntimeDescriptor,
} from "./runtime-descriptor";
export { createAuthServiceApp, createProfileServiceApp } from "./server/app";
export { createAuthServiceRuntime, createProfileServiceRuntime } from "./server/runtime";
export { startAuthServiceServer, startProfileServiceServer } from "./server/start-server";
export type {
  AuthChallengeDescriptor,
  AuthDescriptor,
  AuthSessionClaims,
  AuthSessionProjection,
  AvatarClassify,
  AvatarIconSeed,
  AvatarPrincipalMetadata,
  CreateManagedPrincipalInput,
  EmailChallengeIssuedEvent,
  IconAssetRecord,
  IconOwnerKind,
  ListManagedPrincipalsInput,
  ManagedPrincipalRecord,
  PrincipalProjection,
  ProfileIconSeed,
  ProfileIdentifier,
  ProfileIdentifierKind,
  ProfileMetadata,
  ProfileProjection,
  RoomIconSeed,
  RootAuthPrivateKeyReveal,
  AuthServiceHandle,
  AuthServiceOptions,
  AuthServiceRuntimeDescriptor,
  ProfileServiceHandle,
  ProfileServiceOptions,
  SessionIconSeed,
} from "./types";
