export type ProfileIdentifierKind = "email" | "wallet_evm" | "wallet_solana" | "temp";

export type IconOwnerKind = "profile" | "session";

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

export interface ProfileIconSeed {
  identifier: ProfileIdentifier;
  label?: string;
}

export interface ProfileServiceOptions {
  dataDir?: string;
  publicBaseUrl?: string;
  host?: string;
  port?: number;
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
