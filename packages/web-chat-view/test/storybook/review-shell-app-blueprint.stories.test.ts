import { composeStories } from "@storybook/svelte-vite";
import { describe, test } from "vitest";

import * as stories from "../../src/storybook/review-shell-app-blueprint.stories";

const { CompactCanonical } = composeStories(stories);

describe("Feature: Storybook DOM contract for review shell app blueprint", () => {
  test("Scenario: Given the compact people shell blueprint story When the story runs Then Messages, Contacts, Me, room chat, contact detail, and sources stay navigable", async () => {
    await CompactCanonical.run();
  });
});
