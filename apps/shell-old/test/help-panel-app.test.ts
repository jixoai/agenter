import { afterEach, describe, expect, test } from "bun:test";
import { createTestRenderer, type TestRenderer } from "@opentui/core/testing";

import { startCliShellHelpPanelApp } from "../src/tui/help-panel-app";

type TestSetup = Awaited<ReturnType<typeof createTestRenderer>>;

let setup: TestSetup | null = null;

afterEach(() => {
  setup?.renderer.destroy();
  setup = null;
});

const startHelpPanel = async (input: { onQuit?: () => void } = {}): Promise<TestSetup> => {
  setup = await createTestRenderer({ width: 82, height: 36, useMouse: true });
  await startCliShellHelpPanelApp({
    shellName: "shell-5",
    avatarNickname: "bangeel",
    renderer: setup.renderer as TestRenderer,
    onQuit: input.onQuit,
  });
  await setup.renderOnce();
  return setup;
};

describe("Feature: cli-shell OpenTUI help panel", () => {
  test("Scenario: Given Help is opened When the panel renders Then it shows the app controls as a real TUI surface", async () => {
    const help = await startHelpPanel();

    expect(help.captureCharFrame()).toContain("cli-shell Help | shell-5 | @bangeel");
    expect(help.captureCharFrame()).toContain("Click managed:on/off, Help, or Chat");
    expect(help.captureCharFrame()).toContain("cover Chat, tmux popup owns mouse focus");
    expect(help.captureCharFrame()).toContain("Ctrl+b, then c  toggle Chat");
    expect(help.captureCharFrame()).toContain("Esc/q/Ctrl+Q close");
  });

  test("Scenario: Given Help is visible When q is pressed Then the panel asks the host to close", async () => {
    let closed = false;
    const help = await startHelpPanel({
      onQuit: () => {
        closed = true;
      },
    });

    help.mockInput.pressKey("q");
    await help.renderOnce();

    expect(closed).toBe(true);
  });
});
