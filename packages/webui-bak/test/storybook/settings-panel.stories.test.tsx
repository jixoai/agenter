import { composeStories } from "@storybook/react-vite";
import { describe, test } from "vitest";

import * as stories from "../../src/features/settings/SettingsPanel.stories";

const { JumpFromEffectiveToLayerView, LayerSourcesKeepExplicitScrollViewport, CompactLayerEditorSheet } = composeStories(stories);

describe("Feature: Storybook DOM contract for workspace settings", () => {
  test("Scenario: Given effective settings view When selecting a provenance source Then the panel jumps to layer view and loads the mapped field", async () => {
    await JumpFromEffectiveToLayerView.run();
  });

  test("Scenario: Given many settings layers When viewing layer sources Then the panel exposes an explicit scroll viewport", async () => {
    await LayerSourcesKeepExplicitScrollViewport.run();
  });

  test("Scenario: Given compact workspace settings When selecting a layer Then the editor opens in a right sheet", async () => {
    await CompactLayerEditorSheet.run();
  });
});
