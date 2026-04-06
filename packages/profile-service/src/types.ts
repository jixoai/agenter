import type { PrincipalAlgorithm, PrincipalId, PrincipalKeyPair, PrincipalKind } from "@agenter/principal-crypto";

export type ProfileIdentifierKind = "email" | "wallet_evm" | "wallet_solana" | "temp";

export type IconOwnerKind = "profile" | "session" | "room";

export interface ProfileIdentifier {
  kind: ProfileIdentifierKind;
  value: string;
}

export interface ProfileMetadata {
  nickname?: string;
  displayName?: string;
  phone?: string;
  address?: string;
  extra?: Record<string, unknown>;
}

export interface ProfileProjection {
  profileId: string | null;
  identifiers: ProfileIdentifier[];
  metadata: ProfileMetadata;
  iconUrl: string;
  isVirtual: boolean;
}

export interface CreateManagedPrincipalInput {
  kind: PrincipalKind;
  ownerKey?: string;
  metadata?: Record<string, unknown>;
}

export interface PrincipalProjection
  extends Pick<PrincipalKeyPair, "algorithm" | "principalId" | "publicKey"> {
  kind: PrincipalKind;
  ownerKey?: string;
  metadata: Record<string, unknown>;
  hasManagedPrivateKey: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ManagedPrincipalRecord extends PrincipalProjection {
  privateKey: PrincipalKeyPair["privateKey"];
  hasManagedPrivateKey: true;
}

export interface AuthSessionClaims {
  authId: string;
  profileId: string;
  admin: boolean;
  superadmin: boolean;
}

export interface AuthDescriptor {
  authMode: "wallet_challenge_jwt";
  rootAuthId: string;
  rootIdentifier: ProfileIdentifier;
  rootAuthKeyPath: string;
  jwtTtlSeconds: number;
  rootAuthBootstrapMode: "managed_local" | "external";
  canRevealRootAuthPrivateKey: boolean;
  hasManagedRootAuthPrivateKey: boolean;
}

export interface RootAuthPrivateKeyReveal {
  privateKey: string;
  authId: string;
  rootAuthKeyPath: string;
}

export interface AuthChallengeDescriptor {
  challengeId: string;
  challengeText: string;
  authId: string;
  expiresAt: string;
}

export interface AuthSessionProjection {
  token: string;
  issuedAt: string;
  expiresAt: string | null;
  claims: AuthSessionClaims;
  profile: ProfileProjection;
}

export interface IconAssetRecord {
  ownerKind: IconOwnerKind;
  ownerKey: string;
  mimeType: string;
  bytes: Uint8Array;
  updatedAt: string;
}

export interface SessionIconSeed {
  sessionId: string;
  workspacePath: string;
  label?: string;
}

export interface RoomIconSeed {
  roomId: string;
  label?: string;
}

export interface ProfileIconSeed {
  identifier: ProfileIdentifier;
  label?: string;
}

export interface ProfileServiceOptions {
  dataDir?: string;
  publicBaseUrl?: string;
  host?: string;
  port?: number;
  rootAuthPrivateKey?: string;
  authJwtTtlMs?: number;
  resvgLibraryPath?: string;
  webauthnOrigin?: string;
  webauthnRpId?: string;
  webauthnRpName?: string;
  webauthnUiDir?: string;
  onEmailChallengeIssued?: (event: EmailChallengeIssuedEvent) => void | Promise<void>;
}

export interface ProfileServiceHandle {
  host: string;
  port: number;
  stop: () => Promise<void>;
}

export interface EmailChallengeIssuedEvent {
  challengeId: string;
  email: string;
  code: string;
  expiresAt: string;
}

export type WebAuthnFlowKind = "register" | "authenticate";

export interface WebAuthnTicketRecord {
  ticketId: string;
  profileId: string;
  flowKind: WebAuthnFlowKind;
  challenge: string;
  expiresAt: string;
}

export interface WebAuthnCredentialRecord {
  credentialId: string;
  profileId: string;
  publicKey: Uint8Array;
  counter: number;
  transports: string[];
  deviceType: string;
  backedUp: boolean;
  createdAt: string;
  updatedAt: string;
}
