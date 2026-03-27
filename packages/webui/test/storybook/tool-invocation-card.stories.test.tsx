import { composeStories } from "@storybook/react-vite";
import { describe, test } from "vitest";

import * as stories from "../../src/components/ui/tool-invocation-card.stories";

const { Running, Success, Failed, Cancelled, Waiting } = composeStories(stories);

describe("Feature: Storybook DOM contract for tool invocation card", () => {
  test("Scenario: Given invocation state stories When rendered Then all lifecycle variants remain stable in real DOM", async () => {
    await Running.run();
    await Success.run();
    await Failed.run();
    await Cancelled.run();
    await Waiting.run();
  });
});
