import { describe, expect, test } from "vitest";

import { extractInternalFailureNotice, isInternalFailureMessage } from "../src/features/chat/internal-system-messages";

describe("Feature: internal system-message detection", () => {
  test("Scenario: Given legacy assistant failure bubbles When classifying chat rows Then they are hidden from user conversation surfaces and reused as notices", () => {
    const messages = [
      {
        id: "1",
        role: "assistant" as const,
        channel: "to_user" as const,
        content:
          'agenter-ai call failed: openai-chat response failed after 1 attempt(s): 402 status code ({"error":{"message":"Insufficient Balance"}})',
      },
      {
        id: "2",
        role: "assistant" as const,
        channel: "to_user" as const,
        content: "正常回复",
      },
    ];

    expect(isInternalFailureMessage(messages[0]!)).toBe(true);
    expect(isInternalFailureMessage(messages[1]!)).toBe(false);
    expect(extractInternalFailureNotice(messages)).toBe(
      'openai-chat response failed after 1 attempt(s): 402 status code ({"error":{"message":"Insufficient Balance"}})',
    );
  });
});
