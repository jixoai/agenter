import { composeStories } from "@storybook/react-vite";
import { describe, test } from "vitest";

import * as stories from "../../src/features/shell/SidebarNav.stories";

const { SidebarShowsPrimaryAndRunningSessions } = composeStories(stories);
const { DesktopRailCanCollapseToIconWidth } = composeStories(stories);

describe("Feature: Storybook DOM contract for sidebar navigation", () => {
  test("Scenario: Given running session entries When the sidebar is rendered Then primary navigation and running sessions share one shell", async () => {
    await SidebarShowsPrimaryAndRunningSessions.run();
  });

  test("Scenario: Given the desktop shell sidebar When collapsing it Then the rail shrinks to icon width and can reopen", async () => {
    await DesktopRailCanCollapseToIconWidth.run();
  });
});
