import { describe, test } from "vitest";

import * as stories from "../../src/lib/components/scroll/anchored-virtual-list-identity.stories";
import { getPortableStory } from "./portable-stories";

const DirectStableAppendPreservesExistingRowDomIdentity = getPortableStory(
  stories,
  "DirectStableAppendPreservesExistingRowDomIdentity",
);
const DirectInlineAppendPreservesExistingRowDomIdentity = getPortableStory(
  stories,
  "DirectInlineAppendPreservesExistingRowDomIdentity",
);
const WrappedStableAppendPreservesExistingRowDomIdentity = getPortableStory(
  stories,
  "WrappedStableAppendPreservesExistingRowDomIdentity",
);
const WrappedInlineAppendPreservesExistingRowDomIdentity = getPortableStory(
  stories,
  "WrappedInlineAppendPreservesExistingRowDomIdentity",
);
const DirectStableComponentAppendPreservesExistingRowDomIdentity = getPortableStory(
  stories,
  "DirectStableComponentAppendPreservesExistingRowDomIdentity",
);
const WrappedStableComponentAppendPreservesExistingRowDomIdentity = getPortableStory(
  stories,
  "WrappedStableComponentAppendPreservesExistingRowDomIdentity",
);

describe("Feature: Storybook DOM contract for anchored virtual list identity", () => {
  test("Scenario: Given direct AnchoredVirtualList with stable virtual config When latest is appended Then the visible row shell and inner subtree keep DOM identity", async () => {
    await DirectStableAppendPreservesExistingRowDomIdentity.run();
  });

  test("Scenario: Given direct AnchoredVirtualList with inline virtual config When latest is appended Then the visible row shell and inner subtree keep DOM identity", async () => {
    await DirectInlineAppendPreservesExistingRowDomIdentity.run();
  });

  test("Scenario: Given VirtualConversation with stable virtual config When latest is appended Then the visible row shell and inner subtree keep DOM identity", async () => {
    await WrappedStableAppendPreservesExistingRowDomIdentity.run();
  });

  test("Scenario: Given VirtualConversation with inline virtual config When latest is appended Then the visible row shell and inner subtree keep DOM identity", async () => {
    await WrappedInlineAppendPreservesExistingRowDomIdentity.run();
  });

  test("Scenario: Given direct AnchoredVirtualList with a child component row When latest is appended Then the visible row shell and inner subtree keep DOM identity", async () => {
    await DirectStableComponentAppendPreservesExistingRowDomIdentity.run();
  });

  test("Scenario: Given VirtualConversation with a child component row When latest is appended Then the visible row shell and inner subtree keep DOM identity", async () => {
    await WrappedStableComponentAppendPreservesExistingRowDomIdentity.run();
  });
});
