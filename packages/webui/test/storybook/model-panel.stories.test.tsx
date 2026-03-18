import { composeStories } from "@storybook/react-vite";
import { describe, test } from "vitest";

import * as stories from "../../src/features/model/ModelPanel.stories";

const { RichModelDebug } = composeStories(stories);

describe("Feature: Storybook DOM contract for model panel", () => {
  test("Scenario: Given a rich model debug story When switching nested tabs Then request result history and http groups remain independently readable", async () => {
    await RichModelDebug.run();
  });
});
