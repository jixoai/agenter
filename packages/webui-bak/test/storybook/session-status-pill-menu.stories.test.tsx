import { composeStories } from "@storybook/react-vite";
import { describe, test } from "vitest";

import * as stories from "../../src/features/shell/SessionStatusPillMenu.stories";

const { RunningMenuStopsOrAborts, PausedMenuResumesSession, PendingMenuDisablesActions, CompactIconMenuKeepsStatusInHeader } =
  composeStories(stories);

describe("Feature: Storybook DOM contract for session status pill menu", () => {
  test("Scenario: Given running and paused sessions When the route-local menu opens Then the primary lifecycle action stays singular and abort remains secondary", async () => {
    await RunningMenuStopsOrAborts.run();
    await PausedMenuResumesSession.run();
  });

  test("Scenario: Given pending lifecycle actions When the session menu opens Then disabled actions do not dispatch callbacks", async () => {
    await PendingMenuDisablesActions.run();
  });

  test("Scenario: Given a compact header trigger When the status icon opens Then the same lifecycle menu remains reachable without a route-body pill", async () => {
    await CompactIconMenuKeepsStatusInHeader.run();
  });
});
