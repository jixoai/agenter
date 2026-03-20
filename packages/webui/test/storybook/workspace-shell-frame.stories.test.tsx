import { composeStories } from "@storybook/react-vite";
import { describe, test } from "vitest";

import * as stories from "../../src/features/shell/WorkspaceShellFrame.stories";

const { SwitchTabsWithinWorkspaceShell } = composeStories(stories);

describe("Feature: Storybook DOM contract for workspace shell", () => {
  test("Scenario: Given workspace shell chrome When switching tabs Then the shell keeps workspace context and forwards navigation intents", async () => {
    await SwitchTabsWithinWorkspaceShell.run();
  });
});
