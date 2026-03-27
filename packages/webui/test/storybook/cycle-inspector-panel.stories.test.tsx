import { composeStories } from "@storybook/react-vite";
import { describe, test } from "vitest";

import * as stories from "../../src/features/process/CycleInspectorPanel.stories";

const { CycleDetailsStayInDevtools } = composeStories(stories);
const { StreamingCycleState } = composeStories(stories);
const { CompactCycleDetailSheet } = composeStories(stories);
const { MultiContextAttentionRefsStayReadable } = composeStories(stories);
const { LoadingCycleHistory } = composeStories(stories);

describe("Feature: Storybook DOM contract for cycle inspection", () => {
  test("Scenario: Given the Devtools cycle workbench When switching right-panel tabs Then conversation-first flow and model config stay inspectable", async () => {
    await CycleDetailsStayInDevtools.run();
  });

  test("Scenario: Given a streaming cycle story When selected in the browser Then draft and tool-call deltas stay visible in the conversation lane", async () => {
    await StreamingCycleState.run();
  });

  test("Scenario: Given compact Devtools cycle navigation When a cycle is selected Then the cycle workbench detail opens in a right sheet", async () => {
    await CompactCycleDetailSheet.run();
  });

  test("Scenario: Given multi-context attention refs When switching to Attention I/O Then context ownership stays readable in the browser", async () => {
    await MultiContextAttentionRefsStayReadable.run();
  });

  test("Scenario: Given no cycle history yet When Devtools loads Then the loading state is explicit", async () => {
    await LoadingCycleHistory.run();
  });
});
