import { describe, expect, test } from "bun:test";

import {
  decryptPrivateKeyAtRest,
  encryptPrivateKeyAtRest,
  generatePrincipalKeyPair,
  isPrincipalId,
  openSealedEnvelope,
  principalIdFromPublicKey,
  sealToPrincipal,
  signPrincipalPayload,
  verifyPrincipalSignature,
} from "../src/index";

describe("Feature: principal crypto primitives", () => {
  test("Scenario: Given a generated principal When deriving ids from its public key Then the principal id stays stable", () => {
    const principal = generatePrincipalKeyPair();
    expect(isPrincipalId(principal.principalId)).toBeTrue();
    expect(principalIdFromPublicKey(principal.publicKey)).toBe(principal.principalId);
  });

  test("Scenario: Given a signed payload When it is verified Then the recovered principal matches the signer", async () => {
    const principal = generatePrincipalKeyPair();
    const signed = await signPrincipalPayload({
      privateKey: principal.privateKey,
      payload: JSON.stringify({ action: "ping", timestamp: 1 }),
    });
    expect(
      await verifyPrincipalSignature({
        principalId: principal.principalId,
        payload: signed.payload,
        signature: signed.signature,
      }),
    ).toBeTrue();
  });

  test("Scenario: Given sender and recipient principals When a payload is sealed Then only the recipient can open it", () => {
    const sender = generatePrincipalKeyPair();
    const recipient = generatePrincipalKeyPair();
    const envelope = sealToPrincipal({
      senderPrivateKey: sender.privateKey,
      recipientPublicKey: recipient.publicKey,
      plaintext: "hello room",
    });
    expect(openSealedEnvelope({ recipientPrivateKey: recipient.privateKey, envelope })).toBe("hello room");
  });

  test("Scenario: Given a managed private key When stored at rest Then it can be decrypted by the same secret", () => {
    const principal = generatePrincipalKeyPair();
    const record = encryptPrivateKeyAtRest({
      privateKey: principal.privateKey,
      secret: "managed-root-secret",
    });
    expect(
      decryptPrivateKeyAtRest({
        record,
        secret: "managed-root-secret",
      }),
    ).toBe(principal.privateKey);
  });
});
