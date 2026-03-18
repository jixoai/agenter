import { composeStories } from "@storybook/react-vite";
import { describe, test } from "vitest";

import * as stories from "../../src/features/workspaces/WorkspacesPanel.stories";

const { SelectDeleteAndClean } = composeStories(stories);

describe("Feature: Storybook DOM contract for workspaces browser", () => {
  test("Scenario: Given workspace browser story When selecting filtering deleting and cleaning Then the real DOM flow preserves the workspace actions", async () => {
    await SelectDeleteAndClean.run();
  });
});
