import { composeStories } from "@storybook/svelte-vite";
import { describe, test } from "vitest";

import * as stories from "../../src/storybook/message-source-popup-blueprint.stories";

const { PreviewLayer } = composeStories(stories);

describe("Feature: Storybook DOM contract for message source popup blueprint", () => {
  test("Scenario: Given the source popup blueprint story When the story runs Then the dialog and comment preview remain visible on the compact canvas", async () => {
    await PreviewLayer.run();
  });
});
