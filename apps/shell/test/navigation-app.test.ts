import { createTestRenderer } from "@opentui/core/testing";
import { describe, expect, test } from "bun:test";

import { ShellNavigationApp, type ShellNavigationSelection } from "../src/app-navigation/navigation-app";
import type { ShellNavigationShellItem } from "../src/app-navigation/navigation-model";

const key = (name: string) => ({
  name,
  ctrl: false,
  meta: false,
  shift: false,
  option: false,
  sequence: name === "return" ? "\r" : name,
  raw: name === "return" ? "\r" : name,
  number: false,
  eventType: "press" as const,
  source: "raw" as const,
});

const existingShell: ShellNavigationShellItem = {
  kind: "shell",
  shellName: "shell-7",
  terminalId: "terminal-7",
  title: "dev",
  processPhase: "running",
  updatedAt: 7,
  currentTitle: "dev",
  currentPath: "/repo",
  roomId: "room-7",
  avatarNickname: "AAA",
  peopleMentions: ["@AAA"],
  rowFields: {
    key: "shell-7",
    status: "running",
    title: "dev",
    detail: "/repo",
    people: "@AAA",
  },
};

const newShell: ShellNavigationShellItem = {
  kind: "new-shell",
  shellName: "shell-8",
  title: "New Terminal",
};

describe("Feature: shell entry navigation", () => {
  test("Scenario: Given an existing Terminal row When confirmed Then navigation completes without Avatar step", async () => {
    const setup = await createTestRenderer({ width: 72, height: 12 });
    const completed: ShellNavigationSelection[] = [];
    const app = new ShellNavigationApp({
      renderer: setup.renderer,
      shellItems: [newShell, existingShell],
      defaultShellIndex: 1,
      needsShell: true,
      avatarItems: [],
      defaultAvatarIndex: 0,
      needsAvatar: true,
      createAvatar: async () => undefined,
      onComplete: (selection) => {
        completed.push(selection);
      },
    });
    app.start();
    setup.renderer.keyInput.processParsedKey(key("return"));
    await setup.renderOnce();
    app.dispose();
    setup.renderer.destroy();

    expect(completed).toEqual([
      {
        shellName: "shell-7",
        avatarNickname: "AAA",
        createAvatar: false,
        entryKind: "existing-shell",
        skipBindingGrantEnsure: true,
      },
    ]);
  });

  test("Scenario: Given New Terminal row When confirmed Then navigation still asks for Avatar", async () => {
    const setup = await createTestRenderer({ width: 72, height: 12 });
    let completed: ShellNavigationSelection | null = null;
    const app = new ShellNavigationApp({
      renderer: setup.renderer,
      shellItems: [newShell],
      defaultShellIndex: 0,
      needsShell: true,
      avatarItems: [
        {
          kind: "avatar",
          nickname: "AAA",
          displayName: "AAA",
          classify: null,
          defaultAvatar: false,
        },
      ],
      defaultAvatarIndex: 0,
      needsAvatar: true,
      createAvatar: async () => undefined,
      onComplete: (selection) => {
        completed = selection;
      },
    });
    app.start();
    setup.renderer.keyInput.processParsedKey(key("return"));
    await setup.renderOnce();
    const frame = setup.captureCharFrame();
    app.dispose();
    setup.renderer.destroy();

    expect(completed).toBeNull();
    expect(frame).toContain("Select Avatar");
  });
});
