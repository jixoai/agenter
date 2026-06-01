import { composeStories } from "@storybook/svelte-vite";
import { describe, test } from "vitest";

import * as stories from "../../src/storybook/heartbeat-view.stories";

const { ConfigableMobile, ReadonlyMobile } = composeStories(stories);

describe("Feature: Storybook DOM contract for HeartbeatView", () => {
  test("Scenario: Given readonly and configable Heartbeat stories When they run Then mobile stream and statusbar capability modes remain reviewable", async () => {
    await ReadonlyMobile.run();
    await ConfigableMobile.run();
  });
});
