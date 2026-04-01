import { composeStories } from "@storybook/react-vite";
import { describe, test } from "vitest";

import * as stories from "../../src/features/attention/AttentionInspectorPanel.stories";

const { ContextFirstView, ScoreQueryTraversal, ItemCommitView, LoadingContexts } = composeStories(stories);

describe("Feature: Storybook DOM contract for context inspection", () => {
  test("Scenario: Given multi-context attention When Devtools opens Then the context tab stays primary and picks the latest active item", async () => {
    await ContextFirstView.run();
  });

  test("Scenario: Given score-driven attention lookup When the query switches from scoped to global Then related items remain traversable", async () => {
    await ScoreQueryTraversal.run();
  });

  test("Scenario: Given an attention item commit When the item tab opens Then the view is decomposed into M S T C sections", async () => {
    await ItemCommitView.run();
  });

  test("Scenario: Given no contexts yet When Devtools loads Then the loading state is explicit", async () => {
    await LoadingContexts.run();
  });
});
