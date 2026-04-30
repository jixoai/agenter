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
  test("Scenario: Given attention delivery facts When dispatches bind to ai_call rows later Then attempts and receipts stay durable without rewriting commit truth", () => {
    const db = createDb();
    try {
      const dispatch = db.appendAttentionDispatch({
        dispatchId: "dispatch-1",
        contextId: "ctx-room",
        commitId: "commit-1",
        cycleId: 7,
        attemptIndex: 1,
        agentCallId: "agent-call-1",
        createdAt: 100,
      });

      const receipt = db.appendAttentionReceipt({
        receiptId: "receipt-1",
        dispatchId: dispatch.dispatchId,
        contextId: dispatch.contextId,
        commitId: dispatch.commitId,
        cycleId: dispatch.cycleId,
        attemptIndex: dispatch.attemptIndex,
        agentCallId: dispatch.agentCallId,
        status: "accepted",
        providerEventKind: "text_delta",
        timestamp: 120,
      });

      db.bindAttentionDispatchModelCall(dispatch.dispatchId, 42, 140);

      expect(db.getAttentionDispatchByDispatchId(dispatch.dispatchId)).toMatchObject({
        dispatchId: "dispatch-1",
        sessionModelCallId: 42,
        updatedAt: 140,
      });
      expect(db.getAttentionReceiptByReceiptId(receipt.receiptId)).toMatchObject({
        receiptId: "receipt-1",
        sessionModelCallId: 42,
        status: "accepted",
      });
      expect(db.listAttentionDispatches({ contextId: "ctx-room", commitId: "commit-1" })).toHaveLength(1);
      expect(db.listAttentionReceipts({ dispatchId: "dispatch-1" })).toHaveLength(1);
    } finally {
      db.close();
    }
  });

  test("Scenario: Given a generic runtime watch When it expires or is satisfied Then durable watch inspection preserves owner and reminder linkage", () => {
    const db = createDb();
    try {
      const watch = db.appendRuntimeWatch({
        watchId: "watch-1",
        ownerActionId: "action-1",
        ownerActionKind: "message_send",
        ownerActorId: "session:test",
        ownerCycleId: 7,
        ownerSessionModelCallId: 42,
        target: "room:chat-main",
        predicate: {
          kind: "message_latest_visible",
          chatId: "chat-main",
          anchorMessageId: 11,
        },
        dueAt: 500,
        meta: { reason: "follow-up" },
      });

      expect(watch.status).toBe("pending");
      expect(db.listRuntimeWatches({ status: "pending" })).toHaveLength(1);

      const expired = db.updateRuntimeWatch("watch-1", {
        status: "expired",
        updatedAt: 520,
        resolvedAt: 520,
        reminderContextId: "ctx-chat-main",
        reminderCommitId: "commit-9",
      });

      expect(expired).toMatchObject({
        watchId: "watch-1",
        ownerActionId: "action-1",
        ownerActionKind: "message_send",
        ownerCycleId: 7,
        ownerSessionModelCallId: 42,
        status: "expired",
        reminderContextId: "ctx-chat-main",
        reminderCommitId: "commit-9",
      });

      const reloaded = db.getRuntimeWatchByWatchId("watch-1");
      expect(reloaded?.predicate).toEqual({
        kind: "message_latest_visible",
        chatId: "chat-main",
        anchorMessageId: 11,
      });
    } finally {
      db.close();
    }
  });

  test("Scenario: Given an explicit room mutation When the effect ledger is appended Then durable inspection can trace action to room effect", () => {
    const db = createDb();
    try {
      const effect = db.appendEffectLedger({
        effectId: "effect-1",
        actionId: "action-1",
        actionKind: "message_send",
        actorId: "session:test",
        cycleId: 7,
        sessionModelCallId: 42,
        target: "room:chat-main",
        effectKind: "message_row_created",
        effectRecordId: "chat-main/11",
        timestamp: 600,
        meta: { chatId: "chat-main", messageId: 11 },
      });

      expect(effect).toMatchObject({
        effectId: "effect-1",
        actionId: "action-1",
        actionKind: "message_send",
        actorId: "session:test",
        cycleId: 7,
        sessionModelCallId: 42,
        target: "room:chat-main",
        effectKind: "message_row_created",
        effectRecordId: "chat-main/11",
      });
      expect(db.listEffectLedger({ actionId: "action-1" })).toHaveLength(1);
      expect(db.listEffectLedger({ target: "room:chat-main" })).toHaveLength(1);
    } finally {
      db.close();
    }
  });

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

  test("Scenario: Given multi-scope message pages with a reverse cursor When requesting the next page Then the cursor continues from the oldest returned head row", () => {
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

      const latest = db.pageMessagesByScopes(["heartbeat_part", "request_aux"], { limit: 2 });

      expect(latest.items.map((row) => row.messageId)).toEqual(["request-aux-config-1", "heartbeat-response-1"]);
      expect(latest.nextBefore).toEqual({
        beforeTimeMs: 110,
        beforeId: latest.items[0]!.id,
      });
      expect(latest.hasMoreBefore).toBeTrue();

      const older = db.pageMessagesByScopes(["heartbeat_part", "request_aux"], {
        before: latest.nextBefore ?? undefined,
        limit: 2,
      });

      expect(older.items.map((row) => row.messageId)).toEqual(["heartbeat-request-1"]);
      expect(older.hasMoreBefore).toBeFalse();
    } finally {
      db.close();
    }
  });

  test("Scenario: Given deep AI-call history When paging with reverse cursors Then each page stays bounded and stable across equal timestamps", () => {
    const db = createDb();
    try {
      db.appendAiCall({
        roundIndex: 0,
        kind: "attention",
        provider: "deepseek",
        model: "deepseek-chat",
        requestUrl: "http://localhost/v1/chat/completions",
        requestBody: { order: 1 },
        createdAt: 100,
      });
      db.appendAiCall({
        roundIndex: 0,
        kind: "attention",
        provider: "deepseek",
        model: "deepseek-chat",
        requestUrl: "http://localhost/v1/chat/completions",
        requestBody: { order: 2 },
        createdAt: 100,
      });
      db.appendAiCall({
        roundIndex: 1,
        kind: "compact",
        provider: "deepseek",
        model: "deepseek-chat",
        requestUrl: "http://localhost/v1/chat/completions",
        requestBody: { order: 3 },
        createdAt: 120,
      });
      db.appendAiCall({
        roundIndex: 2,
        kind: "attention",
        provider: "deepseek",
        model: "deepseek-chat",
        requestUrl: "http://localhost/v1/chat/completions",
        requestBody: { order: 4 },
        createdAt: 140,
      });

      const latest = db.pageAiCalls({ limit: 2 });

      expect(latest.items.map((row) => row.requestBody)).toEqual([{ order: 3 }, { order: 4 }]);
      expect(latest.nextBefore).toEqual({
        beforeTimeMs: 120,
        beforeId: latest.items[0]!.id,
      });
      expect(latest.hasMoreBefore).toBeTrue();

      const older = db.pageAiCalls({ before: latest.nextBefore ?? undefined, limit: 2 });

      expect(older.items.map((row) => row.requestBody)).toEqual([{ order: 1 }, { order: 2 }]);
      expect(older.hasMoreBefore).toBeFalse();
    } finally {
      db.close();
    }
  });
});
