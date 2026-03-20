import { composeStories } from "@storybook/react-vite";
import { describe, test } from "vitest";

import * as stories from "../../src/features/shell/AppHeader.stories";

const {
  PassiveDesktopHeader,
  CompactHeaderKeepsOnlyNavigationTrigger,
  OfflineHeaderShowsTransportState,
  ReconnectingHeaderShowsTransportState,
} = composeStories(stories);

describe("Feature: Storybook DOM contract for the app header", () => {
  test("Scenario: Given the global app header When rendered on desktop and compact layouts Then it stays passive and only exposes the navigation trigger on compact viewports", async () => {
    await PassiveDesktopHeader.run();
    await CompactHeaderKeepsOnlyNavigationTrigger.run();
  });

  test("Scenario: Given offline and reconnecting transport states When the header renders Then each state is shown objectively", async () => {
    await OfflineHeaderShowsTransportState.run();
    await ReconnectingHeaderShowsTransportState.run();
  });
});
