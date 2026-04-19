import { describe, test } from "vitest";

import * as stories from "../../src/lib/components/scroll/anchored-virtual-list.stories";
import { getPortableStory } from "./portable-stories";

const InternalScrollOwnerHasOverflow = getPortableStory(stories, "InternalScrollOwnerHasOverflow");
const AppendNearLatestAutoFollow = getPortableStory(stories, "AppendNearLatestAutoFollow");
const AppendAvoidsStaleIntermediateRows = getPortableStory(stories, "AppendAvoidsStaleIntermediateRows");

describe("Feature: Storybook DOM contract for anchored virtual list scroll", () => {
  test("Scenario: Given the capability lab loads When the transcript pane first paints Then the internal viewport already owns overflow instead of expanding to content height", async () => {
    await InternalScrollOwnerHasOverflow.run();
  });

  test("Scenario: Given the viewport is already near latest When a latest row is appended Then the shared transaction auto-follows latest without drift", async () => {
    await AppendNearLatestAutoFollow.run();
  });

  test("Scenario: Given a latest append transaction is active When the viewport samples the visible trailing rows Then the sequence never jumps backward to a stale intermediate row", async () => {
    await AppendAvoidsStaleIntermediateRows.run();
  });
});
