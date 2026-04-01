import { composeStories } from "@storybook/react-vite";
import { describe, test } from "vitest";

import * as stories from "../../src/features/shell/WorkspaceShellFrame.stories";

const { SwitchTabsWithinUnifiedTopHeader, CompactShellStillKeepsTopTabs } = composeStories(stories);

describe("Feature: Storybook DOM contract for workspace shell", () => {
  test("Scenario: Given workspace shell chrome When switching tabs Then the unified top header keeps basename-first workspace context and forwards navigation intents", async () => {
    await SwitchTabsWithinUnifiedTopHeader.run();
  });

  test("Scenario: Given a compact workspace shell When rendered Then the same top-header tabs stay available without a bottom navbar", async () => {
    await CompactShellStillKeepsTopTabs.run();
  });
});
