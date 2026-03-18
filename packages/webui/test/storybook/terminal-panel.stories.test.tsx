import { composeStories } from "@storybook/react-vite";
import { describe, test } from "vitest";

import * as stories from "../../src/features/terminal/TerminalPanel.stories";

const { RichTerminal } = composeStories(stories);

describe("Feature: Storybook DOM contract for terminal panel", () => {
  test("Scenario: Given a rich terminal story When rendering in the browser Then colors and scale controls stay interactive", async () => {
    await RichTerminal.run();
  });
});
