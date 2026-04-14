import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { SessionDb } from "../src/session-db";

const tempDirs: string[] = [];

const createDb = () => {
  const dir = mkdtempSync(join(tmpdir(), "agenter-session-db-"));
  tempDirs.push(dir);
  return new SessionDb(join(dir, "session.db"));
};

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("Feature: session-system AI-call ledger persistence", () => {
  test("Scenario: Given a streamed heartbeat message When the same logical message is updated Then part ids stay stable and content advances", () => {
    const db = createDb();
    try {
      const first = db.upsertMessage({
        messageId: "msg-assistant-1",
        roundIndex: 0,
        scope: "heartbeat_part",
        role: "assistant",
        createdAt: 100,
        updatedAt: 100,
        parts: [{ partType: "text", payload: "hel", isComplete: false }],
      });
      const updated = db.upsertMessage({
        messageId: "msg-assistant-1",
        roundIndex: 0,
        scope: "heartbeat_part",
        role: "assistant",
        createdAt: 100,
        updatedAt: 120,
        parts: [{ partType: "text", payload: "hello", isComplete: true }],
      });

      expect(first.parts[0]?.partId).toBe(updated.parts[0]?.partId);
      expect(updated.text).toBe("hello");
      expect(updated.isComplete).toBeTrue();
    } finally {
      db.close();
    }
  });

  test("Scenario: Given prompt-window ledger writes When promoting one as current Then head points at the current prompt window", () => {
    const db = createDb();
    try {
      const first = db.savePromptWindow({
        createdAt: 100,
        messages: [{ role: "user", content: "hello" }],
      });
      const current = db.savePromptWindow({
        createdAt: 200,
        messages: [
          { role: "assistant", content: "summary" },
          { role: "user", content: "next" },
        ],
        setCurrent: true,
      });

      expect(first.promptWindowId).not.toBe(current.promptWindowId);
      expect(db.getHead().currentPromptWindowId).toBe(current.promptWindowId);
      expect(db.getCurrentPromptWindow()?.messages).toEqual(current.messages);
    } finally {
      db.close();
    }
  });

  test("Scenario: Given an empty prompt window When it is saved as current Then the ledger keeps an explicit bootstrap state row while reconstruction stays empty", () => {
    const db = createDb();
    try {
      const current = db.savePromptWindow({
        createdAt: 100,
        messages: [],
        setCurrent: true,
      });

      const rows = db.listMessagesByScope("prompt_window", { windowId: current.promptWindowId });

      expect(rows).toHaveLength(1);
      expect(rows[0]?.parts[0]?.partType).toBe("state");
      expect(db.getHead().currentPromptWindowId).toBe(current.promptWindowId);
      expect(db.getCurrentPromptWindow()?.messages).toEqual([]);
    } finally {
      db.close();
    }
  });

  test("Scenario: Given bootstrap payload changes When request-side auxiliary parts are stored Then unchanged payloads are not required for every call", () => {
    const db = createDb();
    try {
      db.upsertMessage({
        messageId: "aux-system",
        roundIndex: 0,
        scope: "request_aux",
        role: "system",
        parts: [{ partType: "systemPrompt", payload: "You are helpful", isComplete: true }],
      });
      db.upsertMessage({
        messageId: "aux-tools",
        roundIndex: 0,
        scope: "request_aux",
        role: "system",
        parts: [{ partType: "tools", payload: [{ name: "workspace.bash" }], isComplete: true }],
      });

      const rows = db.listMessagesByScope("request_aux");
      expect(rows.map((row) => row.messageId)).toEqual(["aux-system", "aux-tools"]);
    } finally {
      db.close();
    }
  });

  test("Scenario: Given AI calls across three rounds When pruning old rounds Then only current and previous rounds remain", () => {
    const db = createDb();
    try {
      db.appendAiCall({
        roundIndex: 0,
        kind: "attention",
        provider: "deepseek",
        model: "deepseek-chat",
        requestUrl: "http://localhost/v1/chat/completions",
        requestBody: { round: 0 },
      });
      db.appendAiCall({
        roundIndex: 1,
        kind: "attention",
        provider: "deepseek",
        model: "deepseek-chat",
        requestUrl: "http://localhost/v1/chat/completions",
        requestBody: { round: 1 },
      });
      db.appendAiCall({
        roundIndex: 2,
        kind: "compact",
        provider: "deepseek",
        model: "deepseek-chat",
        requestUrl: "http://localhost/v1/chat/completions",
        requestBody: { round: 2 },
      });

      db.pruneAiCallsBeforeRound(1);

      expect(db.listAiCalls().map((row) => row.roundIndex)).toEqual([1, 2]);
    } finally {
      db.close();
    }
  });

  test("Scenario: Given heartbeat-part and request-aux rows When paging multiple scopes together Then the merged page stays chronological", () => {
    const db = createDb();
    try {
      db.upsertMessage({
        messageId: "heartbeat-request-1",
        roundIndex: 0,
        scope: "heartbeat_part",
        role: "user",
        createdAt: 100,
        updatedAt: 100,
        parts: [{ partType: "text", payload: { type: "text", content: "context" }, isComplete: true }],
      });
      db.upsertMessage({
        messageId: "request-aux-config-1",
        roundIndex: 0,
        scope: "request_aux",
        role: "config",
        createdAt: 110,
        updatedAt: 110,
        parts: [{ partType: "config", payload: { temperature: 0.2 }, isComplete: true }],
      });
      db.upsertMessage({
        messageId: "heartbeat-response-1",
        roundIndex: 0,
        scope: "heartbeat_part",
        role: "assistant",
        createdAt: 120,
        updatedAt: 120,
        parts: [{ partType: "text", payload: { type: "text", content: "reply" }, isComplete: true }],
      });

      const page = db.pageMessagesByScopes(["heartbeat_part", "request_aux"], { limit: 10 });

      expect(page.items.map((row) => row.messageId)).toEqual([
        "heartbeat-request-1",
        "request-aux-config-1",
        "heartbeat-response-1",
      ]);
      expect(page.items.map((row) => row.scope)).toEqual(["heartbeat_part", "request_aux", "heartbeat_part"]);
      expect(page.hasMoreBefore).toBeFalse();
    } finally {
      db.close();
    }
  });
});
