import { composeStories } from "@storybook/react-vite";
import { describe, test } from "vitest";

import * as stories from "../../src/features/terminal/GlobalTerminalWorkbench.stories";

const { WorkbenchLifecycle } = composeStories(stories);

describe("Feature: Storybook DOM contract for global terminal workbench", () => {
  test("Scenario: Given the global terminal page workbench When switching tabs and opening admin dialogs Then tabs toolbar dialogs and terminal-view host stay coherent", async () => {
    await WorkbenchLifecycle.run();
  });
});
