import { composeStories } from "@storybook/react-vite";
import { describe, test } from "vitest";

import * as stories from "../../src/features/shell/StatusSignal.stories";

const { ReadySignalKeepsTooltipAndAria, OfflineSignalKeepsDangerTone } = composeStories(stories);

describe("Feature: Storybook DOM contract for passive status signals", () => {
  test("Scenario: Given passive shell signals When they render Then icon-only transport and AI states retain tooltip and accessible labeling", async () => {
    await ReadySignalKeepsTooltipAndAria.run();
    await OfflineSignalKeepsDangerTone.run();
  });
});
