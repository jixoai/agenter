import { composeStories } from "@storybook/svelte-vite";
import { describe, test } from "vitest";

import * as stories from "../../src/storybook/resource-square-tile-blueprint.stories";

const { States } = composeStories(stories);

describe("Feature: Storybook DOM contract for resource square tile blueprint", () => {
  test("Scenario: Given the resource tile blueprint story When the story runs Then core, pending, and rail states are all reviewable", async () => {
    await States.run();
  });
});
