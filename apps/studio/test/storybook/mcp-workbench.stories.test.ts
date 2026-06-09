import { describe, test } from "vitest";

import * as stories from "../../src/lib/features/mcp/mcp-workbench.stories";
import { getPortableStory } from "./portable-stories";

const AvatarAuthorityWithoutRunningRuntime = getPortableStory(stories, "AvatarAuthorityWithoutRunningRuntime");
const ConfigsNewDraft = getPortableStory(stories, "ConfigsNewDraft");
const ConfigsDuplicateConflict = getPortableStory(stories, "ConfigsDuplicateConflict");
const ConfigDetailEdit = getPortableStory(stories, "ConfigDetailEdit");
const ConfigRunningSummary = getPortableStory(stories, "ConfigRunningSummary");
const InspectVisualAndRaw = getPortableStory(stories, "InspectVisualAndRaw");
const AvatarsOverview = getPortableStory(stories, "AvatarsOverview");

describe("Feature: Storybook DOM contract for MCP workbench states", () => {
  test("Scenario: Given no running AvatarRuntime When configs opens Then new config still chooses one owner Avatar", async () => {
    await AvatarAuthorityWithoutRunningRuntime.run();
  });

  test("Scenario: Given configs tab When new draft is selected Then one detail form can switch between form and code and inspect the draft", async () => {
    await ConfigsNewDraft.run();
  });

  test("Scenario: Given inspect connects When snapshot and tool call render Then visual and raw tabs both stay available", async () => {
    await InspectVisualAndRaw.run();
  });

  test("Scenario: Given one owner Avatar already has the same config id When install is submitted Then Studio asks for override or cancel", async () => {
    await ConfigsDuplicateConflict.run();
  });

  test("Scenario: Given one config row When it is selected Then edit detail, inspect, and instance actions stay together", async () => {
    await ConfigDetailEdit.run();
  });

  test("Scenario: Given one config has running rows When detail renders Then config and instance summary stay separate", async () => {
    await ConfigRunningSummary.run();
  });

  test("Scenario: Given MCP is Avatar-owned When avatars tab opens Then each Avatar shows configs and project instances", async () => {
    await AvatarsOverview.run();
  });
});
