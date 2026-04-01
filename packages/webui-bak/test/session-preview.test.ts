import { describe, expect, test } from "vitest";

import { deriveWorkspaceSessionPreview } from "../src/features/workspaces/session-preview";

describe("Feature: workspace session preview filtering", () => {
  test("Scenario: Given legacy internal failure bubbles in chat history When deriving the session preview Then only user-facing conversation text remains", () => {
    const preview = deriveWorkspaceSessionPreview([
      {
        id: "1",
        role: "user",
        content: "现在几点？",
        timestamp: 1,
        cycleId: null,
      },
      {
        id: "2",
        role: "assistant",
        channel: "to_user",
        content:
          'agenter-ai call failed: openai-chat response failed after 1 attempt(s): 402 status code ({"error":{"message":"Insufficient Balance"}})',
        timestamp: 2,
        cycleId: 1,
      },
      {
        id: "3",
        role: "assistant",
        channel: "to_user",
        content: "北京时间下午四点。",
        timestamp: 3,
        cycleId: 2,
      },
    ]);

    expect(preview).toEqual({
      firstUserMessage: "现在几点？",
      latestMessages: ["现在几点？", "北京时间下午四点。"],
    });
  });
});
