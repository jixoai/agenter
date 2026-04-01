import { composeStories } from "@storybook/react-vite";
import { describe, test } from "vitest";

import * as stories from "../../src/features/chat/ComposerActionBar.stories";

const { WideActionBarKeepsLabelsOnOneRow, CompactActionBarCollapsesSecondaryLabels } = composeStories(stories);

describe("Feature: Storybook DOM contract for composer action bar", () => {
  test("Scenario: Given wide and compact composer action bars When they render Then secondary actions stay on one row and collapse labels before the send action loses its label", async () => {
    await WideActionBarKeepsLabelsOnOneRow.run();
    await CompactActionBarCollapsesSecondaryLabels.run();
  });
});
