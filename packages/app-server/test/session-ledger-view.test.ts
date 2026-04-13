import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { SessionDb } from "@agenter/session-system";

import {
  projectHeartbeatMessageToChatMessage,
  toHeartbeatCompactSeparatorUpsertInput,
  toHeartbeatMessageUpsertInput,
} from "../src/session-ledger-view";

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
  test("Scenario: Given a compact cycle boundary When it is persisted into heartbeat scope Then the projected row becomes a system separator", () => {
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
        toHeartbeatMessageUpsertInput({
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
        toHeartbeatMessageUpsertInput({
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

      const projected = db.listMessagesByScope("heartbeat", { limit: 10 }).map(projectHeartbeatMessageToChatMessage);

      expect(projected.map((message) => message.id)).toEqual([
        "user-1",
        "heartbeat:compact:52",
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
});
