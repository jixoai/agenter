import { composeStories } from "@storybook/react-vite";
import { describe, test } from "vitest";

import * as stories from "../../src/features/chat/AssistantMarkdown.stories";

const { ToolTraceAccordion } = composeStories(stories);

describe("Feature: Storybook DOM contract for assistant markdown", () => {
  test("Scenario: Given a tool trace story When toggling the accordion Then structured sections remain readable in the real DOM", async () => {
    await ToolTraceAccordion.run();
  });
});
