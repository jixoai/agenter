import { composeStories } from "@storybook/svelte-vite";
import { describe, test } from "vitest";
import { within } from "storybook/test";

import * as stories from "../../src/storybook/message-source-popup.stories";

const { CompactSource } = composeStories(stories);

describe("Feature: Storybook DOM contract for message source popup", () => {
  test("Scenario: Given the canonical source popup story When the story runs Then sender context and raw markdown remain visible on the compact canvas", async () => {
    await CompactSource.run();
  });
});
