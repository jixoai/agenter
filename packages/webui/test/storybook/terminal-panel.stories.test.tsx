import { composeStories } from "@storybook/react-vite";
import { describe, test } from "vitest";

import * as stories from "../../src/features/terminal/TerminalPanel.stories";

const { EmbeddedSnapshotFallback, NarrowViewportSnapshotFallback } = composeStories(stories);

describe("Feature: Storybook DOM contract for terminal panel", () => {
  test("Scenario: Given an embedded terminal story When rendering in the browser Then the standalone renderer host mounts with renderer-owned scrolling", async () => {
    await EmbeddedSnapshotFallback.run();
  });

  test("Scenario: Given a narrow embedded terminal story When rendering in the browser Then the same renderer contract holds without reintroducing outer scrolling", async () => {
    await NarrowViewportSnapshotFallback.run();
  });
});
