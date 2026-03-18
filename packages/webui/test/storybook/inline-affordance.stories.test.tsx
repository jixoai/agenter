import { composeStories } from "@storybook/react-vite";
import { describe, test } from "vitest";

import * as stories from "../../src/components/ui/inline-affordance.stories";

const { SpacingContract } = composeStories(stories);

describe("Feature: Storybook DOM contract for inline affordance", () => {
  test("Scenario: Given icon plus text surfaces When rendered in a real browser DOM Then they keep the shared compact spacing contract", async () => {
    await SpacingContract.run();
  });
});
