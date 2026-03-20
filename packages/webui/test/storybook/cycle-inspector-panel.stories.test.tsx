import { composeStories } from "@storybook/react-vite";
import { describe, test } from "vitest";

import * as stories from "../../src/features/process/CycleInspectorPanel.stories";

const { CycleDetailsStayInDevtools } = composeStories(stories);
const { StreamingCycleState } = composeStories(stories);

describe("Feature: Storybook DOM contract for cycle inspection", () => {
  test("Scenario: Given the Devtools cycle story When expanded in the browser Then collected facts and assistant records remain available outside Chat", async () => {
    await CycleDetailsStayInDevtools.run();
  });

  test("Scenario: Given a streaming cycle story When selected in the browser Then the live reply state stays visible in Devtools", async () => {
    await StreamingCycleState.run();
  });
});
