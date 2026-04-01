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

  test("Scenario: Given running, stopped, and archived sessions When the directory is built Then only running session seats stay in the picker", () => {
    const items = buildActorDirectory({
      sessions: [
        {
          id: "session-active",
          name: "Active reviewer",
          avatar: "reviewer",
          cwd: "/repo/demo",
          workspacePath: "/repo/demo",
          sessionRoot: "/tmp/session-active",
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
          status: "running",
          storageState: "active",
          storeTarget: "global",
        },
        {
          id: "session-stopped",
          name: "Stopped reviewer",
          avatar: "reviewer",
          cwd: "/repo/demo",
          workspacePath: "/repo/demo",
          sessionRoot: "/tmp/session-stopped",
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-01T00:00:00.000Z",
          status: "stopped",
          storageState: "active",
          storeTarget: "global",
        },
        {
          id: "session-archived",
          name: "Old residue",
          avatar: "legacy",
          cwd: "/repo/legacy",
          workspacePath: "/repo/legacy",
          sessionRoot: "/tmp/session-archived",
          createdAt: "2026-03-01T00:00:00.000Z",
          updatedAt: "2026-03-01T00:00:00.000Z",
          status: "stopped",
          storageState: "archived",
          archivedAt: "2026-03-02T00:00:00.000Z",
          storeTarget: "global",
        },
      ],
      authActors: [],
      iconUrls: {
        session: (sessionId) => (sessionId ? `http://127.0.0.1:4591/media/sessions/${sessionId}/icon` : null),
        profile: () => null,
      },
    });

    expect(items).toEqual([
      {
        actorId: "session:session-active",
        actorKind: "session",
        label: "Active reviewer",
        subtitle: "/repo/demo",
        iconUrl: "http://127.0.0.1:4591/media/sessions/session-active/icon",
      },
    ]);
  });
});
