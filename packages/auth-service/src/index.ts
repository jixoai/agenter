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
export {
  formatAvatarDisplayName,
  normalizeAvatarClassify,
  normalizeAvatarPrincipalMetadata,
  readAvatarPrincipalMetadata,
  resolveAvatarOwnerKey,
} from "./avatar-metadata";
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
  ProfileServiceHandle,
  ProfileServiceOptions,
  SessionIconSeed,
} from "./types";
