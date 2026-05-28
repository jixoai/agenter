import { composeStories } from "@storybook/svelte-vite";
import { describe, test } from "vitest";

import * as stories from "../../src/storybook/comment-anchor-badge.stories";

const { ViewMode, EditMode } = composeStories(stories);

describe("Feature: Storybook DOM contract for comment anchor badge", () => {
  test("Scenario: Given a view-mode comment anchor When the story runs Then the inline detail is visible beside the selected source line", async () => {
    await ViewMode.run();
  });

  test("Scenario: Given an edit-mode comment anchor When the story runs Then the edit segment is active without showing the detail body", async () => {
    await EditMode.run();
  });
});
