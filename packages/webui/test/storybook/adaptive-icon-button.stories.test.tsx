import { composeStories } from "@storybook/react-vite";
import { describe, test } from "vitest";

import * as stories from "../../src/components/ui/adaptive-icon-button.stories";

const { WideButtonKeepsLabel, CompactButtonCollapsesToIconOnly } = composeStories(stories);

describe("Feature: Storybook DOM contract for adaptive icon button", () => {
  test("Scenario: Given wide and compact button widths When the adaptive affordance renders Then the label only collapses after width pressure while tooltip and aria remain usable", async () => {
    await WideButtonKeepsLabel.run();
    await CompactButtonCollapsesToIconOnly.run();
  });
});
