import { composeStories } from "@storybook/react-vite";
import { describe, test } from "vitest";

import * as stories from "../../src/features/workspaces/WorkspaceSessionsPanel.stories";

const { LongSessionListKeepsVirtualViewport, ToggleSelectionAndResume } = composeStories(stories);

describe("Feature: Storybook DOM contract for workspace sessions", () => {
  test("Scenario: Given workspace sessions story When selecting and resuming Then the real DOM flow preserves the session actions", async () => {
    await ToggleSelectionAndResume.run();
  });

  test("Scenario: Given a long session list When rendered in the browser Then the panel keeps a single explicit session viewport", async () => {
    await LongSessionListKeepsVirtualViewport.run();
  });
});
