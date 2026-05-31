import type {
  AuthSessionOutput,
  GlobalAvatarCatalogEntry,
  GlobalRoomEntry,
  GlobalRoomGrantEntry,
  GlobalTerminalEntry,
} from "@agenter/client-sdk";
import { describe, expect, test } from "bun:test";
import { stringWidth } from "bun";

import {
  buildShellNavigationModel,
  buildShellNavigationShellItems,
  buildShellNavigationTerminalRow,
} from "../src/app-navigation/navigation-model";
import { defaultShellSettings } from "../src/app-room/settings";
import { SHELL_APP_ID } from "../src/app-runtime/app";
import { createAvatarEntry, createRoomEntry, createTerminalEntry } from "./fake-shell-store";

const shellTerminal = (resourceKey: string): GlobalTerminalEntry => ({
  ...createTerminalEntry("terminal-7", {
    appId: SHELL_APP_ID,
    resourceKey,
    resourceKind: "terminal",
    ownerSystem: "terminal-system",
  }),
  configuredTitle: "dev",
  currentTitle: "dev",
  currentPath: "/repo",
  updatedAt: 7,
});

const shellRoom = (resourceKey: string): GlobalRoomEntry => ({
  ...createRoomEntry(
    "room-7",
    {
      appId: SHELL_APP_ID,
      resourceKey,
      resourceKind: "room",
      ownerSystem: "message-system",
    },
    resourceKey,
  ),
  participants: [
    { id: "auth:root-superadmin", label: "root" },
    { id: "auth:AAA", label: "AAA" },
    { id: "auth:BBB", label: "BBB" },
  ],
});

const shellRoomWithoutParticipants = (resourceKey: string): GlobalRoomEntry => ({
  ...shellRoom(resourceKey),
  participants: [],
});

const roomGrant = (participantId: string, label?: string): GlobalRoomGrantEntry => ({
  grantId: `grant:${participantId}`,
  chatId: "room-7",
  participantId: participantId as NonNullable<GlobalRoomGrantEntry["participantId"]>,
  label,
  role: "member",
  accessToken: `token:${participantId}`,
  createdAt: 7,
});

const superadminAuth = (): AuthSessionOutput =>
  ({
    claims: {
      authId: "root-superadmin",
      superadmin: true,
    },
  }) as AuthSessionOutput;

describe("Feature: shell Select Terminal model", () => {
  test("Scenario: Given room participants include current superadmin When building rows Then people mentions exclude superadmin", () => {
    const settings = defaultShellSettings();
    settings.startup.lastAvatarNickname = "AAA";

    const { items } = buildShellNavigationShellItems(
      [shellTerminal("shell-7")],
      settings,
      [shellTerminal("shell-7")],
      [shellRoom("shell-7")],
      superadminAuth(),
    );

    const existing = items.find((item) => item.kind === "shell");
    expect(existing?.peopleMentions).toEqual(["@AAA", "@BBB"]);
    expect(existing?.avatarNickname).toBe("AAA");
    expect(existing?.roomId).toBe("room-7");
  });

  test("Scenario: Given room users are represented by grants When building rows Then people mentions still render", () => {
    const settings = defaultShellSettings();

    const { items } = buildShellNavigationShellItems(
      [shellTerminal("shell-7")],
      settings,
      [shellTerminal("shell-7")],
      [shellRoomWithoutParticipants("shell-7")],
      superadminAuth(),
      new Map([
        [
          "room-7",
          [roomGrant("auth:root-superadmin", "root"), roomGrant("auth:AAA", "AAA"), roomGrant("auth:BBB", "BBB")],
        ],
      ]),
    );

    const existing = items.find((item) => item.kind === "shell");
    expect(existing?.peopleMentions).toEqual(["@AAA", "@BBB"]);
    expect(existing?.rowFields.people).toBe("@AAA, @BBB");
  });

  test("Scenario: Given a structured terminal row When rendered Then fields retain distinct styled chunks", () => {
    const settings = defaultShellSettings();
    const { items } = buildShellNavigationShellItems(
      [shellTerminal("shell-7")],
      settings,
      [shellTerminal("shell-7")],
      [shellRoom("shell-7")],
      superadminAuth(),
    );
    const existing = items.find((item) => item.kind === "shell");
    expect(existing).toBeDefined();

    const rendered = buildShellNavigationTerminalRow(existing!, 80);

    expect(rendered.plainText).toBe("shell-7  /repo  dev  @AAA, @BBB");
    expect(rendered.plainText).not.toContain("running");
    expect(rendered.lines).toHaveLength(1);
    expect(typeof rendered.lines[0]?.content).not.toBe("string");
    expect(
      typeof rendered.lines[0]?.content === "string"
        ? []
        : rendered.lines[0]?.content.chunks.map((chunk) => chunk.fg).filter(Boolean),
    ).toHaveLength(7);
  });

  test("Scenario: Given narrow terminal width When rendering a Terminal row Then fields wrap by field and long fields are clipped", () => {
    const item = {
      kind: "shell" as const,
      shellName: "shell-7",
      terminalId: "terminal-7",
      title: "very-long-pty-title",
      processPhase: "running" as const,
      updatedAt: 7,
      currentTitle: "very-long-pty-title",
      currentPath: "/workspace/very/deep/project",
      roomId: "room-7",
      avatarNickname: "AAA",
      peopleMentions: ["@AAA", "@BBB"],
      rowFields: {
        id: "shell-7",
        pwd: "/workspace/very/deep/project",
        title: "very-long-pty-title",
        people: "@AAA, @BBB",
      },
    };

    const rendered = buildShellNavigationTerminalRow(item, 14);

    expect(rendered.lines.length).toBeGreaterThan(1);
    expect(rendered.plainText).not.toContain("running");
    expect(rendered.lines.some((line) => line.plainText.includes("..."))).toBe(true);
    for (const line of rendered.lines) {
      expect(stringWidth(line.plainText)).toBeLessThanOrEqual(14);
    }
  });

  test("Scenario: Given unsupported legacy resource keys When building the model Then they are not treated as existing Terminal rows", async () => {
    const store = {
      async listGlobalTerminals(): Promise<GlobalTerminalEntry[]> {
        return [shellTerminal("shell-7:terminal-2")];
      },
      async listGlobalTerminalIndex(): Promise<GlobalTerminalEntry[]> {
        return [shellTerminal("shell-7:terminal-2")];
      },
      async listGlobalTerminalHistory(): Promise<GlobalTerminalEntry[]> {
        return [];
      },
      async listGlobalRooms(): Promise<GlobalRoomEntry[]> {
        return [shellRoom("shell-7:terminal-2")];
      },
      async getAuthSession(): Promise<AuthSessionOutput> {
        return superadminAuth();
      },
      async hydrateGlobalAvatarCatalog(): Promise<GlobalAvatarCatalogEntry[]> {
        return [createAvatarEntry("AAA")];
      },
      async createGlobalAvatar(): Promise<GlobalAvatarCatalogEntry> {
        return createAvatarEntry("created");
      },
    };

    const model = await buildShellNavigationModel(store, defaultShellSettings());

    expect(model.shellItems.filter((item) => item.kind === "shell")).toEqual([]);
    expect(model.shellItems[0]).toMatchObject({ kind: "new-shell", shellName: "shell-1" });
  });
});
