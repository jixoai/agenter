import { composeStories } from "@storybook/react-vite";
import { describe, test } from "vitest";

import * as stories from "../../src/features/shell/BottomNavBar.stories";

const { FooterOwnsWorkspaceRouteSwitching } = composeStories(stories);

describe("Feature: Storybook DOM contract for the bottom navigation", () => {
  test("Scenario: Given the workspace footer nav When route buttons are activated Then footer navigation owns the workspace tab switching intents", async () => {
    await FooterOwnsWorkspaceRouteSwitching.run();
  });
});
