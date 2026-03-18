import { composeStories } from "@storybook/react-vite";
import { describe, test } from "vitest";

import * as stories from "../../src/features/quickstart/QuickStartView.stories";

const { StartAndResumeFlow } = composeStories(stories);

describe("Feature: Storybook DOM contract for quick start", () => {
  test("Scenario: Given quick start story When workspace actions and recent session actions run Then the entry flow stays operable in a real browser DOM", async () => {
    await StartAndResumeFlow.run();
  });
});
