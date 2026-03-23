import { composeStories } from "@storybook/react-vite";
import { describe, test } from "vitest";

import * as stories from "../../src/features/shell/AppHeader.stories";

const {
  PassiveDesktopHeader,
  CompactHeaderKeepsOnlyNavigationTrigger,
  WorkspaceHeaderKeepsTabsAndBasenameOnly,
  OfflineHeaderShowsTransportState,
  ReconnectingHeaderShowsTransportState,
} = composeStories(stories);

describe("Feature: Storybook DOM contract for the unified top header", () => {
  test("Scenario: Given the shared top header When rendered on desktop and compact layouts Then it stays passive except for the drawer trigger on compact viewports", async () => {
    await PassiveDesktopHeader.run();
    await CompactHeaderKeepsOnlyNavigationTrigger.run();
  });

  test("Scenario: Given a workspace-scoped header When switching tabs Then the header keeps tabs and basename-only workspace context without route-local actions", async () => {
    await WorkspaceHeaderKeepsTabsAndBasenameOnly.run();
  });

  test("Scenario: Given offline and reconnecting transport states When the header renders Then each state is exposed as an objective signal", async () => {
    await OfflineHeaderShowsTransportState.run();
    await ReconnectingHeaderShowsTransportState.run();
  });
});
