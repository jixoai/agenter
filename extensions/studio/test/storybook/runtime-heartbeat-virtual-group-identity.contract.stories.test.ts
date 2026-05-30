import { describe, test } from "vitest";

import * as stories from "../../src/lib/features/runtime/runtime-heartbeat-virtual-group-identity.contract.stories";
import { getPortableStory } from "./portable-stories";

const DirectAppendPreservesRuntimeHeartbeatGroupDomIdentity = getPortableStory(
  stories,
  "DirectAppendPreservesRuntimeHeartbeatGroupDomIdentity",
);
const WrappedAppendPreservesRuntimeHeartbeatGroupDomIdentity = getPortableStory(
  stories,
  "WrappedAppendPreservesRuntimeHeartbeatGroupDomIdentity",
);

describe("Feature: Storybook DOM contract for runtime heartbeat group rows inside anchored virtual list", () => {
  test("Scenario: Direct AVL keeps heartbeat row subtree identity on append", async () => {
    await DirectAppendPreservesRuntimeHeartbeatGroupDomIdentity.run();
  });

  test("Scenario: Wrapped conversation keeps heartbeat row subtree identity on append", async () => {
    await WrappedAppendPreservesRuntimeHeartbeatGroupDomIdentity.run();
  });
});
