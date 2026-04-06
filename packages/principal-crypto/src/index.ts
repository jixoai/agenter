import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import { secp256k1 } from "@noble/curves/secp256k1";

import type { Hex } from "viem";
import { recoverMessageAddress } from "viem";
import { generatePrivateKey, privateKeyToAccount, publicKeyToAddress } from "viem/accounts";

export type PrincipalId = `0x${string}`;
export type PrincipalKind = "user" | "avatar" | "room" | "terminal" | "system" | "delegate";
export type PrincipalAlgorithm = "secp256k1";

export interface PrincipalKeyPair {
  principalId: PrincipalId;
  algorithm: PrincipalAlgorithm;
  publicKey: Hex;
  privateKey: Hex;
}

export interface PrincipalSignature {
  principalId: PrincipalId;
  payload: string;
  signature: Hex;
}

export interface SealedEnvelope {
  algorithm: PrincipalAlgorithm;
  senderPrincipalId: PrincipalId;
  senderPublicKey: Hex;
  nonce: Hex;
  ciphertext: Hex;
  tag: Hex;
}

export interface EncryptedPrivateKeyRecord {
  algorithm: PrincipalAlgorithm;
  nonce: Hex;
  ciphertext: Hex;
  tag: Hex;
}

const PRINCIPAL_ID_PATTERN = /^0x[a-f0-9]{40}$/u;
const PRIVATE_KEY_PATTERN = /^0x[a-f0-9]{64}$/u;
const PUBLIC_KEY_PATTERN = /^0x(?:04)?[a-f0-9]{128}$/u;
const HEX_PREFIX_PATTERN = /^0x/u;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const toLowerHex = (value: string): Hex => (`0x${value.replace(HEX_PREFIX_PATTERN, "").toLowerCase()}` as Hex);

const toBuffer = (value: Hex): Buffer => Buffer.from(value.slice(2), "hex");
const toHex = (value: Uint8Array | Buffer): Hex => `0x${Buffer.from(value).toString("hex")}` as Hex;

const assertHexPattern = (value: string, pattern: RegExp, label: string): void => {
  if (!pattern.test(value)) {
    throw new Error(`invalid ${label}`);
  }
};

const deriveAesKey = (secret: string): Buffer => createHash("sha256").update(secret).digest();

const deriveSharedKey = (input: { privateKey: Hex; publicKey: Hex }): Buffer => {
  const sharedPoint = secp256k1.getSharedSecret(
    toBuffer(normalizePrincipalPrivateKey(input.privateKey)),
    toBuffer(normalizePrincipalPublicKey(input.publicKey)),
    false,
  );
  const sharedXCoordinate = sharedPoint.slice(1, 33);
  return createHash("sha256").update(sharedXCoordinate).digest();
};

const encryptBytes = (input: { key: Buffer; plaintext: Uint8Array; nonce?: Uint8Array }): EncryptedPrivateKeyRecord => {
  const iv = input.nonce ? Buffer.from(input.nonce) : randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", input.key, iv);
  const ciphertext = Buffer.concat([cipher.update(Buffer.from(input.plaintext)), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    algorithm: "secp256k1",
    nonce: toHex(iv),
    ciphertext: toHex(ciphertext),
    tag: toHex(tag),
  };
};

const decryptBytes = (input: { key: Buffer; nonce: Hex; ciphertext: Hex; tag: Hex }): Uint8Array => {
  const decipher = createDecipheriv("aes-256-gcm", input.key, toBuffer(input.nonce));
  decipher.setAuthTag(toBuffer(input.tag));
  return new Uint8Array(Buffer.concat([decipher.update(toBuffer(input.ciphertext)), decipher.final()]));
};

export const isPrincipalId = (value: string): value is PrincipalId => PRINCIPAL_ID_PATTERN.test(value);

export const normalizePrincipalId = (value: string): PrincipalId => {
  const normalized = value.trim().toLowerCase();
  if (!isPrincipalId(normalized)) {
    throw new Error(`invalid principal id: ${value}`);
  }
  return normalized;
};

export const normalizePrincipalPrivateKey = (value: string): Hex => {
  const normalized = value.trim().toLowerCase();
  assertHexPattern(normalized, PRIVATE_KEY_PATTERN, "principal private key");
  return normalized as Hex;
};

export const normalizePrincipalPublicKey = (value: string): Hex => {
  const normalized = value.trim().toLowerCase();
  assertHexPattern(normalized, PUBLIC_KEY_PATTERN, "principal public key");
  return normalized as Hex;
};

export const principalIdFromPrivateKey = (privateKey: Hex): PrincipalId => {
  const account = privateKeyToAccount(normalizePrincipalPrivateKey(privateKey));
  return normalizePrincipalId(account.address);
};

export const principalIdFromPublicKey = (publicKey: Hex): PrincipalId =>
  normalizePrincipalId(publicKeyToAddress(normalizePrincipalPublicKey(publicKey)));

export const generatePrincipalKeyPair = (privateKey?: Hex): PrincipalKeyPair => {
  const normalizedPrivateKey = privateKey ? normalizePrincipalPrivateKey(privateKey) : generatePrivateKey();
  const account = privateKeyToAccount(normalizedPrivateKey);
  return {
    principalId: normalizePrincipalId(account.address),
    algorithm: "secp256k1",
    publicKey: normalizePrincipalPublicKey(account.publicKey),
    privateKey: normalizedPrivateKey,
  };
};

export const signPrincipalPayload = async (input: { privateKey: Hex; payload: string }): Promise<PrincipalSignature> => {
  const account = privateKeyToAccount(normalizePrincipalPrivateKey(input.privateKey));
  return {
    principalId: normalizePrincipalId(account.address),
    payload: input.payload,
    signature: toLowerHex(await account.signMessage({ message: input.payload })),
  };
};

export const verifyPrincipalSignature = async (input: {
  principalId: PrincipalId;
  payload: string;
  signature: Hex;
}): Promise<boolean> => {
  const recovered = await recoverMessageAddress({
    message: input.payload,
    signature: input.signature,
  });
  return normalizePrincipalId(recovered) === normalizePrincipalId(input.principalId);
};

export const sealToPrincipal = (input: {
  senderPrivateKey: Hex;
  recipientPublicKey: Hex;
  plaintext: string;
}): SealedEnvelope => {
  const sender = generatePrincipalKeyPair(input.senderPrivateKey);
  const key = deriveSharedKey({
    privateKey: sender.privateKey,
    publicKey: normalizePrincipalPublicKey(input.recipientPublicKey),
  });
  const encrypted = encryptBytes({
    key,
    plaintext: textEncoder.encode(input.plaintext),
  });
  return {
    algorithm: "secp256k1",
    senderPrincipalId: sender.principalId,
    senderPublicKey: sender.publicKey,
    nonce: encrypted.nonce,
    ciphertext: encrypted.ciphertext,
    tag: encrypted.tag,
  };
};

export const openSealedEnvelope = (input: {
  recipientPrivateKey: Hex;
  envelope: SealedEnvelope;
}): string => {
  const key = deriveSharedKey({
    privateKey: normalizePrincipalPrivateKey(input.recipientPrivateKey),
    publicKey: normalizePrincipalPublicKey(input.envelope.senderPublicKey),
  });
  const plaintext = decryptBytes({
    key,
    nonce: input.envelope.nonce,
    ciphertext: input.envelope.ciphertext,
    tag: input.envelope.tag,
  });
  return textDecoder.decode(plaintext);
};

export const encryptPrivateKeyAtRest = (input: { privateKey: Hex; secret: string }): EncryptedPrivateKeyRecord =>
  encryptBytes({
    key: deriveAesKey(input.secret),
    plaintext: textEncoder.encode(normalizePrincipalPrivateKey(input.privateKey)),
  });

export const decryptPrivateKeyAtRest = (input: {
  record: EncryptedPrivateKeyRecord;
  secret: string;
}): Hex =>
  normalizePrincipalPrivateKey(
    textDecoder.decode(
      decryptBytes({
        key: deriveAesKey(input.secret),
        nonce: input.record.nonce,
        ciphertext: input.record.ciphertext,
        tag: input.record.tag,
      }),
    ),
  );
