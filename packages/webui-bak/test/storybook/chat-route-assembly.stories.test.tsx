import { composeStories } from "@storybook/react-vite";
import { describe, test } from "vitest";

import * as stories from "../../src/features/shell/ChatRouteAssembly.stories";

const { DesktopRouteKeepsPassiveHeaderAndRouteLocalStatus, CompactRouteCollapsesSecondaryChromeFirst } =
  composeStories(stories);

describe("Feature: Storybook DOM contract for chat route assembly", () => {
  test("Scenario: Given desktop and iPhone SE route assemblies When the full Chat shell renders Then the passive header, route-local session entry, and dual-row composer remain stable", async () => {
    await DesktopRouteKeepsPassiveHeaderAndRouteLocalStatus.run();
    await CompactRouteCollapsesSecondaryChromeFirst.run();
  });
});
