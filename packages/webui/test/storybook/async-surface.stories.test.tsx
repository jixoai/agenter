import { composeStories } from "@storybook/react-vite";
import { describe, test } from "vitest";

import * as stories from "../../src/components/ui/async-surface.stories";

const { FourStateContract } = composeStories(stories);

describe("Feature: Storybook DOM contract for async surface states", () => {
  test("Scenario: Given the four-state story When rendered in the browser Then loading and data presence remain independent", async () => {
    await FourStateContract.run();
  });
});
