import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type { ProfileProjection } from "../types";
import type { ProfileStore } from "../store/profile-store";

export type RegistrationOptionsJson = Awaited<ReturnType<typeof generateRegistrationOptions>>;
export type AuthenticationOptionsJson = Awaited<ReturnType<typeof generateAuthenticationOptions>>;
export type RegistrationResponseJson = Parameters<typeof verifyRegistrationResponse>[0]["response"];
export type AuthenticationResponseJson = Parameters<typeof verifyAuthenticationResponse>[0]["response"];
type VerificationCredential = Parameters<typeof verifyAuthenticationResponse>[0]["credential"];
type RegistrationExcludeCredential = NonNullable<Parameters<typeof generateRegistrationOptions>[0]["excludeCredentials"]>[number];
type AuthenticationAllowCredential = NonNullable<Parameters<typeof generateAuthenticationOptions>[0]["allowCredentials"]>[number];
type AuthenticatorTransport = NonNullable<VerificationCredential["transports"]>[number];

const AUTHENTICATOR_TRANSPORTS = new Set<AuthenticatorTransport>([
  "ble",
  "cable",
  "hybrid",
  "internal",
  "nfc",
  "smart-card",
  "usb",
]);

const isAuthenticatorTransport = (value: string): value is AuthenticatorTransport => AUTHENTICATOR_TRANSPORTS.has(value as AuthenticatorTransport);

const webAuthnTicketExpiresAt = (): string => new Date(Date.now() + 10 * 60_000).toISOString();

const toOwnedUint8Array = (value: Uint8Array): Uint8Array<ArrayBuffer> => {
  const buffer = new ArrayBuffer(value.byteLength);
  new Uint8Array(buffer).set(value);
  return new Uint8Array(buffer);
};

const toCredentialDescriptor = (input: VerificationCredential): RegistrationExcludeCredential & AuthenticationAllowCredential => ({
  id: input.id,
  transports: input.transports,
});

const toVerificationCredential = (input: {
  credentialId: string;
  publicKey: Uint8Array;
  counter: number;
  transports: string[];
}): VerificationCredential => ({
  id: input.credentialId,
  publicKey: toOwnedUint8Array(input.publicKey),
  counter: input.counter,
  transports: input.transports.filter(isAuthenticatorTransport),
});

export interface ProfileWebAuthnControlPlaneOptions {
  store: ProfileStore;
  webauthnOrigin: string;
  webauthnRpId: string;
  webauthnRpName: string;
}

export class ProfileWebAuthnControlPlane {
  private readonly textEncoder = new TextEncoder();

  constructor(private readonly options: ProfileWebAuthnControlPlaneOptions) {}

  async createRegistrationTicket(profileId: string): Promise<{ ticketId: string; expiresAt: string }> {
    const expiresAt = webAuthnTicketExpiresAt();
    const ticketId = await this.options.store.createWebAuthnTicket(profileId, "register", "pending", expiresAt);
    return { ticketId, expiresAt };
  }

  async createRegistrationOptions(ticketId: string): Promise<{
    ticketId: string;
    expiresAt: string;
    options: RegistrationOptionsJson;
    profile: ProfileProjection;
  }> {
    const ticket = await this.options.store.getWebAuthnTicket(ticketId);
    if (!ticket || ticket.flowKind !== "register") {
      throw new Error("webauthn registration ticket not found");
    }
    const profile = await this.options.store.getProfileById(ticket.profileId);
    if (!profile) {
      throw new Error(`profile not found for registration ticket: ${ticket.profileId}`);
    }
    const credentials = await this.options.store.listWebAuthnCredentials(profile.profileId!);
    const options = await generateRegistrationOptions({
      rpID: this.options.webauthnRpId,
      rpName: this.options.webauthnRpName,
      userID: toOwnedUint8Array(this.textEncoder.encode(profile.profileId!)),
      userName: profile.identifiers[0]?.value ?? profile.profileId!,
      userDisplayName: profile.metadata.displayName ?? profile.metadata.nickname ?? "",
      excludeCredentials: credentials.map((credential) =>
        toCredentialDescriptor(toVerificationCredential(credential)),
      ),
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
      },
    });
    const expiresAt = webAuthnTicketExpiresAt();
    await this.options.store.updateWebAuthnTicketChallenge(ticketId, options.challenge, expiresAt);
    return { ticketId, expiresAt, options, profile };
  }

  async verifyRegistration(
    ticketId: string,
    response: RegistrationResponseJson,
  ): Promise<{ profile: ProfileProjection; token: string }> {
    const ticket = await this.options.store.getWebAuthnTicket(ticketId);
    if (!ticket || ticket.flowKind !== "register" || ticket.challenge === "pending") {
      throw new Error("webauthn registration ticket not ready");
    }
    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: ticket.challenge,
      expectedOrigin: this.options.webauthnOrigin,
      expectedRPID: this.options.webauthnRpId,
    });
    if (!verification.verified) {
      throw new Error("webauthn registration verification failed");
    }
    await this.options.store.putWebAuthnCredential({
      credentialId: verification.registrationInfo.credential.id,
      profileId: ticket.profileId,
      publicKey: toOwnedUint8Array(verification.registrationInfo.credential.publicKey),
      counter: verification.registrationInfo.credential.counter,
      transports: verification.registrationInfo.credential.transports ?? [],
      deviceType: verification.registrationInfo.credentialDeviceType,
      backedUp: verification.registrationInfo.credentialBackedUp,
    });
    await this.options.store.consumeWebAuthnTicket(ticketId);
    const token = await this.options.store.issueAuthToken(ticket.profileId);
    const profile = await this.options.store.getProfileById(ticket.profileId);
    if (!profile) {
      throw new Error(`profile not found after webauthn registration: ${ticket.profileId}`);
    }
    return { profile, token };
  }

  async createAuthenticationOptions(profile: ProfileProjection): Promise<{
    ticketId: string;
    expiresAt: string;
    options: AuthenticationOptionsJson;
    profile: ProfileProjection;
  }> {
    if (!profile.profileId) {
      throw new Error("virtual profiles cannot authenticate with webauthn");
    }
    const credentials = await this.options.store.listWebAuthnCredentials(profile.profileId);
    if (credentials.length === 0) {
      throw new Error("no webauthn credentials registered for profile");
    }
    const options = await generateAuthenticationOptions({
      rpID: this.options.webauthnRpId,
      allowCredentials: credentials.map((credential) => toCredentialDescriptor(toVerificationCredential(credential))),
      userVerification: "preferred",
    });
    const expiresAt = webAuthnTicketExpiresAt();
    const ticketId = await this.options.store.createWebAuthnTicket(profile.profileId, "authenticate", options.challenge, expiresAt);
    return { ticketId, expiresAt, options, profile };
  }

  async verifyAuthentication(
    ticketId: string,
    response: AuthenticationResponseJson,
  ): Promise<{ profile: ProfileProjection; token: string }> {
    const ticket = await this.options.store.getWebAuthnTicket(ticketId);
    if (!ticket || ticket.flowKind !== "authenticate") {
      throw new Error("webauthn authentication ticket not found");
    }
    const credential = await this.options.store.getWebAuthnCredential(response.id);
    if (!credential || credential.profileId !== ticket.profileId) {
      throw new Error("webauthn credential not found");
    }
    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: ticket.challenge,
      expectedOrigin: this.options.webauthnOrigin,
      expectedRPID: this.options.webauthnRpId,
      credential: toVerificationCredential(credential),
    });
    if (!verification.verified) {
      throw new Error("webauthn authentication verification failed");
    }
    await this.options.store.updateWebAuthnCredentialCounter({
      credentialId: credential.credentialId,
      counter: verification.authenticationInfo.newCounter,
      backedUp: verification.authenticationInfo.credentialBackedUp,
    });
    await this.options.store.consumeWebAuthnTicket(ticketId);
    const token = await this.options.store.issueAuthToken(ticket.profileId);
    const profile = await this.options.store.getProfileById(ticket.profileId);
    if (!profile) {
      throw new Error(`profile not found after webauthn authentication: ${ticket.profileId}`);
    }
    return { profile, token };
  }
}
