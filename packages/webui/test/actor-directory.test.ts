import { describe, expect, test } from "vitest";

import { buildActorDirectory } from "../src/features/collaboration/actor-directory";

describe("Feature: collaboration actor directory", () => {
  test("Scenario: Given an auth actor without an explicit icon projection When the directory is built Then the profile-service fallback icon URL is used", () => {
    const items = buildActorDirectory({
      sessions: [],
      authActors: [
        {
          actorId: "auth:wallet_evm:0xowner",
          actorKind: "auth",
          authId: "wallet_evm:0xowner",
          profileId: "profile-owner",
          label: "Owner",
          subtitle: "wallet_evm:0xowner",
          iconUrl: "",
          identifier: {
            kind: "wallet_evm",
            value: "0xowner",
          },
        },
      ],
      iconUrls: {
        session: (sessionId) => (sessionId ? `http://127.0.0.1:4591/media/sessions/${sessionId}/icon` : null),
        profile: (reference) => (reference ? `http://127.0.0.1:4591/media/profiles/${reference}/icon` : null),
      },
    });

    expect(items).toEqual([
      {
        actorId: "auth:wallet_evm:0xowner",
        actorKind: "auth",
        label: "Owner",
        subtitle: "wallet_evm:0xowner",
        iconUrl: "http://127.0.0.1:4591/media/profiles/profile-owner/icon",
      },
    ]);
  });
});
