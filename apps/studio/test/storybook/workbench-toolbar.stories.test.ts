import { describe, test } from "vitest";

import * as stories from "../../src/lib/features/navigation/workbench-toolbar.stories";
import { getPortableStory } from "./portable-stories";

const WidePageTabsKeepsInlineGrid = getPortableStory(stories, "WidePageTabsKeepsInlineGrid");
const WideIdentityKeepsAnchorInline = getPortableStory(stories, "WideIdentityKeepsAnchorInline");
const MediumPageTabsMovesSecondaryIntoOverflow = getPortableStory(stories, "MediumPageTabsMovesSecondaryIntoOverflow");
const CompactPageTabsWithoutOmittedContentKeepsNoOverflowTrigger = getPortableStory(
  stories,
  "CompactPageTabsWithoutOmittedContentKeepsNoOverflowTrigger",
);
const CompactPageTabsWithoutStatusKeepsActionsInline = getPortableStory(
  stories,
  "CompactPageTabsWithoutStatusKeepsActionsInline",
);
const NarrowPageTabsLeavesOnlyAnchorAndOverflow = getPortableStory(
  stories,
  "NarrowPageTabsLeavesOnlyAnchorAndOverflow",
);
const NarrowIdentityKeepsIdentityInline = getPortableStory(stories, "NarrowIdentityKeepsIdentityInline");

describe("Feature: Storybook DOM contract for shared page-toolbar primitive", () => {
  test("Scenario: Given a wide page-tabs toolbar When the story runs Then the shared grid keeps page-tabs, identity, actions, and status inline", async () => {
    await WidePageTabsKeepsInlineGrid.run();
  });

  test("Scenario: Given a wide toolbar without page-tabs When the story runs Then identity remains the page-anchor inline", async () => {
    await WideIdentityKeepsAnchorInline.run();
  });

  test("Scenario: Given a medium page-tabs toolbar When the story runs Then actions and status move into the floating overflow panel", async () => {
    await MediumPageTabsMovesSecondaryIntoOverflow.run();
  });

  test("Scenario: Given a constrained page-tabs toolbar without omitted content When the story runs Then no overflow trigger is rendered", async () => {
    await CompactPageTabsWithoutOmittedContentKeepsNoOverflowTrigger.run();
  });

  test("Scenario: Given a compact page-tabs toolbar without status When the story runs Then local actions remain inline", async () => {
    await CompactPageTabsWithoutStatusKeepsActionsInline.run();
  });

  test("Scenario: Given the narrowest page-tabs toolbar When the story runs Then inline identity collapses while the floating panel preserves full detail and scrolling", async () => {
    await NarrowPageTabsLeavesOnlyAnchorAndOverflow.run();
  });

  test("Scenario: Given a narrow toolbar without page-tabs When the story runs Then identity stays inline while only secondary regions overflow", async () => {
    await NarrowIdentityKeepsIdentityInline.run();
  });
});
