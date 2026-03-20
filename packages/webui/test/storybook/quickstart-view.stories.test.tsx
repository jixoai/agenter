import { composeStories } from "@storybook/react-vite";
import { describe, test } from "vitest";

import * as stories from "../../src/features/quickstart/QuickStartView.stories";

const { StartAndResumeFlow, ScrollViewportOwnsLongContent, CompactViewportKeepsPrimaryEntryPath } =
  composeStories(stories);

describe("Feature: Storybook DOM contract for quick start", () => {
  test("Scenario: Given quick start story When workspace actions and recent session actions run Then the entry flow stays operable in a real browser DOM", async () => {
    await StartAndResumeFlow.run();
  });

  test("Scenario: Given a compact quick start viewport When recent history grows Then the route keeps one explicit scrolling owner", async () => {
    await ScrollViewportOwnsLongContent.run();
  });

  test("Scenario: Given a mobile-sized quick start viewport When the shell renders Then the primary entry actions remain visible without horizontal overflow", async () => {
    await CompactViewportKeepsPrimaryEntryPath.run();
  });
});
