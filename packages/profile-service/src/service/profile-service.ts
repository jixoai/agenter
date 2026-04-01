import { randomInt } from "node:crypto";
import { issueAuthJwt, verifyAuthJwt } from "../auth/jwt";
import { parseWalletIdentifier, verifyWalletSignature } from "../auth/wallet-auth";
import {
  type AuthenticationResponseJson,
  type RegistrationResponseJson,
  ProfileWebAuthnControlPlane,
} from "../auth/webauthn-control-plane";
import { isDurableIdentifierKind, normalizeIdentifier, parseIdentifierKey, toIdentifierKey } from "../identifiers";
import { buildSessionIconUrl, renderProfileFallbackSvg, renderSessionFallbackSvg } from "../render/fallback-icons";
import { fetchGravatar } from "../render/gravatar";
import type {
  AuthChallengeDescriptor,
  AuthDescriptor,
  AuthSessionClaims,
  AuthSessionProjection,
  EmailChallengeIssuedEvent,
  IconAssetRecord,
  IconOwnerKind,
  ProfileIdentifier,
  ProfileMetadata,
  ProfileProjection,
  RootAuthPrivateKeyReveal,
  SessionIconSeed,
} from "../types";
import type { ProfileStore } from "../store/profile-store";

export interface ProfileServiceHooks {
  onEmailChallengeIssued?: (event: EmailChallengeIssuedEvent) => void | Promise<void>;
}

export interface ProfileServiceAuthOptions {
  publicBaseUrl: string;
  authJwtIssuer: string;
  authJwtSecret: string;
  authJwtTtlMs: number;
  rootAuthId: string;
  rootAuthPrivateKey: string;
  rootIdentifier: ProfileIdentifier;
  rootAuthKeyPath: string;
  rootAuthBootstrapMode: "managed_local" | "external";
  canRevealRootAuthPrivateKey: boolean;
  webauthnOrigin: string;
  webauthnRpId: string;
  webauthnRpName: string;
}

export class ProfileService {
  private readonly webauthn: ProfileWebAuthnControlPlane;

  constructor(
    private readonly store: ProfileStore,
    private readonly authOptions: ProfileServiceAuthOptions,
    private readonly hooks: ProfileServiceHooks = {},
  ) {
    this.webauthn = new ProfileWebAuthnControlPlane({
      store,
      webauthnOrigin: authOptions.webauthnOrigin,
      webauthnRpId: authOptions.webauthnRpId,
      webauthnRpName: authOptions.webauthnRpName,
    });
  }

  private buildClaims(profileId: string, authId: string): AuthSessionClaims {
    const superadmin = authId === this.authOptions.rootAuthId;
    return {
      authId,
      profileId,
      admin: true,
      superadmin,
    };
  }

  private issueAuthSession(profile: ProfileProjection, authId: string): AuthSessionProjection {
    if (!profile.profileId) {
      throw new Error("cannot issue auth session for virtual profile");
    }
    const claims = this.buildClaims(profile.profileId, authId);
    const issued = issueAuthJwt({
      claims,
      issuer: this.authOptions.authJwtIssuer,
      secret: this.authOptions.authJwtSecret,
      ttlMs: this.authOptions.authJwtTtlMs,
    });
    return {
      token: issued.token,
      issuedAt: new Date().toISOString(),
      expiresAt: issued.expiresAt,
      claims,
      profile,
    };
  }

  describeAuth(): AuthDescriptor {
    return {
      authMode: "wallet_challenge_jwt",
      rootAuthId: this.authOptions.rootAuthId,
      rootIdentifier: normalizeIdentifier(this.authOptions.rootIdentifier),
      rootAuthKeyPath: this.authOptions.rootAuthKeyPath,
      jwtTtlSeconds: Math.max(1, Math.floor(this.authOptions.authJwtTtlMs / 1000)),
      rootAuthBootstrapMode: this.authOptions.rootAuthBootstrapMode,
      canRevealRootAuthPrivateKey: this.authOptions.canRevealRootAuthPrivateKey,
      hasManagedRootAuthPrivateKey: this.authOptions.rootAuthBootstrapMode === "managed_local",
    };
  }

  revealRootAuthPrivateKey(): RootAuthPrivateKeyReveal {
    if (!this.authOptions.canRevealRootAuthPrivateKey) {
      throw new Error("managed root auth key reveal is unavailable");
    }
    return {
      privateKey: this.authOptions.rootAuthPrivateKey,
      authId: this.authOptions.rootAuthId,
      rootAuthKeyPath: this.authOptions.rootAuthKeyPath,
    };
  }

  private async resolveReference(reference: string): Promise<ProfileProjection> {
    const byId = await this.store.getProfileById(reference);
    if (byId) {
      return byId;
    }
    return await this.store.resolveProfile(parseIdentifierKey(reference));
  }

  private async requireAuthorizedProfile(reference: string, token: string | null | undefined): Promise<ProfileProjection> {
    if (!token) {
      throw new Error("auth token required");
    }
    const authorizedSession = await this.authenticateAuthToken(token);
    if (!authorizedSession?.profile.profileId) {
      throw new Error("invalid auth token");
    }
    const targetProfile = await this.resolveReference(reference);
    if (!targetProfile.profileId) {
      throw new Error("virtual profiles are read-only");
    }
    if (targetProfile.profileId !== authorizedSession.profile.profileId) {
      throw new Error("auth token does not match target profile");
    }
    return targetProfile;
  }

  async listProfiles(): Promise<ProfileProjection[]> {
    return await this.store.listProfiles();
  }

  async resolveProfile(reference: string): Promise<ProfileProjection> {
    return await this.resolveReference(reference);
  }

  async authenticateAuthToken(token: string | null | undefined): Promise<AuthSessionProjection | null> {
    if (!token) {
      return null;
    }
    const verifiedJwt = verifyAuthJwt(token, {
      issuer: this.authOptions.authJwtIssuer,
      secret: this.authOptions.authJwtSecret,
    });
    if (verifiedJwt) {
      const profile = await this.store.getProfileById(verifiedJwt.claims.profileId);
      if (!profile?.profileId) {
        return null;
      }
      return {
        token,
        issuedAt: verifiedJwt.issuedAt,
        expiresAt: verifiedJwt.expiresAt,
        claims: verifiedJwt.claims,
        profile,
      };
    }

    const profileId = await this.store.getProfileIdForToken(token);
    if (!profileId) {
      return null;
    }
    const profile = await this.store.getProfileById(profileId);
    if (!profile?.profileId) {
      return null;
    }
    const primaryAuthIdentifier = profile.identifiers.find((identifier) => isDurableIdentifierKind(identifier.kind)) ?? {
      kind: "temp",
      value: profile.profileId,
    };
    return {
      token,
      issuedAt: new Date().toISOString(),
      expiresAt: null,
      claims: this.buildClaims(profile.profileId, toIdentifierKey(primaryAuthIdentifier)),
      profile,
    };
  }

  async authenticateToken(token: string | null | undefined): Promise<ProfileProjection | null> {
    return (await this.authenticateAuthToken(token))?.profile ?? null;
  }

  async createOrResolveDurableProfile(identifier: ProfileIdentifier): Promise<ProfileProjection> {
    return await this.store.createOrBindProfile(identifier);
  }

  async linkIdentifier(profileId: string, identifier: ProfileIdentifier): Promise<ProfileProjection> {
    return await this.store.linkIdentifier(profileId, identifier);
  }

  async updateProfileMetadata(profileId: string, metadata: ProfileMetadata): Promise<void> {
    await this.store.updateProfileMetadata(profileId, metadata);
  }

  async patchProfileMetadata(
    reference: string,
    patch: ProfileMetadata,
    token: string | null | undefined,
  ): Promise<ProfileProjection> {
    const profile = await this.requireAuthorizedProfile(reference, token);
    const mergedMetadata: ProfileMetadata = {
      nickname: patch.nickname ?? profile.metadata.nickname,
      displayName: patch.displayName ?? profile.metadata.displayName,
      phone: patch.phone ?? profile.metadata.phone,
      address: patch.address ?? profile.metadata.address,
      extra: patch.extra ? { ...(profile.metadata.extra ?? {}), ...patch.extra } : profile.metadata.extra,
    };
    await this.store.updateProfileMetadata(profile.profileId!, mergedMetadata);
    return (await this.store.getProfileById(profile.profileId!)) ?? profile;
  }

  async putIconAsset(ownerKind: IconOwnerKind, ownerKey: string, mimeType: string, bytes: Uint8Array): Promise<void> {
    const record: IconAssetRecord = {
      ownerKind,
      ownerKey,
      mimeType,
      bytes,
      updatedAt: new Date().toISOString(),
    };
    await this.store.putIconAsset(record);
  }

  async putProfileIcon(reference: string, mimeType: string, bytes: Uint8Array, token: string | null | undefined): Promise<ProfileProjection> {
    const profile = await this.requireAuthorizedProfile(reference, token);
    await this.putIconAsset("profile", profile.profileId!, mimeType, bytes);
    return profile;
  }

  async putSessionIcon(sessionId: string, mimeType: string, bytes: Uint8Array): Promise<void> {
    await this.putIconAsset("session", sessionId, mimeType, bytes);
  }

  async upsertSessionSeed(seed: SessionIconSeed): Promise<void> {
    await this.store.putSessionSeed(seed);
  }

  async resolveProfileIcon(reference: string): Promise<{ mimeType: string; bytes?: Uint8Array; svg?: string }> {
    const projection = await this.resolveReference(reference);
    const requestedIdentifier = parseIdentifierKey(reference);
    const ownerKey = projection.profileId ?? toIdentifierKey(requestedIdentifier);
    const uploaded = await this.store.getIconAsset("profile", ownerKey);
    if (uploaded) {
      return { mimeType: uploaded.mimeType, bytes: uploaded.bytes };
    }
    const emailIdentifier = projection.identifiers.find((item) => item.kind === "email");
    if (emailIdentifier) {
      const gravatar = await fetchGravatar(emailIdentifier.value);
      if (gravatar) {
        return gravatar;
      }
    }
    const seedIdentifier = normalizeIdentifier(projection.identifiers[0] ?? requestedIdentifier);
    return {
      mimeType: "image/svg+xml",
      svg: renderProfileFallbackSvg({
        identifier: seedIdentifier,
        label: projection.metadata.displayName?.slice(0, 1).toUpperCase() ?? seedIdentifier.value.slice(0, 1).toUpperCase(),
      }),
    };
  }

  async resolveSessionIcon(sessionId: string): Promise<{ mimeType: string; bytes?: Uint8Array; svg?: string; iconUrl: string }> {
    const uploaded = await this.store.getIconAsset("session", sessionId);
    if (uploaded) {
      return {
        mimeType: uploaded.mimeType,
        bytes: uploaded.bytes,
        iconUrl: buildSessionIconUrl(sessionId),
      };
    }
    const seed = (await this.store.getSessionSeed(sessionId)) ?? {
      sessionId,
      workspacePath: "unknown",
      label: undefined,
    };
    return {
      mimeType: "image/svg+xml",
      svg: renderSessionFallbackSvg(seed),
      iconUrl: buildSessionIconUrl(sessionId),
    };
  }

  async createEmailChallenge(email: string): Promise<{ challengeId: string; expiresAt: string }> {
    const normalizedEmail = normalizeIdentifier({ kind: "email", value: email }).value;
    const code = `${randomInt(100000, 1_000_000)}`;
    const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
    const challengeId = await this.store.createEmailChallenge(normalizedEmail, code, expiresAt);
    await this.hooks.onEmailChallengeIssued?.({
      challengeId,
      email: normalizedEmail,
      code,
      expiresAt,
    });
    return { challengeId, expiresAt };
  }

  async verifyEmailChallenge(
    email: string,
    code: string,
    existingToken: string | null | undefined,
  ): Promise<{ profile: ProfileProjection; registrationTicket: string; expiresAt: string }> {
    const normalizedEmail = normalizeIdentifier({ kind: "email", value: email }).value;
    const verified = await this.store.consumeEmailChallenge(normalizedEmail, code);
    if (!verified) {
      throw new Error("invalid email verification code");
    }
    const identifier = { kind: "email", value: normalizedEmail } as const;
    const authenticatedProfile = await this.authenticateToken(existingToken);
    const profile =
      authenticatedProfile?.profileId
        ? await this.store.linkIdentifier(authenticatedProfile.profileId, identifier)
        : await this.store.createOrBindProfile(identifier);
    if (!profile.profileId) {
      throw new Error("failed to resolve durable email profile");
    }
    const ticket = await this.webauthn.createRegistrationTicket(profile.profileId);
    return {
      profile,
      registrationTicket: ticket.ticketId,
      expiresAt: ticket.expiresAt,
    };
  }

  async createWebAuthnRegistrationOptions(ticketId: string) {
    return await this.webauthn.createRegistrationOptions(ticketId);
  }

  async verifyWebAuthnRegistration(ticketId: string, response: RegistrationResponseJson) {
    return await this.webauthn.verifyRegistration(ticketId, response);
  }

  async createWebAuthnAuthenticationOptions(reference: string) {
    const profile = await this.resolveReference(reference);
    return await this.webauthn.createAuthenticationOptions(profile);
  }

  async verifyWebAuthnAuthentication(ticketId: string, response: AuthenticationResponseJson) {
    return await this.webauthn.verifyAuthentication(ticketId, response);
  }

  async createAuthChallenge(identifierInput: string): Promise<AuthChallengeDescriptor> {
    const identifier = parseWalletIdentifier(identifierInput);
    const authId = toIdentifierKey(identifier);
    const challengeText = `agenter auth-service challenge\nauthId=${authId}\nnonce=${crypto.randomUUID()}`;
    const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
    const challengeId = await this.store.createWalletChallenge(
      authId,
      challengeText,
      expiresAt,
    );
    return { challengeId, challengeText, authId, expiresAt };
  }

  async createWalletChallenge(identifierInput: string): Promise<{ challengeId: string; challengeText: string }> {
    const challenge = await this.createAuthChallenge(identifierInput);
    return {
      challengeId: challenge.challengeId,
      challengeText: challenge.challengeText,
    };
  }

  async verifyAuthChallenge(
    challengeId: string,
    signature: string,
    existingToken: string | null | undefined,
  ): Promise<AuthSessionProjection> {
    const challenge = await this.store.getWalletChallenge(challengeId);
    if (!challenge) {
      throw new Error("wallet challenge not found or expired");
    }
    const identifier = parseWalletIdentifier(challenge.identifierKey);
    const verified = await verifyWalletSignature({
      challengeText: challenge.challengeText,
      identifier,
      signature,
    });
    if (!verified) {
      throw new Error("invalid wallet signature");
    }
    await this.store.consumeWalletChallenge(challengeId);
    if (!isDurableIdentifierKind(identifier.kind)) {
      throw new Error(`wallet identifier must be durable: ${identifier.kind}`);
    }
    const authenticatedProfile = await this.authenticateToken(existingToken);
    const profile =
      authenticatedProfile?.profileId
        ? await this.store.linkIdentifier(authenticatedProfile.profileId, identifier)
        : await this.store.createOrBindProfile(identifier);
    if (!profile.profileId) {
      throw new Error("failed to resolve durable wallet profile");
    }
    return this.issueAuthSession(profile, toIdentifierKey(identifier));
  }

  async verifyWalletChallenge(
    challengeId: string,
    signature: string,
    existingToken: string | null | undefined,
  ): Promise<{ profile: ProfileProjection; token: string }> {
    const session = await this.verifyAuthChallenge(challengeId, signature, existingToken);
    return { profile: session.profile, token: session.token };
  }
}
