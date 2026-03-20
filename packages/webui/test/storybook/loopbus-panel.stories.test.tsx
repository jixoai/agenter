import { composeStories } from "@storybook/react-vite";
import { describe, test } from "vitest";

import * as stories from "../../src/features/loopbus/LoopBusPanel.stories";

const { FlowTraceAndModelStayOperable } = composeStories(stories);

describe("Feature: Storybook DOM contract for loopbus panel", () => {
  test("Scenario: Given a populated loopbus story When the user switches tabs Then flow, trace, and model surfaces remain independently operable", async () => {
    await FlowTraceAndModelStayOperable.run();
  });
});
