import { describe, expect, test } from "vitest";

import {
  buildHeartbeatRecordChipTokens,
  buildHeartbeatRecordTimeline,
  type HeartbeatRecordChipToken,
} from "../src/heartbeat-record-chips";
import type { HeartbeatRecordItem, HeartbeatRecordPartSummary } from "../src";

const part = (input: {
  partId: string;
  type: string;
  startedAt: number;
  role?: HeartbeatRecordPartSummary["role"];
  label?: string;
  tokenCount?: number;
  sizeBytes?: number;
  durationMs?: number;
  completedAt?: number | null;
}): HeartbeatRecordPartSummary => ({
  messageId: `message-${input.partId}`,
  partId: input.partId,
  role: input.role ?? "user",
  type: input.type,
  mimeType: null,
  aiCallId: 1,
  startedAt: input.startedAt,
  completedAt: input.completedAt ?? input.startedAt + 10,
  label: input.label ?? input.type,
  isComplete: true,
  tokenCount: input.tokenCount,
  sizeBytes: input.sizeBytes,
  durationMs: input.durationMs,
});

const recordWithParts = (parts: HeartbeatRecordPartSummary[]): HeartbeatRecordItem => ({
  id: 1,
  recordKey: "record:media-input",
  kind: "model_call",
  status: "completed",
  primaryAiCallId: 1,
  aiCallIds: [1],
  sourceRefs: [],
  featureFlags: {},
  summary: {
    provider: "openai",
    model: "gpt-test",
    parts,
    counts: {
      parts: parts.length,
      toolCalls: 0,
      toolResults: 0,
      errors: 0,
    },
    firstFrameMs: null,
    thinkingDurationMs: 0,
  },
  previewText: null,
  startedAt: 1_000,
  updatedAt: 1_100,
  completedAt: 1_100,
  isComplete: true,
});

const tokenLabel = (tokens: HeartbeatRecordChipToken[], kind: HeartbeatRecordChipToken["kind"]): string | null =>
  tokens.find((token) => token.kind === kind)?.label ?? null;

describe("Feature: Heartbeat Record chip metric projection", () => {
  test("Scenario: Given structured input part metrics When model-run chips render Then media and token facts survive the compact chip grammar", () => {
    const timeline = buildHeartbeatRecordTimeline(
      recordWithParts([
        part({ partId: "text", type: "text", startedAt: 1_000, label: "review the attached media", tokenCount: 31 }),
        part({ partId: "image", type: "image", startedAt: 1_010, sizeBytes: 2_048 }),
        part({ partId: "file", type: "file", startedAt: 1_020, sizeBytes: 5_120 }),
        part({ partId: "video", type: "video", startedAt: 1_030, durationMs: 3_200 }),
      ]),
      900,
    );

    const inputChip = timeline.chips.find((chip) => chip.kind === "input");
    expect(inputChip).not.toBeNull();

    const tokens = buildHeartbeatRecordChipTokens(inputChip!, "full");
    expect(tokenLabel(tokens, "text")).toBe("31t");
    expect(tokenLabel(tokens, "image")).toBe("2K");
    expect(tokenLabel(tokens, "file")).toBe("5K");
    expect(tokenLabel(tokens, "video")).toBe("3.2s");
  });

  test("Scenario: Given tool results in a model run When chips are built Then tool results merge back into the source tool chip", () => {
    const timeline = buildHeartbeatRecordTimeline(
      recordWithParts([
        part({ partId: "input", role: "user", type: "text", startedAt: 1_000, tokenCount: 12 }),
        part({ partId: "thinking", role: "assistant", type: "thinking", startedAt: 1_050, completedAt: 1_650 }),
        part({ partId: "tool-call", role: "assistant", type: "tool_call", startedAt: 1_650, label: "workspace.read" }),
        part({ partId: "tool-result", role: "user", type: "tool_result", startedAt: 1_820, label: "read output" }),
        part({ partId: "answer", role: "assistant", type: "text", startedAt: 2_000, tokenCount: 42 }),
      ]),
      900,
    );

    const inputChip = timeline.chips.find((chip) => chip.kind === "input");
    const toolChip = timeline.chips.find((chip) => chip.kind === "tool");
    expect(inputChip?.parts.map((summary) => summary.type)).not.toContain("tool_result");
    expect(toolChip?.parts.map((summary) => summary.type)).toEqual(["tool_call", "tool_result"]);
    expect(toolChip?.count).toBe(1);

    const toolTokens = buildHeartbeatRecordChipTokens(toolChip!, "full");
    expect(tokenLabel(toolTokens, "tool")).toBe("");
  });

  test("Scenario: Given a dense model run When width changes Then the metro keeps input, a middle combo, and the latest tail without overflow-prone expansion", () => {
    const denseRecord = recordWithParts([
      part({ partId: "input", role: "user", type: "text", startedAt: 1_000, tokenCount: 18 }),
      part({ partId: "thinking-a", role: "assistant", type: "thinking", startedAt: 1_050, completedAt: 2_050 }),
      part({ partId: "tool-call-a", role: "assistant", type: "tool_call", startedAt: 2_050, label: "workspace.read" }),
      part({ partId: "tool-result-a", role: "user", type: "tool_result", startedAt: 2_300, label: "read output" }),
      part({ partId: "thinking-b", role: "assistant", type: "thinking", startedAt: 2_600, completedAt: 4_000 }),
      part({ partId: "tool-call-b", role: "assistant", type: "tool_call", startedAt: 4_000, label: "workspace.apply" }),
      part({ partId: "tool-result-b", role: "user", type: "tool_result", startedAt: 4_400, label: "apply output" }),
      part({ partId: "answer", role: "assistant", type: "text", startedAt: 5_000, tokenCount: 64 }),
    ]);

    const narrow = buildHeartbeatRecordTimeline(denseRecord, 260);
    const wide = buildHeartbeatRecordTimeline(denseRecord, 1_200);

    expect(narrow.density).toBe("narrow");
    expect(narrow.chips[0]?.kind).toBe("input");
    expect(narrow.chips.at(-1)?.kind).toBe("text");
    expect(narrow.chips.some((chip) => chip.kind === "combo")).toBe(true);
    expect(narrow.hiddenCount).toBeGreaterThan(0);
    expect(narrow.chips.length).toBeLessThan(wide.chips.length);

    expect(wide.density).toBe("full");
    expect(wide.hiddenCount).toBe(0);
    expect(wide.chips.some((chip) => chip.kind === "combo")).toBe(false);
    expect(wide.chips.filter((chip) => chip.kind === "tool")).toHaveLength(2);
  });
});
