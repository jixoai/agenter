import { composeStories } from "@storybook/react-vite";
import { describe, test } from "vitest";

import * as stories from "../../src/features/workspaces/WorkspaceWelcomeSurface.stories";

const { SelectResourcesAndStart } = composeStories(stories);

describe("Feature: Storybook DOM contract for workspace welcome orchestration", () => {
  test("Scenario: Given the welcome surface story When selecting a room and terminal Then the real DOM keeps grant controls and launch action aligned", async () => {
    await SelectResourcesAndStart.run();
  });
});
