import { createHash, randomUUID } from "node:crypto";

import {
  normalizePrincipalId,
  normalizePrincipalPrivateKey,
  normalizePrincipalPublicKey,
  signPrincipalPayload,
  verifyPrincipalSignature,
  type PrincipalId,
  type PrincipalSignature,
} from "@agenter/principal-crypto";
import { z } from "zod";

export type ManagedInvitationStatus = "pending" | "accepted" | "revoked" | "expired";
export type ManagedInvitationResourceKind = "terminal" | "message";

export interface ManagedInvitationEndpointDescriptor {
  authorityUrl: string;
  trpcPath?: string;
  acceptPath?: string;
}

export interface ManagedInvitationShareDescriptor {
  resourceKind: ManagedInvitationResourceKind;
  token: string;
  endpoint?: ManagedInvitationEndpointDescriptor;
  deepLink: string;
  httpUrl?: string;
}

export interface ManagedInvitationRecordBase<TPayload> {
  invitationId: string;
  resourceKind: ManagedInvitationResourceKind;
  resourceId: string;
  inviterPrincipalId: PrincipalId;
  inviteePrincipalId: PrincipalId;
  status: ManagedInvitationStatus;
  payload: TPayload;
  payloadDigest: string;
  tokenHash: string;
  descriptor: ManagedInvitationShareDescriptor;
  createdAt: number;
  expiresAt: number;
  acceptedAt?: number;
  revokedAt?: number;
  supersededByInvitationId?: string;
}

export interface ManagedInvitationAcceptProof {
  inviteePrincipalId: PrincipalId;
  payload: string;
  signature: PrincipalSignature["signature"];
}

export interface ManagedInvitationAcceptProofInput {
  invitationId: string;
  resourceKind: ManagedInvitationResourceKind;
  resourceId: string;
  inviteePrincipalId: PrincipalId;
  payloadDigest: string;
  expiresAt: number;
}

const TOKEN_PATTERN = /^[A-Za-z0-9._-]{24,256}$/u;
const TOKEN_PREFIX = "seatinv_";
const HTTP_TOKEN_KEYS = ["token", "invitationToken", "seatToken"] as const;
const DEFAULT_TRPC_PATH = "/trpc";
const DEFAULT_ACCEPT_PATH = "/trpc/seat.accept";

const endpointDescriptorSchema = z.object({
  authorityUrl: z.string().trim().url(),
  trpcPath: z.string().trim().min(1).optional(),
  acceptPath: z.string().trim().min(1).optional(),
});

const shareDescriptorSchema = z.object({
  resourceKind: z.enum(["terminal", "message"]),
  token: z.string().trim().min(1),
  endpoint: endpointDescriptorSchema.optional(),
  deepLink: z.string().trim().min(1),
  httpUrl: z.string().trim().url().optional(),
});
const shareDescriptorProjectionSchema = z.object({
  resourceKind: z.enum(["terminal", "message"]),
  token: z.string().trim().min(1),
  endpoint: endpointDescriptorSchema.optional(),
});

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/u, "");

const normalizeToken = (token: string): string => {
  const normalized = token.trim();
  if (!TOKEN_PATTERN.test(normalized)) {
    throw new Error("invalid managed invitation token");
  }
  return normalized;
};

const encodeDescriptorProjection = (descriptor: {
  resourceKind: ManagedInvitationResourceKind;
  token: string;
  endpoint?: ManagedInvitationEndpointDescriptor;
}): string => Buffer.from(JSON.stringify(descriptor), "utf8").toString("base64url");

const decodeDescriptorProjection = (value: string): {
  resourceKind: ManagedInvitationResourceKind;
  token: string;
  endpoint?: ManagedInvitationEndpointDescriptor;
} => shareDescriptorProjectionSchema.parse(JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as unknown);

export const hashManagedInvitationToken = (token: string): string =>
  createHash("sha256").update(normalizeToken(token)).digest("hex");

export const digestManagedInvitationPayload = (payload: unknown): string =>
  createHash("sha256").update(JSON.stringify(payload)).digest("hex");

export const createManagedInvitationId = (): string => `seat-inv-${randomUUID()}`;

export const createManagedInvitationToken = (): string => `${TOKEN_PREFIX}${randomUUID().replace(/-/g, "")}`;

export const buildManagedInvitationAcceptPayload = (input: ManagedInvitationAcceptProofInput): string =>
  JSON.stringify({
    type: "managed-seat-invitation-accept",
    version: 1,
    invitationId: input.invitationId,
    resourceKind: input.resourceKind,
    resourceId: input.resourceId,
    inviteePrincipalId: normalizePrincipalId(input.inviteePrincipalId),
    payloadDigest: input.payloadDigest,
    expiresAt: input.expiresAt,
  });

export const signManagedInvitationAcceptProof = async (input: {
  privateKey: string;
  payload: ManagedInvitationAcceptProofInput;
}): Promise<ManagedInvitationAcceptProof> => {
  const signature = await signPrincipalPayload({
    privateKey: normalizePrincipalPrivateKey(input.privateKey),
    payload: buildManagedInvitationAcceptPayload(input.payload),
  });
  return {
    inviteePrincipalId: normalizePrincipalId(signature.principalId),
    payload: signature.payload,
    signature: signature.signature,
  };
};

export const verifyManagedInvitationAcceptProof = async (
  input: ManagedInvitationAcceptProof,
): Promise<boolean> =>
  await verifyPrincipalSignature({
    principalId: normalizePrincipalId(input.inviteePrincipalId),
    payload: input.payload,
    signature: input.signature,
  });

export const buildManagedInvitationDeepLink = (input: {
  resourceKind: ManagedInvitationResourceKind;
  token: string;
  endpoint?: ManagedInvitationEndpointDescriptor;
}): string => {
  const query = new URLSearchParams();
  const token = normalizeToken(input.token);
  query.set("token", token);
  if (input.endpoint) {
    query.set(
      "descriptor",
      encodeDescriptorProjection({
        resourceKind: input.resourceKind,
        token,
        endpoint: input.endpoint,
      }),
    );
  }
  return `${input.resourceKind}://join?${query.toString()}`;
};

export const buildManagedInvitationHttpUrl = (input: {
  resourceKind: ManagedInvitationResourceKind;
  token: string;
  endpoint: ManagedInvitationEndpointDescriptor;
}): string => {
  const token = normalizeToken(input.token);
  const base = new URL(trimTrailingSlash(input.endpoint.authorityUrl));
  base.pathname = input.endpoint.acceptPath ?? DEFAULT_ACCEPT_PATH;
  base.searchParams.set("token", token);
  base.searchParams.set("resourceKind", input.resourceKind);
  base.searchParams.set(
    "descriptor",
    encodeDescriptorProjection({
      resourceKind: input.resourceKind,
      token,
      endpoint: input.endpoint,
    }),
  );
  return base.toString();
};

export const buildManagedInvitationShareDescriptor = <const TResourceKind extends ManagedInvitationResourceKind>(input: {
  resourceKind: TResourceKind;
  token: string;
  endpoint?: ManagedInvitationEndpointDescriptor;
}): ManagedInvitationShareDescriptor & { resourceKind: TResourceKind } => {
  const token = normalizeToken(input.token);
  const endpoint = input.endpoint
    ? {
        authorityUrl: trimTrailingSlash(input.endpoint.authorityUrl),
        trpcPath: input.endpoint.trpcPath ?? DEFAULT_TRPC_PATH,
        acceptPath: input.endpoint.acceptPath ?? DEFAULT_ACCEPT_PATH,
      }
    : undefined;
  const deepLink = buildManagedInvitationDeepLink({
    resourceKind: input.resourceKind,
    token,
    endpoint,
  });
  const descriptor: ManagedInvitationShareDescriptor & { resourceKind: TResourceKind } = {
    resourceKind: input.resourceKind,
    token,
    endpoint,
    deepLink,
    httpUrl: endpoint
      ? buildManagedInvitationHttpUrl({
          resourceKind: input.resourceKind,
          token,
          endpoint,
        })
      : undefined,
  };
  return descriptor;
};

const resolveTokenFromDeepLink = (input: string): { token: string; descriptor?: ManagedInvitationShareDescriptor } => {
  const url = new URL(input);
  const token = url.searchParams.get("token");
  if (!token) {
    throw new Error("managed invitation deep link missing token");
  }
  const descriptorPayload = url.searchParams.get("descriptor");
  return {
    token: normalizeToken(token),
    descriptor: descriptorPayload ? buildManagedInvitationShareDescriptor(decodeDescriptorProjection(descriptorPayload)) : undefined,
  };
};

const resolveTokenFromHttpUrl = (input: string): { token: string; descriptor?: ManagedInvitationShareDescriptor } => {
  const url = new URL(input);
  for (const key of HTTP_TOKEN_KEYS) {
    const value = url.searchParams.get(key);
    if (value) {
      const descriptorPayload = url.searchParams.get("descriptor");
      return {
        token: normalizeToken(value),
        descriptor: descriptorPayload
          ? buildManagedInvitationShareDescriptor(decodeDescriptorProjection(descriptorPayload))
          : undefined,
      };
    }
  }
  throw new Error("managed invitation http wrapper missing token");
};

export const parseManagedInvitationDescriptorInput = (
  input: string,
): {
  token: string;
  descriptor?: ManagedInvitationShareDescriptor;
} => {
  const trimmed = input.trim();
  if (trimmed.startsWith("terminal://") || trimmed.startsWith("message://")) {
    return resolveTokenFromDeepLink(trimmed);
  }
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return resolveTokenFromHttpUrl(trimmed);
  }
  return {
    token: normalizeToken(trimmed),
  };
};

export const isManagedInvitationExpired = (input: { expiresAt: number; now?: number }): boolean =>
  (input.now ?? Date.now()) >= input.expiresAt;

export const normalizeManagedInvitationEndpointDescriptor = (
  input: ManagedInvitationEndpointDescriptor,
): ManagedInvitationEndpointDescriptor => ({
  authorityUrl: trimTrailingSlash(endpointDescriptorSchema.parse(input).authorityUrl),
  trpcPath: input.trpcPath ?? DEFAULT_TRPC_PATH,
  acceptPath: input.acceptPath ?? DEFAULT_ACCEPT_PATH,
});

export const validateManagedInvitationRecipientBinding = (input: {
  expectedInviteePrincipalId: PrincipalId;
  proof: ManagedInvitationAcceptProof;
}): void => {
  if (normalizePrincipalId(input.expectedInviteePrincipalId) !== normalizePrincipalId(input.proof.inviteePrincipalId)) {
    throw new Error("managed invitation proof principal does not match invitation recipient");
  }
};

export const normalizeManagedInvitationPublicKey = (value: string): string =>
  normalizePrincipalPublicKey(value);
