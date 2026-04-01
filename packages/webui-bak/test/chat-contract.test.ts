import { describe, expect, test } from "vitest";

import { resolveChatMessagePresentation } from "../src/features/chat/chat-contract";

describe("Feature: chat message visual contract", () => {
  test("Scenario: Given an assistant reply When resolving presentation Then the bubble does not reuse the panel pure-white surface", () => {
    const presentation = resolveChatMessagePresentation({
      role: "assistant",
      channel: "to_user",
    });

    expect(presentation.bubbleClassName).toContain("bg-slate-50");
    expect(presentation.bubbleClassName).toContain("ring-1");
    expect(presentation.bubbleClassName).not.toBe("bg-white text-slate-900");
  });
});
