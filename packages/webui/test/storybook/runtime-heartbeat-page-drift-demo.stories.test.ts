import { describe, test } from "vitest";

import * as stories from "../../src/lib/features/runtime/runtime-heartbeat-page-drift-demo.stories";
import { getPortableStory } from "./portable-stories";

const StableAppendKeepsExistingCardMounted = getPortableStory(stories, "StableAppendKeepsExistingCardMounted");
const ProjectionRefreshRekeysAndRemounts = getPortableStory(stories, "ProjectionRefreshRekeysAndRemounts");

describe("Feature: Storybook DOM contract for heartbeat page drift demo", () => {
  test("Scenario: Given a stable latest append When the existing group key stays the same Then the Heartbeat card DOM is reused", async () => {
    await StableAppendKeepsExistingCardMounted.run();
  });

  test("Scenario: Given a page-level projection refresh When pending context rekeys into durable groups Then the previous Heartbeat card remounts", async () => {
    await ProjectionRefreshRekeysAndRemounts.run();
  });
});
