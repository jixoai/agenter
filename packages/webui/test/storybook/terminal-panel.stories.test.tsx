import { composeStories } from "@storybook/react-vite";
import { describe, expect, test, vi } from "vitest";

import * as stories from "../../src/features/terminal/TerminalPanel.stories";

const { EmbeddedSnapshotFallback, NarrowViewportSnapshotFallback, LifecycleControls } = composeStories(stories);

describe("Feature: Storybook DOM contract for terminal panel", () => {
  test("Scenario: Given an embedded terminal story When rendering in the browser Then the standalone renderer host mounts with renderer-owned scrolling", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      await EmbeddedSnapshotFallback.run();
    } finally {
      const changeInUpdateWarnings = warnSpy.mock.calls.filter(([message]) =>
        String(message).includes("change-in-update"),
      );
      warnSpy.mockRestore();
      expect(changeInUpdateWarnings).toHaveLength(0);
    }
  });

  test("Scenario: Given a narrow embedded terminal story When rendering in the browser Then the same renderer contract holds without reintroducing outer scrolling", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      await NarrowViewportSnapshotFallback.run();
    } finally {
      const changeInUpdateWarnings = warnSpy.mock.calls.filter(([message]) =>
        String(message).includes("change-in-update"),
      );
      warnSpy.mockRestore();
      expect(changeInUpdateWarnings).toHaveLength(0);
    }
  });

  test("Scenario: Given terminal lifecycle controls When admin creates, focuses, and deletes runtime terminals Then corresponding control-plane callbacks are triggered", async () => {
    await LifecycleControls.run();
  });
});
