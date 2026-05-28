import { composeStories } from "@storybook/svelte-vite";
import { describe, test } from "vitest";

import * as stories from "../../src/storybook/chat-composer-stage.stories";

const { CompactComposer } = composeStories(stories);

describe("Feature: Storybook DOM contract for chat composer stage", () => {
  test("Scenario: Given the compact composer story When the story runs Then messagebar actions, hint law, and resource-aware draft state remain reviewable", async () => {
    await CompactComposer.run();
  });
});
