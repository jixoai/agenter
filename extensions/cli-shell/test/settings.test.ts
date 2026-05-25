import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  defaultCliShellKeybindings,
  defaultCliShellSettings,
  parseCliShellKeybindings,
  parseCliShellSettings,
  readCliShellKeybindings,
  readCliShellSettings,
  saveCliShellKeybindings,
  saveCliShellSettings,
} from "../src/tui/settings";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })));
});

describe("Feature: cli-shell product settings", () => {
  test("Scenario: Given settings file is missing or empty When cli-shell parses settings Then it falls back to the default Chat layout", () => {
    expect(parseCliShellSettings("")).toEqual(defaultCliShellSettings());
    expect(parseCliShellSettings(undefined)).toEqual(defaultCliShellSettings());
  });

  test("Scenario: Given settings contain a persisted Chat default layout When parsed Then cli-shell uses that layout for future Chat reopen", () => {
    expect(parseCliShellSettings(JSON.stringify({ chat: { defaultLayout: "left" } })).chat.defaultLayout).toBe("left");
    expect(parseCliShellSettings(JSON.stringify({ chat: { defaultLayout: "right" } })).chat.defaultLayout).toBe("right");
    expect(parseCliShellSettings(JSON.stringify({ chat: { defaultLayout: "cover" } })).chat.defaultLayout).toBe("cover");
  });

  test("Scenario: Given settings contain startup selection When parsed Then cli-shell remembers the last selected Shell and Avatar", () => {
    expect(
      parseCliShellSettings(
        JSON.stringify({
          startup: {
            lastShellName: " shell-7 ",
            lastAvatarNickname: " bangeel ",
          },
        }),
      ).startup,
    ).toEqual({
      lastShellName: "shell-7",
      lastAvatarNickname: "bangeel",
    });
  });

  test("Scenario: Given keybindings file is missing or invalid When cli-shell parses keybindings Then it falls back to product defaults", () => {
    expect(parseCliShellKeybindings("")).toEqual(defaultCliShellKeybindings());
    expect(parseCliShellKeybindings("{not-json")).toEqual(defaultCliShellKeybindings());
  });

  test("Scenario: Given keybindings override textarea submit and newline When parsed Then cli-shell keeps the override while preserving other defaults", () => {
    const parsed = parseCliShellKeybindings(
      JSON.stringify({
        textarea: {
          submit: ["ctrl+enter"],
          newline: ["return"],
        },
      }),
    );

    expect(parsed.textarea?.submit).toEqual(["ctrl+enter"]);
    expect(parsed.textarea?.newline).toEqual(["return"]);
    expect(parsed.textarea?.undo).toEqual(defaultCliShellKeybindings().textarea?.undo);
  });

  test("Scenario: Given cli-shell product config files are missing When read from disk Then product config falls back to durable defaults", async () => {
    const dir = await mkdtemp(join(tmpdir(), "cli-shell-settings-"));
    tempDirs.push(dir);

    expect(await readCliShellSettings({ baseDir: dir })).toEqual(defaultCliShellSettings());
    expect(await readCliShellKeybindings({ baseDir: dir })).toEqual(defaultCliShellKeybindings());
  });

  test("Scenario: Given cli-shell persists Chat layout and keybindings When read back from disk Then the saved product files become the local truth", async () => {
    const dir = await mkdtemp(join(tmpdir(), "cli-shell-settings-"));
    tempDirs.push(dir);

    await saveCliShellSettings(
      {
        ...defaultCliShellSettings(),
        chat: {
          defaultLayout: "left",
        },
        startup: {
          lastShellName: "shell-5",
          lastAvatarNickname: "bangeel",
        },
      },
      { baseDir: dir },
    );
    await saveCliShellKeybindings(
      {
        textarea: {
          submit: ["ctrl+return"],
        },
      },
      { baseDir: dir },
    );

    const settings = await readCliShellSettings({ baseDir: dir });
    expect(settings.chat.defaultLayout).toBe("left");
    expect(settings.startup).toEqual({
      lastShellName: "shell-5",
      lastAvatarNickname: "bangeel",
    });
    expect((await readCliShellKeybindings({ baseDir: dir })).textarea?.submit).toEqual(["ctrl+return"]);
  });
});
