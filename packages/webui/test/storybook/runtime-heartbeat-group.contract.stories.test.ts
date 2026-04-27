import { describe, test } from "vitest";

import * as stories from "../../src/lib/features/runtime/runtime-heartbeat-group.contract.stories";
import { getPortableStory } from "./portable-stories";

const ParentRerenderKeepsSectionDomIdentity = getPortableStory(stories, "ParentRerenderKeepsSectionDomIdentity");
const EquivalentGroupRefreshKeepsSectionDomIdentity = getPortableStory(
  stories,
  "EquivalentGroupRefreshKeepsSectionDomIdentity",
);
const RunningSleepToolShowsProgressLayer = getPortableStory(stories, "RunningSleepToolShowsProgressLayer");
const RunningTimeoutToolShowsProgressLayer = getPortableStory(stories, "RunningTimeoutToolShowsProgressLayer");

describe("Feature: Storybook DOM contract for runtime heartbeat group", () => {
  test("Scenario: Given one heartbeat group When an unrelated parent state changes Then the section and entry DOM nodes stay mounted", async () => {
    await ParentRerenderKeepsSectionDomIdentity.run();
  });

  test("Scenario: Given one heartbeat group When an equivalent cloned group prop replaces the previous object Then the section and entry DOM nodes stay mounted", async () => {
    await EquivalentGroupRefreshKeepsSectionDomIdentity.run();
  });

  test("Scenario: Given a running sleep tool call When rendering Heartbeat Then the tool card shows a sleep progress layer", async () => {
    await RunningSleepToolShowsProgressLayer.run();
  });

  test("Scenario: Given a running timeout tool call When rendering Heartbeat Then the tool card shows a timeout progress layer", async () => {
    await RunningTimeoutToolShowsProgressLayer.run();
  });
});
