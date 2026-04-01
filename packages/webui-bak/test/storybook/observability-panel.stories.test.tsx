import { composeStories } from "@storybook/react-vite";
import { describe, test } from "vitest";

import * as stories from "../../src/features/devtools/observability/ObservabilityPanel.stories";

const { EventsSchedulerAndTransportStayOperable } = composeStories(stories);

describe("Feature: Storybook DOM contract for observability panel", () => {
  test("Scenario: Given a populated observability story When the user switches between events, scheduler, and transport Then each surface remains independently operable", async () => {
    await EventsSchedulerAndTransportStayOperable.run();
  });
});
