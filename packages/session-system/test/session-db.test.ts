import { afterEach, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
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

describe("Feature: session-system ledger persistence", () => {
  test("Scenario: Given cycles and a moved head When reading the current branch Then the branch follows head pointers", () => {
    const db = createDb();
    try {
      const root = db.appendCycle({ result: { step: "root" } });
      const branchA = db.appendCycle({ prevCycleId: root.id, result: { step: "branch-a" } });
      const branchB = db.appendCycle({ prevCycleId: root.id, result: { step: "branch-b" } });

      db.setHead(branchA.id);
      expect(db.listCurrentBranchCycles().map((item) => item.result)).toEqual([{ step: "root" }, { step: "branch-a" }]);

      db.setHead(branchB.id);
      expect(db.listCurrentBranchCycles().map((item) => item.result)).toEqual([{ step: "root" }, { step: "branch-b" }]);
    } finally {
      db.close();
    }
  });

  test("Scenario: Given blocks model calls and api calls When querying before and after Then records keep insertion order", () => {
    const db = createDb();
    try {
      const cycle = db.appendCycle({ result: { step: "collect" } });
      const model = db.appendModelCall({
        cycleId: cycle.id,
        provider: "deepseek",
        model: "deepseek-chat",
        request: { messages: 1 },
        response: { id: "resp-1" },
      });

      const block1 = db.appendBlock({ role: "user", channel: "user_input", chatId: "chat-main", content: "hello" });
      const block2 = db.appendBlock({
        cycleId: cycle.id,
        role: "assistant",
        channel: "tool",
        chatId: "chat-tools",
        content: "```yaml\nok: true\n```",
        tool: {
          invocationId: "call-terminal-read",
          name: "terminal_read",
          status: "success",
          startedAt: cycle.createdAt,
          finishedAt: cycle.createdAt + 1,
          call: {
            value: {
              terminalId: "iflow",
            },
          },
          result: {
            value: {
              ok: true,
            },
          },
        },
      });
      const api = db.appendApiCall({
        modelCallId: model.id,
        request: { body: { prompt: "hello" } },
        response: { body: { reply: "hi" } },
      });

      expect(db.listBlocksAfter(0).map((item) => item.id)).toEqual([block1.id, block2.id]);
      expect(db.listBlocksBefore(block2.id + 1).map((item) => item.id)).toEqual([block1.id, block2.id]);
      expect(db.getModelCallByCycleId(cycle.id)?.id).toBe(model.id);
      expect(db.listApiCallsByModelCall(model.id).map((item) => item.id)).toEqual([api.id]);
      expect(db.getBlockById(block1.id)?.chatId).toBe("chat-main");
      expect(db.getBlockById(block2.id)?.tool).toMatchObject({
        invocationId: "call-terminal-read",
        name: "terminal_read",
        status: "success",
      });
      expect(db.getBlockById(block2.id)?.chatId).toBe("chat-tools");
    } finally {
      db.close();
    }
  });

  test("Scenario: Given multiple model attempts for the same cycle When the ledger persists them Then cycle lookup returns the newest attempt instead of crashing", () => {
    const db = createDb();
    try {
      const cycle = db.appendCycle({ result: { step: "collect" } });
      const first = db.appendModelCall({
        cycleId: cycle.id,
        provider: "deepseek",
        model: "deepseek-chat",
        request: { attempt: 1 },
        error: { message: "attention.no_progress" },
        status: "error",
      });
      const second = db.appendModelCall({
        cycleId: cycle.id,
        provider: "deepseek",
        model: "deepseek-chat",
        request: { attempt: 2 },
        response: { ok: true },
        status: "done",
      });

      expect(db.listModelCalls().map((item) => item.id)).toEqual([first.id, second.id]);
      expect(db.getModelCallByCycleId(cycle.id)?.id).toBe(second.id);
    } finally {
      db.close();
    }
  });

  test("Scenario: Given a legacy session db with unique cycle-bound model calls When the db migrates Then retry attempts for one cycle become legal", () => {
    const dir = mkdtempSync(join(tmpdir(), "agenter-session-db-legacy-"));
    tempDirs.push(dir);
    const filePath = join(dir, "session.db");
    const legacy = new Database(filePath, { create: true, strict: true });
    legacy.exec(`
      create table session_head (
        id integer primary key check (id = 1),
        head_cycle_id integer,
        updated_at integer not null
      );
      insert into session_head (id, head_cycle_id, updated_at) values (1, null, 0);
      create table session_cycle (
        id integer primary key autoincrement,
        seq integer not null unique,
        prev_cycle_id integer,
        created_at integer not null,
        wake_json text not null,
        collected_inputs_json text not null,
        extends_json text not null,
        result_json text not null
      );
      create table model_call (
        id integer primary key autoincrement,
        cycle_id integer not null unique,
        created_at integer not null,
        status text not null default 'done',
        completed_at integer,
        provider text not null,
        model text not null,
        request_json text not null,
        response_json text,
        error_json text,
        trace_json text,
        outcome_json text
      );
      insert into session_cycle (seq, prev_cycle_id, created_at, wake_json, collected_inputs_json, extends_json, result_json)
      values (1, null, 1000, '{}', '[]', '{}', '{}');
      insert into model_call (cycle_id, created_at, status, completed_at, provider, model, request_json, response_json, error_json, trace_json, outcome_json)
      values (1, 1000, 'error', null, 'deepseek', 'deepseek-chat', '{"attempt":1}', null, '{"message":"first"}', null, null);
    `);
    legacy.close();

    const db = new SessionDb(filePath);
    try {
      const second = db.appendModelCall({
        cycleId: 1,
        provider: "deepseek",
        model: "deepseek-chat",
        request: { attempt: 2 },
        response: { ok: true },
        status: "done",
      });
      expect(second.id).toBeGreaterThan(1);
      expect(db.getModelCallByCycleId(1)?.id).toBe(second.id);
      expect(db.listModelCalls().map((item) => item.cycleId)).toEqual([1, 1]);
    } finally {
      db.close();
    }
  });

  test("Scenario: Given a legacy session db without session_block chat ids When the db migrates Then old blocks remain readable and new blocks can persist chatId", () => {
    const dir = mkdtempSync(join(tmpdir(), "agenter-session-db-legacy-blocks-"));
    tempDirs.push(dir);
    const filePath = join(dir, "session.db");
    const legacy = new Database(filePath, { create: true, strict: true });
    legacy.exec(`
      create table session_head (
        id integer primary key check (id = 1),
        head_cycle_id integer,
        updated_at integer not null
      );
      insert into session_head (id, head_cycle_id, updated_at) values (1, null, 0);
      create table session_cycle (
        id integer primary key autoincrement,
        seq integer not null unique,
        prev_cycle_id integer,
        created_at integer not null,
        wake_json text not null,
        collected_inputs_json text not null,
        extends_json text not null,
        result_json text not null
      );
      create table session_block (
        id integer primary key autoincrement,
        seq integer not null unique,
        cycle_id integer,
        created_at integer not null,
        role text not null,
        channel text not null,
        format text not null,
        content text not null,
        tool_json text
      );
      insert into session_block (seq, cycle_id, created_at, role, channel, format, content, tool_json)
      values (1, null, 1000, 'user', 'user_input', 'markdown', 'legacy hello', null);
    `);
    legacy.close();

    const db = new SessionDb(filePath);
    try {
      expect(db.getBlockById(1)?.chatId).toBeNull();
      const inserted = db.appendBlock({
        role: "assistant",
        channel: "to_user",
        chatId: "chat-main",
        content: "modern hello",
      });
      expect(inserted.chatId).toBe("chat-main");
      expect(db.listBlocksAfter(0).map((item) => item.chatId)).toEqual([null, "chat-main"]);
    } finally {
      db.close();
    }
  });

  test("Scenario: Given image assets linked to a chat block When reading the block back Then attachment metadata stays attached in order", () => {
    const db = createDb();
    try {
      const firstAsset = db.appendAsset({
        id: "asset-1",
        kind: "image",
        name: "diagram.png",
        mimeType: "image/png",
        sizeBytes: 128,
        relativePath: "assets/images/asset-1.png",
      });
      const secondAsset = db.appendAsset({
        id: "asset-2",
        kind: "image",
        name: "mockup.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 256,
        relativePath: "assets/images/asset-2.jpg",
      });

      const block = db.appendBlock({
        role: "user",
        channel: "user_input",
        content: "Please inspect these screenshots.",
      });
      db.linkBlockAssets(block.id, [secondAsset.id, firstAsset.id]);

      expect(db.getBlockById(block.id)?.attachments.map((item) => item.id)).toEqual([secondAsset.id, firstAsset.id]);
      expect(db.listBlocksAfter(0)[0]?.attachments.map((item) => item.name)).toEqual(["mockup.jpg", "diagram.png"]);
      expect(db.listAssetsByIds([firstAsset.id, secondAsset.id]).map((item) => item.mimeType)).toEqual([
        "image/png",
        "image/jpeg",
      ]);
    } finally {
      db.close();
    }
  });

  test("Scenario: Given reverse-time block pages with tied timestamps When paging older history Then the explicit cursor keeps oldest-to-newest order without duplicates", () => {
    const db = createDb();
    try {
      const first = db.appendBlock({ createdAt: 1_000, role: "user", channel: "user_input", content: "first" });
      const second = db.appendBlock({ createdAt: 2_000, role: "user", channel: "user_input", content: "second" });
      const third = db.appendBlock({ createdAt: 2_000, role: "assistant", channel: "to_user", content: "third" });
      const fourth = db.appendBlock({ createdAt: 3_000, role: "assistant", channel: "to_user", content: "fourth" });

      const newestPage = db.listBlocksPage({ limit: 2 });
      expect(newestPage.items.map((item) => item.id)).toEqual([third.id, fourth.id]);
      expect(newestPage.nextBefore).toEqual({
        beforeTimeMs: third.createdAt,
        beforeId: third.id,
      });
      expect(newestPage.hasMoreBefore).toBe(true);

      const olderPage = db.listBlocksPage({ before: newestPage.nextBefore ?? undefined, limit: 2 });
      expect(olderPage.items.map((item) => item.id)).toEqual([first.id, second.id]);
      expect(olderPage.nextBefore).toBeNull();
      expect(olderPage.hasMoreBefore).toBe(false);
    } finally {
      db.close();
    }
  });

  test("Scenario: Given persisted loopbus state logs and terminal activity When querying reverse pages Then each timeline stays server-backed and independently ordered", () => {
    const db = createDb();
    try {
      const stateLog1 = db.appendLoopStateLog({
        timestamp: 1_000,
        stateVersion: 1,
        event: "boot",
        prevHash: null,
        stateHash: "hash-1",
        patch: [{ op: "add", path: "/phase", value: "waiting_commits" }],
      });
      const stateLog2 = db.appendLoopStateLog({
        timestamp: 2_000,
        stateVersion: 2,
        event: "collect",
        prevHash: "hash-1",
        stateHash: "hash-2",
        patch: [{ op: "replace", path: "/phase", value: "collecting_inputs" }],
      });
      const stateLog3 = db.appendLoopStateLog({
        timestamp: 2_000,
        stateVersion: 3,
        event: "call-model",
        prevHash: "hash-2",
        stateHash: "hash-3",
        patch: [{ op: "replace", path: "/phase", value: "calling_model" }],
      });

      db.appendTerminalActivity({
        terminalId: "main",
        createdAt: 1_000,
        kind: "terminal_write",
        title: "write-1",
        content: "echo 1",
      });
      const activity2 = db.appendTerminalActivity({
        terminalId: "main",
        createdAt: 2_000,
        kind: "terminal_read",
        title: "read-2",
        content: "stdout 2",
      });
      const activity3 = db.appendTerminalActivity({
        terminalId: "main",
        createdAt: 2_000,
        kind: "message",
        title: "message-3",
        content: "assistant mentions main",
      });

      const logPage = db.listLoopStateLogsPage({ limit: 2 });
      expect(logPage.items.map((item) => item.id)).toEqual([stateLog2.id, stateLog3.id]);
      expect(logPage.nextBefore).toEqual({
        beforeTimeMs: stateLog2.timestamp,
        beforeId: stateLog2.id,
      });

      const olderLogPage = db.listLoopStateLogsPage({ before: logPage.nextBefore ?? undefined, limit: 2 });
      expect(olderLogPage.items.map((item) => item.id)).toEqual([stateLog1.id]);
      expect(olderLogPage.hasMoreBefore).toBe(false);

      const activityPage = db.listTerminalActivityPage("main", { limit: 2 });
      expect(activityPage.items.map((item) => item.id)).toEqual([activity2.id, activity3.id]);
      expect(activityPage.nextBefore).toEqual({
        beforeTimeMs: activity2.createdAt,
        beforeId: activity2.id,
      });

      const olderActivityPage = db.listTerminalActivityPage("main", {
        before: activityPage.nextBefore ?? undefined,
        limit: 2,
      });
      expect(olderActivityPage.items.map((item) => item.title)).toEqual(["write-1"]);
      expect(olderActivityPage.hasMoreBefore).toBe(false);
    } finally {
      db.close();
    }
  });
});
