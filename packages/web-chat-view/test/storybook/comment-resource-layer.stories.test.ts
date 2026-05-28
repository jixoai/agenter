import { composeStories } from "@storybook/svelte-vite";
import { describe, test } from "vitest";

import * as stories from "../../src/storybook/comment-resource-layer.stories";

const { ViewMode, EditMode } = composeStories(stories);

describe("Feature: Storybook DOM contract for comment resource detail", () => {
  test("Scenario: Given a reopened comment resource When the view story runs Then the dedicated comment detail opens in view mode with anchor context", async () => {
    await ViewMode.run();
  });

  test("Scenario: Given an editable comment detail When the edit story runs Then the same surface exposes inline editing controls", async () => {
    await EditMode.run();
  });
});
