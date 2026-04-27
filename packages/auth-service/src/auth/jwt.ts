import { createHmac, timingSafeEqual } from "node:crypto";

import type { AuthSessionClaims } from "../types";

interface JwtHeader {
  alg: "HS256";
  typ: "JWT";
}

interface JwtPayload extends AuthSessionClaims {
  iss: string;
  iat: number;
  exp: number;
}

export interface IssueAuthJwtInput {
  claims: AuthSessionClaims;
  issuer: string;
  secret: string;
  ttlMs: number;
}

export interface VerifiedAuthJwt {
  claims: AuthSessionClaims;
  issuedAt: string;
  expiresAt: string;
}

const trimBase64Padding = (value: string): string => value.replace(/=+$/u, "");

const encodeBase64UrlBytes = (value: Uint8Array): string =>
  trimBase64Padding(Buffer.from(value).toString("base64")).replace(/\+/gu, "-").replace(/\//gu, "_");

const encodeBase64UrlText = (value: string): string => encodeBase64UrlBytes(Uint8Array.from(Buffer.from(value, "utf8")));

const decodeBase64UrlBytes = (value: string): Uint8Array | null => {
  const normalized = value.trim();
  if (!normalized || /[^A-Za-z0-9\-_]/u.test(normalized)) {
    return null;
  }
  const base64 = normalized.replace(/-/gu, "+").replace(/_/gu, "/");
  const paddingLength = (4 - (base64.length % 4)) % 4;
  const padded = `${base64}${"=".repeat(paddingLength)}`;
  try {
    return Uint8Array.from(Buffer.from(padded, "base64"));
  } catch {
    return null;
  }
};

const decodeBase64UrlText = (value: string): string | null => {
  const decoded = decodeBase64UrlBytes(value);
  return decoded ? Buffer.from(decoded).toString("utf8") : null;
};

const signInput = (value: string, secret: string): Uint8Array =>
  Uint8Array.from(createHmac("sha256", secret).update(value, "utf8").digest());

const safeJsonParse = <T>(value: string): T | null => {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

const isValidHeader = (value: JwtHeader | null): value is JwtHeader => value?.alg === "HS256" && value.typ === "JWT";

const isValidPayload = (value: JwtPayload | null): value is JwtPayload =>
  Boolean(
    value &&
      typeof value.authId === "string" &&
      value.authId.length > 0 &&
      typeof value.profileId === "string" &&
      value.profileId.length > 0 &&
      typeof value.admin === "boolean" &&
      typeof value.superadmin === "boolean" &&
      typeof value.iss === "string" &&
      value.iss.length > 0 &&
      typeof value.iat === "number" &&
      Number.isFinite(value.iat) &&
      typeof value.exp === "number" &&
      Number.isFinite(value.exp),
  );

export const issueAuthJwt = (input: IssueAuthJwtInput): { token: string; expiresAt: string } => {
  const issuedAtSeconds = Math.floor(Date.now() / 1000);
  const expiresAtSeconds = issuedAtSeconds + Math.max(1, Math.floor(input.ttlMs / 1000));
  const header: JwtHeader = { alg: "HS256", typ: "JWT" };
  const payload: JwtPayload = {
    ...input.claims,
    iss: input.issuer,
    iat: issuedAtSeconds,
    exp: expiresAtSeconds,
  };
  const encodedHeader = encodeBase64UrlText(JSON.stringify(header));
  const encodedPayload = encodeBase64UrlText(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = encodeBase64UrlBytes(signInput(signingInput, input.secret));
  return {
    token: `${signingInput}.${signature}`,
    expiresAt: new Date(expiresAtSeconds * 1000).toISOString(),
  };
};

export const verifyAuthJwt = (
  token: string,
  input: { issuer: string; secret: string; nowMs?: number },
): VerifiedAuthJwt | null => {
  const parts = token.trim().split(".");
  if (parts.length !== 3) {
    return null;
  }

  const [encodedHeader, encodedPayload, signature] = parts;
  if (!encodedHeader || !encodedPayload || !signature) {
    return null;
  }

  const actualSignature = decodeBase64UrlBytes(signature);
  const expectedSignature = signInput(`${encodedHeader}.${encodedPayload}`, input.secret);
  if (!actualSignature || actualSignature.length !== expectedSignature.length || !timingSafeEqual(actualSignature, expectedSignature)) {
    return null;
  }

  const decodedHeader = decodeBase64UrlText(encodedHeader);
  const decodedPayload = decodeBase64UrlText(encodedPayload);
  if (decodedHeader === null || decodedPayload === null) {
    return null;
  }
  const header = safeJsonParse<JwtHeader>(decodedHeader);
  const payload = safeJsonParse<JwtPayload>(decodedPayload);
  if (!isValidHeader(header) || !isValidPayload(payload) || payload.iss !== input.issuer) {
    return null;
  }

  const nowSeconds = Math.floor((input.nowMs ?? Date.now()) / 1000);
  if (payload.exp <= nowSeconds) {
    return null;
  }

  return {
    claims: {
      authId: payload.authId,
      profileId: payload.profileId,
      admin: payload.admin,
      superadmin: payload.superadmin,
    },
    issuedAt: new Date(payload.iat * 1000).toISOString(),
    expiresAt: new Date(payload.exp * 1000).toISOString(),
  };
};
