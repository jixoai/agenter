import { composeStories } from "@storybook/react-vite";
import { describe, test } from "vitest";

import * as stories from "../../src/features/chat/ChatPanel.stories";

const { MergedToolConversation, WorkingConversation } = composeStories(stories);

describe("Feature: Storybook DOM contract for chat rendering", () => {
  test("Scenario: Given a merged tool conversation story When the tool row is expanded Then call and result facts stay visible in one real DOM flow", async () => {
    await MergedToolConversation.run();
  });

  test("Scenario: Given a working conversation story When rendered in the browser Then row alignment and live AI status stay visible in the real DOM", async () => {
    await WorkingConversation.run();
  });
});
