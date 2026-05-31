import { composeStories } from "@storybook/svelte-vite";
import { describe, test } from "vitest";

import * as stories from "../../src/storybook/chat-composer-stage.stories";

const { CodeMirrorResourceProjection, CompactComposer } = composeStories(stories);

describe("Feature: Storybook DOM contract for chat composer stage", () => {
  test("Scenario: Given the compact composer story When the story runs Then messagebar actions, hint law, and resource-aware draft state remain reviewable", async () => {
    await CompactComposer.run();
  });

  test("Scenario: Given the CodeMirror resource projection story When it runs Then the composer is writable and the bubble is readonly", async () => {
    await CodeMirrorResourceProjection.run();
  });
});
