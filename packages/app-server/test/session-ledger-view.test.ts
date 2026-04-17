import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { SessionDb } from "@agenter/session-system";

import {
  toHeartbeatCompactSeparatorUpsertInput,
  toHeartbeatEventMessageUpsertInput,
} from "../src/heartbeat-message-parts";
import { projectAiCallToModelCall, projectHeartbeatMessageToChatMessage } from "../src/session-ledger-view";

const tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

const createSessionDb = (): SessionDb => {
  const root = mkdtempSync(join(tmpdir(), "agenter-session-ledger-"));
  tempRoots.push(root);
  return new SessionDb(join(root, "session.db"));
};

describe("Feature: session heartbeat ledger projection", () => {
  test("Scenario: Given a compact cycle boundary When it is persisted into heartbeat_part Then the projected row becomes a system separator", () => {
    const db = createSessionDb();
    try {
      const compactRecord = db.upsertMessage(
        toHeartbeatCompactSeparatorUpsertInput({
          aiCallId: 41,
          timestamp: Date.UTC(2026, 3, 12, 14, 25, 25),
          callRoundIndex: 2,
          currentRoundIndex: 3,
          compactTrigger: "manual",
        }),
      );

      const projected = projectHeartbeatMessageToChatMessage(compactRecord);

      expect(projected.role).toBe("system");
      expect(projected.heartbeatKind).toBe("compact_separator");
      expect(projected.compactTrigger).toBe("manual");
      expect(projected.format).toBe("plain");
      expect(projected.content).toContain("Prompt window compacted (manual)");
    } finally {
      db.close();
    }
  });

  test("Scenario: Given heartbeat messages around a compact boundary When listing the ledger Then the separator stays in chronological order between normal rows", () => {
    const db = createSessionDb();
    try {
      db.upsertMessage(
        toHeartbeatEventMessageUpsertInput({
          message: {
            id: "user-1",
            chatId: "runtime-heartbeat",
            role: "user",
            content: "Please compact the prompt window before the next reply.",
            timestamp: Date.UTC(2026, 3, 12, 14, 25, 0),
            format: "markdown",
          },
          roundIndex: 2,
        }),
      );
      db.upsertMessage(
        toHeartbeatCompactSeparatorUpsertInput({
          aiCallId: 52,
          timestamp: Date.UTC(2026, 3, 12, 14, 25, 25),
          callRoundIndex: 2,
          currentRoundIndex: 3,
          compactTrigger: "threshold",
        }),
      );
      db.upsertMessage(
        toHeartbeatEventMessageUpsertInput({
          message: {
            id: "assistant-1",
            chatId: "runtime-heartbeat",
            role: "assistant",
            content: "Compaction finished. Continuing from the rebuilt prompt window.",
            timestamp: Date.UTC(2026, 3, 12, 14, 25, 40),
            format: "markdown",
          },
          roundIndex: 3,
          aiCallId: 53,
        }),
      );

      const projected = db
        .listMessagesByScope("heartbeat_part", { limit: 10 })
        .map(projectHeartbeatMessageToChatMessage);

      expect(projected.map((message) => message.id)).toEqual([
        "user-1",
        "heartbeat-part:ai-call:52:compact",
        "assistant-1",
      ]);
      expect(projected.map((message) => message.heartbeatKind ?? "message")).toEqual([
        "message",
        "compact_separator",
        "message",
      ]);
    } finally {
      db.close();
    }
  });

  test("Scenario: Given an ai_call stores provider snapshot inside request config When projecting model-call rows Then provider snapshot stays available to the UI", () => {
    const db = createSessionDb();
    try {
      const call = db.appendAiCall({
        roundIndex: 8,
        kind: "model",
        status: "done",
        provider: "openai/chat",
        model: "gpt-5.1",
        requestUrl: "https://example.test/v1/responses",
        requestBody: {
          meta: { cycleId: 8 },
          config: {
            providerSnapshot: {
              providerId: "default",
              apiStandard: "openai-responses",
              vendor: "openai",
              profile: null,
              model: "gpt-5.1",
              maxContextTokens: 128_000,
            },
          },
        },
        responseBody: {
          response: {
            usage: {
              promptTokens: 120,
              completionTokens: 48,
              totalTokens: 168,
            },
          },
          outcome: { code: "done" },
        },
        createdAt: Date.UTC(2026, 3, 12, 14, 26, 0),
        updatedAt: Date.UTC(2026, 3, 12, 14, 26, 5),
        completedAt: Date.UTC(2026, 3, 12, 14, 26, 5),
        isComplete: true,
      });

      const projected = projectAiCallToModelCall(call);

      expect(projected.providerSnapshot).toEqual({
        providerId: "default",
        apiStandard: "openai-responses",
        vendor: "openai",
        profile: null,
        model: "gpt-5.1",
        maxContextTokens: 128_000,
      });
    } finally {
      db.close();
    }
  });
});
