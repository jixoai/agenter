import { composeStories } from "@storybook/react-vite";
import { describe, test } from "vitest";

import * as stories from "../../src/features/chat/AIInputToolbar.stories";

const { WideToolbarKeepsLabelsAndHints, CompactToolbarCollapsesHelpAndSecondaryLabels } = composeStories(stories);

describe("Feature: Storybook DOM contract for adaptive composer toolbar", () => {
  test("Scenario: Given a wide composer toolbar When rendered in the browser Then the action row stays single-line and the thinner status row keeps inline help", async () => {
    await WideToolbarKeepsLabelsAndHints.run();
  });

  test("Scenario: Given a compact composer toolbar When rendered in the browser Then secondary labels collapse and help compresses into the question-mark entry", async () => {
    await CompactToolbarCollapsesHelpAndSecondaryLabels.run();
  });
});
