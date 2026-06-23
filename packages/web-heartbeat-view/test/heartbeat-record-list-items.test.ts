import { describe, expect, test } from "vitest";

import { buildHeartbeatRecordListItems, type HeartbeatRecordItem } from "../src";

const record = (input: { id: number; startedAt: number }): HeartbeatRecordItem => ({
  id: input.id,
  recordKey: `record:${input.id}`,
  kind: "model_call",
  status: "completed",
  primaryAiCallId: input.id,
  aiCallIds: [input.id],
  sourceRefs: [],
  featureFlags: {},
  summary: {
    provider: "openai",
    model: "gpt-test",
    parts: [],
    counts: {
      parts: 0,
      toolCalls: 0,
      toolResults: 0,
      errors: 0,
    },
    firstFrameMs: null,
    thinkingDurationMs: 0,
  },
  previewText: null,
  startedAt: input.startedAt,
  updatedAt: input.startedAt,
  completedAt: input.startedAt,
  isComplete: true,
});

describe("Feature: Heartbeat record list projection", () => {
  test("Scenario: Given ascending API records When building list items Then date dividers are inserted without reordering records", () => {
    const first = record({ id: 1, startedAt: Date.UTC(2026, 0, 1, 23, 59) });
    const second = record({ id: 2, startedAt: Date.UTC(2026, 0, 2, 0, 1) });
    const third = record({ id: 3, startedAt: Date.UTC(2026, 0, 2, 0, 2) });

    expect(buildHeartbeatRecordListItems([first, second, third])).toEqual([
      { kind: "date-divider", date: "2026-01-01" },
      { kind: "record", record: first },
      { kind: "date-divider", date: "2026-01-02" },
      { kind: "record", record: second },
      { kind: "record", record: third },
    ]);
  });
});
