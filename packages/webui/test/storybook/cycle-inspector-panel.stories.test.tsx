import { composeStories } from "@storybook/react-vite";
import { describe, test } from "vitest";

import * as stories from "../../src/features/process/CycleInspectorPanel.stories";

const { CycleDetailsStayInDevtools } = composeStories(stories);
const { StreamingCycleState } = composeStories(stories);
const { CompactCycleDetailSheet } = composeStories(stories);
const { MultiContextAttentionRefsStayReadable } = composeStories(stories);
const { LoadingCycleHistory } = composeStories(stories);

describe("Feature: Storybook DOM contract for cycle inspection", () => {
  test("Scenario: Given the Devtools cycle story When expanded in the browser Then attention refs egress and merged tool trace stay available outside Chat", async () => {
    await CycleDetailsStayInDevtools.run();
  });

  test("Scenario: Given a streaming cycle story When selected in the browser Then the streaming draft stays visible in Devtools", async () => {
    await StreamingCycleState.run();
  });

  test("Scenario: Given compact Devtools cycle navigation When a cycle is selected Then the detail opens in a right sheet", async () => {
    await CompactCycleDetailSheet.run();
  });

  test("Scenario: Given multi-context attention refs When Devtools renders the cycle Then context ownership stays readable in the browser", async () => {
    await MultiContextAttentionRefsStayReadable.run();
  });

  test("Scenario: Given no cycle history yet When Devtools loads Then the loading state is explicit", async () => {
    await LoadingCycleHistory.run();
  });
});
