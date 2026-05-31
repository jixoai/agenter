import type { GlobalRoomGrantEntry, GlobalTerminalGrantEntry } from "@agenter/client-sdk";
import { describe, expect, test } from "bun:test";

import {
  buildShellAvatarPanelItems,
  defaultShellAvatarRoomRole,
  defaultShellAvatarTerminalRole,
  nextShellAvatarRoomRole,
  nextShellAvatarTerminalRole,
} from "../src/app-room/avatar-panel-model";
import { createAvatarEntry } from "./fake-shell-store";

describe("Feature: shell /avatar panel model", () => {
  test("Scenario: Given Avatar grants When building panel items Then roles remain system grant roles", () => {
    const roomGrant = {
      grantId: "room-grant",
      chatId: "room-1",
      role: "member",
      participantId: "auth:AAA",
      label: "AAA",
      accessToken: "room-token",
      createdAt: 1,
    } satisfies GlobalRoomGrantEntry;
    const terminalGrant = {
      grantId: "terminal-grant",
      terminalId: "terminal-1",
      role: "writer",
      participantId: "auth:AAA",
      label: "AAA",
      accessToken: "terminal-token",
      createdAt: 1,
    } satisfies GlobalTerminalGrantEntry;

    const items = buildShellAvatarPanelItems({
      avatars: [createAvatarEntry("AAA"), createAvatarEntry("shell-assistant")],
      roomGrants: [roomGrant],
      terminalGrants: [terminalGrant],
      excludedActorIds: ["auth:shell-assistant"],
    });

    expect(items).toEqual([
      {
        nickname: "AAA",
        displayName: "AAA",
        actorId: "auth:AAA",
        roomGrantId: "room-grant",
        roomRole: "member",
        terminalGrantId: "terminal-grant",
        terminalRole: "writer",
      },
    ]);
  });

  test("Scenario: Given permission cycling When roles advance Then no Shell-local role names are introduced", () => {
    expect(defaultShellAvatarRoomRole).toBe("member");
    expect(defaultShellAvatarTerminalRole).toBe("writer");
    expect(nextShellAvatarRoomRole(null)).toBe("member");
    expect(nextShellAvatarRoomRole("member")).toBe("readonly");
    expect(nextShellAvatarTerminalRole(null)).toBe("writer");
    expect(nextShellAvatarTerminalRole("writer")).toBe("guard");
  });
});
