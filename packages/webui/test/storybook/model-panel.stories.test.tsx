import { composeStories } from "@storybook/react-vite";
import { describe, test } from "vitest";

import * as stories from "../../src/features/model/ModelPanel.stories";

const { RichModelDebug, RunningModelCallVisible } = composeStories(stories);

describe("Feature: Storybook DOM contract for model panel", () => {
  test("Scenario: Given a rich model debug story When switching nested tabs Then request result history and http groups remain independently readable", async () => {
    await RichModelDebug.run();
  });

  test("Scenario: Given an in-flight model call story When rendered Then lifecycle state is visible before completion", async () => {
    await RunningModelCallVisible.run();
  });
});
