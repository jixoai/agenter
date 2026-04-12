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
export { createProfileServiceApp } from "./server/app";
export { createProfileServiceRuntime } from "./server/runtime";
export { startProfileServiceServer } from "./server/start-server";
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
  ProfileServiceHandle,
  ProfileServiceOptions,
  SessionIconSeed,
} from "./types";
