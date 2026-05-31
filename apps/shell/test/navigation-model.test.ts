import type {
  AuthSessionOutput,
  GlobalAvatarCatalogEntry,
  GlobalRoomEntry,
  GlobalTerminalEntry,
} from "@agenter/client-sdk";
import { describe, expect, test } from "bun:test";

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

    expect(rendered.plainText).toContain("shell-7");
    expect(rendered.plainText).toContain("running");
    expect(rendered.plainText).toContain("dev");
    expect(rendered.plainText).toContain("/repo");
    expect(rendered.plainText).toContain("@AAA @BBB");
    expect(typeof rendered.content).not.toBe("string");
    expect(
      typeof rendered.content === "string" ? [] : rendered.content.chunks.map((chunk) => chunk.fg).filter(Boolean),
    ).toHaveLength(9);
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
