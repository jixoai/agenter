import { composeStories } from "@storybook/react-vite";
import { describe, test } from "vitest";

import * as stories from "../../src/features/settings/SettingsPanel.stories";

const { EditWorkspaceLayer, LayerSourcesKeepExplicitScrollViewport, CompactLayerEditorSheet } = composeStories(stories);

describe("Feature: Storybook DOM contract for workspace settings", () => {
  test("Scenario: Given workspace settings story When selecting and editing a layer Then the panel keeps workspace-scoped editing actions operable in a real DOM", async () => {
    await EditWorkspaceLayer.run();
  });

  test("Scenario: Given many settings layers When viewing layer sources Then the panel exposes an explicit scroll viewport", async () => {
    await LayerSourcesKeepExplicitScrollViewport.run();
  });

  test("Scenario: Given compact workspace settings When selecting a layer Then the editor opens in a right sheet", async () => {
    await CompactLayerEditorSheet.run();
  });
});
