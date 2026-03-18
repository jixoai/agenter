import { composeStories } from "@storybook/react-vite";
import { describe, test } from "vitest";

import * as stories from "../../src/features/workspaces/WorkspaceSessionsPanel.stories";

const { ToggleSelectionAndResume } = composeStories(stories);

describe("Feature: Storybook DOM contract for workspace sessions", () => {
  test("Scenario: Given a sessions panel story When the same session is clicked twice and resumed Then selection toggles and resume stays callable", async () => {
    await ToggleSelectionAndResume.run();
  });
});
