import { describe, expect, test } from "bun:test";

import { generatePrincipalKeyPair } from "@agenter/principal-crypto";
import {
  buildManagedInvitationAcceptPayload,
  buildManagedInvitationShareDescriptor,
  digestManagedInvitationPayload,
  hashManagedInvitationToken,
  isManagedInvitationExpired,
  parseManagedInvitationDescriptorInput,
  signManagedInvitationAcceptProof,
  validateManagedInvitationRecipientBinding,
  verifyManagedInvitationAcceptProof,
} from "../src";

describe("Feature: managed seat invitation handshake shared protocol", () => {
  test("Scenario: Given one invitation token When raw token deep link and http wrapper are parsed Then all descriptor forms resolve to the same durable token", () => {
    const descriptor = buildManagedInvitationShareDescriptor({
      resourceKind: "terminal",
      token: "seatinv_1234567890abcdef1234567890abcdef",
      endpoint: {
        authorityUrl: "http://127.0.0.1:4580",
      },
    });

    expect(parseManagedInvitationDescriptorInput(descriptor.token)).toMatchObject({
      token: descriptor.token,
    });
    expect(parseManagedInvitationDescriptorInput(descriptor.deepLink)).toMatchObject({
      token: descriptor.token,
      descriptor: expect.objectContaining({
        endpoint: expect.objectContaining({
          authorityUrl: "http://127.0.0.1:4580",
        }),
      }),
    });
    expect(parseManagedInvitationDescriptorInput(descriptor.httpUrl ?? "")).toMatchObject({
      token: descriptor.token,
      descriptor: expect.objectContaining({
        resourceKind: "terminal",
      }),
    });
  });

  test("Scenario: Given an invited principal When acceptance proof is signed and verified Then the shared payload stays principal-bound and digest-bound", async () => {
    const invitee = generatePrincipalKeyPair();
    const payloadDigest = digestManagedInvitationPayload({ role: "writer" });
    const payload = {
      invitationId: "seat-inv-1",
      resourceKind: "terminal" as const,
      resourceId: "term-1",
      inviteePrincipalId: invitee.principalId,
      payloadDigest,
      expiresAt: Date.now() + 60_000,
    };

    const proof = await signManagedInvitationAcceptProof({
      privateKey: invitee.privateKey,
      payload,
    });

    validateManagedInvitationRecipientBinding({
      expectedInviteePrincipalId: invitee.principalId,
      proof,
    });
    expect(proof.payload).toBe(buildManagedInvitationAcceptPayload(payload));
    expect(await verifyManagedInvitationAcceptProof(proof)).toBe(true);
  });

  test("Scenario: Given a wrong principal proof When recipient binding is checked Then shared validation rejects the mismatch before resource activation", async () => {
    const invitee = generatePrincipalKeyPair();
    const wrong = generatePrincipalKeyPair();
    const proof = await signManagedInvitationAcceptProof({
      privateKey: wrong.privateKey,
      payload: {
        invitationId: "seat-inv-2",
        resourceKind: "message",
        resourceId: "room-1",
        inviteePrincipalId: wrong.principalId,
        payloadDigest: digestManagedInvitationPayload({ role: "member" }),
        expiresAt: Date.now() + 60_000,
      },
    });

    expect(() =>
      validateManagedInvitationRecipientBinding({
        expectedInviteePrincipalId: invitee.principalId,
        proof,
      }),
    ).toThrow("managed invitation proof principal does not match invitation recipient");
  });

  test("Scenario: Given invitation timeout and replacement invalidation helpers When backend law evaluates them Then expiry and handle rotation remain durable facts", () => {
    const tokenA = "seatinv_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const tokenB = "seatinv_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

    expect(hashManagedInvitationToken(tokenA)).not.toBe(hashManagedInvitationToken(tokenB));
    expect(isManagedInvitationExpired({ expiresAt: Date.now() - 1 })).toBe(true);
    expect(isManagedInvitationExpired({ expiresAt: Date.now() + 60_000 })).toBe(false);
  });
});
