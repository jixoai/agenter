import { Database } from "bun:sqlite";
import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { SessionDb } from "../src/session-db";

const tempDirs: string[] = [];

const createDbFile = () => {
  const dir = mkdtempSync(join(tmpdir(), "agenter-session-db-"));
  tempDirs.push(dir);
  return join(dir, "session.db");
};

const createDb = () => new SessionDb(createDbFile());

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("Feature: session-system persistence", () => {
  test("Scenario: Given mixed message_part ai_call compact and config facts When heartbeat records refresh Then record count ordering kind timestamps preview and source refs are deterministic", () => {
    const db = createDb();
    try {
      db.upsertMessage({
        messageId: "config-1",
        roundIndex: 1,
        scope: "request_aux",
        role: "config",
        createdAt: 80,
        updatedAt: 82,
        parts: [{ partType: "config", payload: { content: { thinking: true, maxToken: 4096 } } }],
      });

      const call = db.appendAiCall({
        roundIndex: 1,
        kind: "chat",
        status: "done",
        provider: "openai",
        model: "gpt-5.1",
        requestUrl: "https://api.example.test/v1/responses",
        requestBody: { model: "gpt-5.1" },
        createdAt: 100,
        updatedAt: 180,
        completedAt: 180,
        isComplete: true,
      });
      db.upsertMessage({
        messageId: "request-1",
        aiCallId: call.id,
        roundIndex: 1,
        scope: "heartbeat_part",
        role: "user",
        createdAt: 100,
        updatedAt: 105,
        parts: [{ partType: "text", payload: { content: "commit attention items" } }],
      });
      db.upsertMessage({
        messageId: "response-1",
        aiCallId: call.id,
        roundIndex: 1,
        scope: "heartbeat_part",
        role: "assistant",
        createdAt: 120,
        updatedAt: 180,
        parts: [
          { partType: "thinking", payload: { content: "checking files" } },
          { partType: "tool_call", payload: { name: "workspace_read", arguments: { path: "README.md" } } },
          { partType: "text", payload: { content: "Updated the record projection." } },
        ],
      });
      db.updateAiCall(call.id, {
        requestMessageIds: ["request-1"],
        responseMessageIds: ["response-1"],
      });

      const compact = db.appendAiCall({
        roundIndex: 2,
        kind: "compact",
        status: "done",
        provider: "openai",
        model: "gpt-5.1",
        requestUrl: "https://api.example.test/v1/responses",
        requestBody: { model: "gpt-5.1" },
        createdAt: 220,
        updatedAt: 260,
        completedAt: 260,
        isComplete: true,
      });
      db.upsertMessage({
        messageId: "compact-response-1",
        aiCallId: compact.id,
        roundIndex: 2,
        scope: "heartbeat_part",
        role: "assistant",
        createdAt: 240,
        updatedAt: 260,
        parts: [{ partType: "text", payload: { content: "New compact context." } }],
      });
      db.updateAiCall(compact.id, {
        responseMessageIds: ["compact-response-1"],
      });

      db.refreshHeartbeatRecords();

      const page = db.pageHeartbeatRecords({ pageSize: 10, anchor: { kind: "latest" } });
      expect(page.totalRecords).toBe(3);
      expect(page.records.map((record) => record.kind)).toEqual(["config", "model_call", "compact"]);
      expect(page.records.map((record) => record.status)).toEqual(["completed", "completed", "completed"]);
      expect(page.records[1]).toMatchObject({
        primaryAiCallId: call.id,
        aiCallIds: [call.id],
        previewText: "Updated the record projection.",
        startedAt: 100,
        updatedAt: 180,
        completedAt: 180,
        isComplete: true,
      });
      expect(page.records[1]?.summary.counts).toMatchObject({
        parts: 4,
        toolCalls: 1,
        toolResults: 0,
        errors: 0,
      });
      expect(page.records[1]?.sourceRefs).toContainEqual({ kind: "ai_call", id: call.id, role: "primary" });
      expect(page.records[1]?.sourceRefs).toContainEqual({
        kind: "message_part",
        messageId: "response-1",
        partId: "response-1:2",
        role: "output",
      });
    } finally {
      db.close();
    }
  });

  test("Scenario: Given 106 synthetic model compact and config facts When heartbeat records refresh Then the materialized projection stays append-stable and ordered by started_at asc id asc", () => {
    const db = createDb();
    try {
      const seedCount = 106;
      for (let index = 0; index < seedCount; index += 1) {
        const startedAt = Date.UTC(2026, 0, 1) + index * 1_000;
        const bucket = index % 3;

        if (bucket === 0) {
          const call = db.appendAiCall({
            roundIndex: index + 1,
            kind: "chat",
            status: "done",
            provider: "openai",
            model: `gpt-test-${String(index).padStart(3, "0")}`,
            requestUrl: "https://api.example.test/v1/responses",
            requestBody: {
              model: "gpt-test",
              meta: { batch: Math.floor(index / 3), variant: "model_call" },
            },
            createdAt: startedAt,
            updatedAt: startedAt + 900,
            completedAt: startedAt + 900,
            isComplete: true,
          });
          db.upsertMessage({
            messageId: `seed-model-${index}-request`,
            aiCallId: call.id,
            roundIndex: index + 1,
            scope: "heartbeat_part",
            role: "user",
            createdAt: startedAt,
            updatedAt: startedAt + 20,
            parts: [{ partType: "text", payload: { content: `request ${index}` } }],
          });
          db.upsertMessage({
            messageId: `seed-model-${index}-response`,
            aiCallId: call.id,
            roundIndex: index + 1,
            scope: "heartbeat_part",
            role: "assistant",
            createdAt: startedAt + 100,
            updatedAt: startedAt + 900,
            parts: [
              { partType: "thinking", payload: { content: `thinking ${index}` } },
              { partType: "tool_call", payload: { name: "workspace_read", arguments: { path: `docs/${index}.md` } } },
              { partType: "text", payload: { content: `response ${index}` } },
            ],
          });
          db.updateAiCall(call.id, {
            requestMessageIds: [`seed-model-${index}-request`],
            responseMessageIds: [`seed-model-${index}-response`],
          });
          continue;
        }

        if (bucket === 1) {
          const call = db.appendAiCall({
            roundIndex: index + 1,
            kind: "compact",
            status: "done",
            provider: "openai",
            model: `gpt-test-${String(index).padStart(3, "0")}`,
            requestUrl: "https://api.example.test/v1/responses",
            requestBody: {
              model: "gpt-test",
              compact: { batch: Math.floor(index / 3) },
            },
            createdAt: startedAt,
            updatedAt: startedAt + 700,
            completedAt: startedAt + 700,
            isComplete: true,
          });
          db.upsertMessage({
            messageId: `seed-compact-${index}-response`,
            aiCallId: call.id,
            roundIndex: index + 1,
            scope: "heartbeat_part",
            role: "assistant",
            createdAt: startedAt + 400,
            updatedAt: startedAt + 700,
            parts: [
              { partType: "compact", payload: { content: { batch: Math.floor(index / 3), kind: "compact" } } },
              { partType: "text", payload: { content: `compact ${index}` } },
            ],
          });
          db.updateAiCall(call.id, {
            responseMessageIds: [`seed-compact-${index}-response`],
          });
          continue;
        }

        db.upsertMessage({
          messageId: `seed-config-${index}`,
          roundIndex: index + 1,
          scope: "request_aux",
          role: "config",
          createdAt: startedAt,
          updatedAt: startedAt + 50,
          parts: [
            {
              partType: "config",
              payload: {
                thinking: index % 2 === 0,
                maxToken: 4_096 + index,
                topK: index % 5 === 0 ? 3 : 1,
              },
            },
          ],
        });
      }

      db.refreshHeartbeatRecords();
      const page = db.pageHeartbeatRecords({ pageSize: 200, pageCount: 2, anchor: { kind: "latest" } });

      expect(page.totalRecords).toBe(seedCount);
      expect(page.latestRecordId).toBe(page.records.at(-1)?.id ?? null);
      expect(page.records.map((record) => record.startedAt)).toEqual(
        [...page.records.map((record) => record.startedAt)].sort((left, right) => left - right),
      );
      expect(page.records.slice(0, 6).map((record) => record.kind)).toEqual([
        "model_call",
        "compact",
        "config",
        "model_call",
        "compact",
        "config",
      ]);
      expect(page.records.at(-1)?.kind).toBe("model_call");
      expect(page.records.at(-1)?.previewText).toBe(`response ${seedCount - 1}`);
    } finally {
      db.close();
    }
  });

  test("Scenario: Given heartbeat record projection exists When source facts are unchanged Then the record page reads the materialized table without forced refresh", () => {
    const db = createDb();
    try {
      const call = db.appendAiCall({
        roundIndex: 1,
        kind: "chat",
        status: "done",
        provider: "openai",
        model: "gpt-5.1",
        requestUrl: "https://api.example.test/v1/responses",
        requestBody: { model: "gpt-5.1" },
        createdAt: 100,
        updatedAt: 140,
        completedAt: 140,
        isComplete: true,
      });
      db.upsertMessage({
        messageId: "response-freshness",
        aiCallId: call.id,
        roundIndex: 1,
        scope: "heartbeat_part",
        role: "assistant",
        createdAt: 120,
        updatedAt: 140,
        parts: [{ partType: "text", payload: { content: "Initial projection text." } }],
      });
      db.updateAiCall(call.id, { responseMessageIds: ["response-freshness"] });

      expect(db.pageHeartbeatRecords({ pageSize: 10, anchor: { kind: "latest" } }).totalRecords).toBe(0);
      db.ensureHeartbeatRecordsFresh();

      const initial = db.pageHeartbeatRecords({ pageSize: 10, anchor: { kind: "latest" } });
      expect(initial.totalRecords).toBe(1);
      expect(initial.records[0]).toMatchObject({
        id: 1,
        previewText: "Initial projection text.",
        updatedAt: 140,
      });

      db.ensureHeartbeatRecordsFresh();
      const unchanged = db.pageHeartbeatRecords({ pageSize: 10, anchor: { kind: "latest" } });
      expect(unchanged.records[0]).toMatchObject({
        id: 1,
        previewText: "Initial projection text.",
        updatedAt: 140,
      });

      db.upsertMessage({
        messageId: "response-freshness",
        aiCallId: call.id,
        roundIndex: 1,
        scope: "heartbeat_part",
        role: "assistant",
        createdAt: 120,
        updatedAt: 200,
        parts: [{ partType: "text", payload: { content: "Updated projection text." } }],
      });
      db.ensureHeartbeatRecordsFresh();

      const refreshed = db.pageHeartbeatRecords({ pageSize: 10, anchor: { kind: "latest" } });
      expect(refreshed.records[0]).toMatchObject({
        id: 1,
        previewText: "Updated projection text.",
        updatedAt: 200,
      });
    } finally {
      db.close();
    }
  });

  test("Scenario: Given latest and fixed page-window anchors When newer records arrive Then latest windows advance fixed windows stay pinned and newRecordsAvailable is visible", () => {
    const db = createDb();
    try {
      for (let index = 1; index <= 5; index += 1) {
        const call = db.appendAiCall({
          roundIndex: index,
          kind: "chat",
          status: "done",
          provider: "openai",
          model: "gpt-5.1",
          requestUrl: "https://api.example.test/v1/responses",
          requestBody: { model: "gpt-5.1" },
          createdAt: index * 100,
          updatedAt: index * 100 + 20,
          completedAt: index * 100 + 20,
          isComplete: true,
        });
        db.upsertMessage({
          messageId: `response-${index}`,
          aiCallId: call.id,
          roundIndex: index,
          scope: "heartbeat_part",
          role: "assistant",
          createdAt: index * 100 + 10,
          updatedAt: index * 100 + 20,
          parts: [{ partType: "text", payload: { content: `record ${index}` } }],
        });
        db.updateAiCall(call.id, { responseMessageIds: [`response-${index}`] });
      }
      db.refreshHeartbeatRecords();

      const latest = db.pageHeartbeatRecords({ pageSize: 2, anchor: { kind: "latest" } });
      expect(latest.pageIndex).toBe(2);
      expect(latest.pageCount).toBe(2);
      expect(latest.records.map((record) => record.previewText)).toEqual(["record 3", "record 4", "record 5"]);

      const fixed = db.pageHeartbeatRecords({
        pageSize: 2,
        anchor: { kind: "fixed", pageIndex: 0, latestRecordId: latest.latestRecordId },
      });
      expect(fixed.records.map((record) => record.previewText)).toEqual(["record 1", "record 2"]);
      expect(fixed.newRecordsAvailable).toBe(false);

      const sixth = db.appendAiCall({
        roundIndex: 6,
        kind: "chat",
        status: "done",
        provider: "openai",
        model: "gpt-5.1",
        requestUrl: "https://api.example.test/v1/responses",
        requestBody: { model: "gpt-5.1" },
        createdAt: 600,
        updatedAt: 620,
        completedAt: 620,
        isComplete: true,
      });
      db.upsertMessage({
        messageId: "response-6",
        aiCallId: sixth.id,
        roundIndex: 6,
        scope: "heartbeat_part",
        role: "assistant",
        createdAt: 610,
        updatedAt: 620,
        parts: [{ partType: "text", payload: { content: "record 6" } }],
      });
      db.updateAiCall(sixth.id, { responseMessageIds: ["response-6"] });
      db.refreshHeartbeatRecords();

      const fixedAfterInsert = db.pageHeartbeatRecords({
        pageSize: 2,
        anchor: { kind: "fixed", pageIndex: 0, latestRecordId: latest.latestRecordId },
      });
      expect(fixedAfterInsert.records.map((record) => record.previewText)).toEqual(["record 1", "record 2"]);
      expect(fixedAfterInsert.newRecordsAvailable).toBe(true);

      const latestAfterInsert = db.pageHeartbeatRecords({ pageSize: 2, anchor: { kind: "latest" } });
      expect(latestAfterInsert.records.map((record) => record.previewText)).toEqual([
        "record 3",
        "record 4",
        "record 5",
        "record 6",
      ]);
    } finally {
      db.close();
    }
  });

  test("Scenario: Given compact advances the prompt-window round When Heartbeat records refresh Then older AI-call facts remain inspectable", () => {
    const db = createDb();
    try {
      for (let index = 0; index <= 2; index += 1) {
        const call = db.appendAiCall({
          roundIndex: index,
          kind: index === 2 ? "compact" : "chat",
          status: "done",
          provider: "openai",
          model: "gpt-5.1",
          requestUrl: "https://api.example.test/v1/responses",
          requestBody: { model: "gpt-5.1" },
          createdAt: index * 100,
          updatedAt: index * 100 + 20,
          completedAt: index * 100 + 20,
          isComplete: true,
        });
        db.upsertMessage({
          messageId: `append-stable-response-${index}`,
          aiCallId: call.id,
          roundIndex: index,
          scope: "heartbeat_part",
          role: "assistant",
          createdAt: index * 100 + 10,
          updatedAt: index * 100 + 20,
          parts: [{ partType: "text", payload: { content: `append stable ${index}` } }],
        });
        db.updateAiCall(call.id, { responseMessageIds: [`append-stable-response-${index}`] });
      }

      db.refreshHeartbeatRecords();
      const beforeCompactRotation = db.pageHeartbeatRecords({ pageSize: 10, anchor: { kind: "latest" } });

      const nextHead = db.bumpRound(500);
      db.savePromptWindow({
        createdAt: 500,
        roundIndex: nextHead.currentRoundIndex,
        messages: [{ role: "assistant", content: "compacted context" }],
        setCurrent: true,
      });
      db.ensureHeartbeatRecordsFresh();

      const afterCompactRotation = db.pageHeartbeatRecords({ pageSize: 10, anchor: { kind: "latest" } });
      expect(db.listAiCalls().map((row) => row.roundIndex)).toEqual([0, 1, 2]);
      expect(afterCompactRotation.totalRecords).toBe(3);
      expect(afterCompactRotation.records.map((record) => record.previewText)).toEqual([
        "append stable 0",
        "append stable 1",
        "append stable 2",
      ]);
      expect(afterCompactRotation.records.map((record) => record.id)).toEqual(
        beforeCompactRotation.records.map((record) => record.id),
      );

      const oldestRecord = afterCompactRotation.records[0];
      expect(oldestRecord).toBeDefined();
      const oldestDetail = oldestRecord ? db.getHeartbeatRecordDetail(oldestRecord.id) : null;
      expect(oldestDetail?.aiCalls.map((row) => row.roundIndex)).toEqual([0]);
      expect(oldestDetail?.messages.map((row) => row.messageId)).toEqual(["append-stable-response-0"]);
    } finally {
      db.close();
    }
  });

  test("Scenario: Given a stale Heartbeat projection row without source facts When records refresh Then normal refresh stays append-stable", () => {
    const filePath = createDbFile();
    let db: SessionDb | null = new SessionDb(filePath);
    try {
      const call = db.appendAiCall({
        roundIndex: 0,
        kind: "chat",
        status: "done",
        provider: "openai",
        model: "gpt-5.1",
        requestUrl: "https://api.example.test/v1/responses",
        requestBody: { model: "gpt-5.1" },
        createdAt: 100,
        updatedAt: 120,
        completedAt: 120,
        isComplete: true,
      });
      db.upsertMessage({
        messageId: "surviving-response",
        aiCallId: call.id,
        roundIndex: 0,
        scope: "heartbeat_part",
        role: "assistant",
        createdAt: 110,
        updatedAt: 120,
        parts: [{ partType: "text", payload: { content: "surviving source fact" } }],
      });
      db.updateAiCall(call.id, { responseMessageIds: ["surviving-response"] });
      db.refreshHeartbeatRecords();
      db.close();
      db = null;

      const raw = new Database(filePath, { create: true, strict: true });
      try {
        raw
          .query(
            `insert into heartbeat_record (
               record_key,
               kind,
               status,
               primary_ai_call_id,
               ai_call_ids_json,
               source_refs_json,
               feature_flags_json,
               summary_json,
               preview_text,
               started_at,
               updated_at,
               completed_at,
               is_complete
             ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            "model_call:999999",
            "model_call",
            "completed",
            999999,
            JSON.stringify([999999]),
            JSON.stringify([{ kind: "ai_call", id: 999999, role: "primary" }]),
            JSON.stringify({}),
            JSON.stringify({
              provider: "ghost",
              model: "ghost",
              parts: [],
              counts: { parts: 0, toolCalls: 0, toolResults: 0, errors: 0 },
              firstFrameMs: null,
              thinkingDurationMs: 0,
            }),
            "ghost projection",
            50,
            50,
            50,
            1,
          );
      } finally {
        raw.close();
      }

      const reopened = new SessionDb(filePath);
      try {
        expect(reopened.pageHeartbeatRecords({ pageSize: 10, anchor: { kind: "latest" } }).totalRecords).toBe(2);
        reopened.ensureHeartbeatRecordsFresh();

        const page = reopened.pageHeartbeatRecords({ pageSize: 10, anchor: { kind: "latest" } });
        expect(page.totalRecords).toBe(2);
        expect(page.records.map((record) => record.previewText)).toEqual(["ghost projection", "surviving source fact"]);
        expect(reopened.getAiCallById(999999)).toBeNull();
      } finally {
        reopened.close();
      }
    } finally {
      db?.close();
    }
  });

  test("Scenario: Given orphan Heartbeat projection rows When explicit projection repair runs Then only stale projection rows are deleted", () => {
    const filePath = createDbFile();
    let db: SessionDb | null = new SessionDb(filePath);
    try {
      const call = db.appendAiCall({
        roundIndex: 0,
        kind: "chat",
        status: "done",
        provider: "openai",
        model: "gpt-5.1",
        requestUrl: "https://api.example.test/v1/responses",
        requestBody: { model: "gpt-5.1" },
        createdAt: 100,
        updatedAt: 120,
        completedAt: 120,
        isComplete: true,
      });
      db.upsertMessage({
        messageId: "repair-surviving-response",
        aiCallId: call.id,
        roundIndex: 0,
        scope: "heartbeat_part",
        role: "assistant",
        createdAt: 110,
        updatedAt: 120,
        parts: [{ partType: "text", payload: { content: "repair keeps source fact" } }],
      });
      db.updateAiCall(call.id, { responseMessageIds: ["repair-surviving-response"] });
      db.refreshHeartbeatRecords();
      db.close();
      db = null;

      const raw = new Database(filePath, { create: true, strict: true });
      try {
        raw
          .query(
            `insert into heartbeat_record (
               record_key,
               kind,
               status,
               primary_ai_call_id,
               ai_call_ids_json,
               source_refs_json,
               feature_flags_json,
               summary_json,
               preview_text,
               started_at,
               updated_at,
               completed_at,
               is_complete
             ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            "model_call:999999",
            "model_call",
            "completed",
            999999,
            JSON.stringify([999999]),
            JSON.stringify([{ kind: "ai_call", id: 999999, role: "primary" }]),
            JSON.stringify({}),
            JSON.stringify({
              provider: "ghost",
              model: "ghost",
              parts: [],
              counts: { parts: 0, toolCalls: 0, toolResults: 0, errors: 0 },
              firstFrameMs: null,
              thinkingDurationMs: 0,
            }),
            "repair ghost projection",
            50,
            50,
            50,
            1,
          );
      } finally {
        raw.close();
      }

      const reopened = new SessionDb(filePath);
      try {
        const before = reopened.inspectHeartbeatRecordProjectionHealth();
        expect(before).toMatchObject({
          totalRecords: 2,
          missingPrimaryAiCallRecords: 1,
        });
        expect(before.orphanRecordIds).toHaveLength(1);

        const result = reopened.repairHeartbeatRecordProjectionHealth();
        expect(result.before).toEqual(before);
        expect(result.deletedRecords).toBe(1);
        expect(result.deletedRecordIds).toEqual(before.orphanRecordIds);
        expect(result.after).toEqual({
          totalRecords: 1,
          missingPrimaryAiCallRecords: 0,
          orphanRecordIds: [],
        });
        expect(reopened.getAiCallById(call.id)).not.toBeNull();
        expect(reopened.getAiCallById(999999)).toBeNull();

        const page = reopened.pageHeartbeatRecords({ pageSize: 10, anchor: { kind: "latest" } });
        expect(page.records.map((record) => record.previewText)).toEqual(["repair keeps source fact"]);
      } finally {
        reopened.close();
      }
    } finally {
      db?.close();
    }
  });

  test("Scenario: Given Heartbeat source facts and prompt-window facts When clearHeartbeatSession runs Then session-local Heartbeat context facts are deleted", () => {
    const db = createDb();
    try {
      db.setCurrentRoundIndex(7, 35);
      db.savePromptWindow({
        createdAt: 40,
        roundIndex: 7,
        messages: [{ role: "system", content: "old prompt window fact" }],
        setCurrent: true,
      });
      db.upsertMessage({
        messageId: "config-clear",
        roundIndex: 1,
        scope: "request_aux",
        role: "config",
        createdAt: 80,
        updatedAt: 90,
        parts: [{ partType: "config", payload: { content: { provider: "openai" } } }],
      });
      const call = db.appendAiCall({
        roundIndex: 1,
        kind: "chat",
        status: "done",
        provider: "openai",
        model: "gpt-test",
        requestUrl: "https://api.example.test/v1/responses",
        requestBody: { model: "gpt-test" },
        createdAt: 100,
        updatedAt: 140,
        completedAt: 140,
        isComplete: true,
      });
      db.upsertMessage({
        messageId: "clear-request",
        aiCallId: call.id,
        roundIndex: 1,
        scope: "heartbeat_part",
        role: "user",
        createdAt: 100,
        updatedAt: 105,
        parts: [{ partType: "text", payload: { content: "clear request" } }],
      });
      db.upsertMessage({
        messageId: "clear-response",
        aiCallId: call.id,
        roundIndex: 1,
        scope: "heartbeat_part",
        role: "assistant",
        createdAt: 120,
        updatedAt: 140,
        parts: [{ partType: "text", payload: { content: "clear response" } }],
      });
      db.updateAiCall(call.id, {
        requestMessageIds: ["clear-request"],
        responseMessageIds: ["clear-response"],
      });
      db.appendEffectLedger({
        effectId: "effect-clear-message",
        actionId: "action-clear-message",
        actionKind: "message_send",
        actorId: "actor-clear",
        cycleId: 7,
        sessionModelCallId: call.id,
        target: "room:clear",
        effectKind: "message_row_created",
        effectRecordId: "room:clear/1",
        timestamp: 130,
        meta: { chatId: "room:clear", messageId: 1 },
      });
      db.refreshHeartbeatRecords();

      expect(db.pageHeartbeatRecords({ pageSize: 10, anchor: { kind: "latest" } }).totalRecords).toBe(2);

      const result = db.clearHeartbeatSession();

      expect(result).toEqual({
        deletedAiCalls: 1,
        deletedMessageParts: 4,
        deletedHeartbeatMessageParts: 2,
        deletedRequestAuxMessageParts: 1,
        deletedPromptWindowMessageParts: 1,
        deletedHeartbeatRecords: 2,
        deletedAttentionDispatches: 0,
        deletedAttentionReceipts: 0,
        deletedEffectLedgerRecords: 1,
        resetCurrentRoundIndex: true,
        resetCurrentPromptWindow: true,
        stoppedRuntime: false,
        deletedAttentionFiles: 0,
      });
      expect(db.pageHeartbeatRecords({ pageSize: 10, anchor: { kind: "latest" } }).totalRecords).toBe(0);
      expect(db.getAiCallById(call.id)).toBeNull();
      expect(db.listMessagesByScope("heartbeat_part")).toEqual([]);
      expect(db.listMessagesByScope("request_aux")).toEqual([]);
      expect(db.listMessagesByScope("prompt_window")).toEqual([]);
      expect(db.listEffectLedger()).toEqual([]);
      expect(db.getHead()).toMatchObject({
        currentRoundIndex: 0,
        currentPromptWindowId: null,
      });
    } finally {
      db.close();
    }
  });

  test("Scenario: Given five-record pages and a two-page latest window When total records grow Then the visible count follows the latest two pages", () => {
    const db = createDb();
    const appendRecord = (index: number): void => {
      const call = db.appendAiCall({
        roundIndex: index,
        kind: "chat",
        status: "done",
        provider: "openai",
        model: "gpt-5.1",
        requestUrl: "https://api.example.test/v1/responses",
        requestBody: { model: "gpt-5.1" },
        createdAt: index * 100,
        updatedAt: index * 100 + 20,
        completedAt: index * 100 + 20,
        isComplete: true,
      });
      db.upsertMessage({
        messageId: `latest-window-response-${index}`,
        aiCallId: call.id,
        roundIndex: index,
        scope: "heartbeat_part",
        role: "assistant",
        createdAt: index * 100 + 10,
        updatedAt: index * 100 + 20,
        parts: [{ partType: "text", payload: { content: `record ${index}` } }],
      });
      db.updateAiCall(call.id, { responseMessageIds: [`latest-window-response-${index}`] });
    };

    try {
      for (let index = 1; index <= 11; index += 1) {
        appendRecord(index);
        db.refreshHeartbeatRecords();
        if ([5, 6, 10, 11].includes(index)) {
          const page = db.pageHeartbeatRecords({ pageSize: 5, pageCount: 2, anchor: { kind: "latest" } });
          const expectedCount = index === 11 ? 6 : index;
          expect(page.records).toHaveLength(expectedCount);
          expect(page.pageSize).toBe(5);
          expect(page.pageCount).toBe(2);
        }
      }

      const latest = db.pageHeartbeatRecords({ pageSize: 5, pageCount: 2, anchor: { kind: "latest" } });
      expect(latest.records.map((record) => record.previewText)).toEqual([
        "record 6",
        "record 7",
        "record 8",
        "record 9",
        "record 10",
        "record 11",
      ]);
    } finally {
      db.close();
    }
  });

  test("Scenario: Given a tool_result followed by a new user-visible input boundary When record classification runs Then previous and next model_call records stay objectively separated", () => {
    const db = createDb();
    try {
      const firstCall = db.appendAiCall({
        roundIndex: 1,
        kind: "chat",
        status: "done",
        provider: "openai",
        model: "gpt-5.1",
        requestUrl: "https://api.example.test/v1/responses",
        requestBody: { model: "gpt-5.1" },
        createdAt: 100,
        updatedAt: 180,
        completedAt: 180,
        isComplete: true,
      });
      db.upsertMessage({
        messageId: "first-tool-result",
        aiCallId: firstCall.id,
        roundIndex: 1,
        scope: "heartbeat_part",
        role: "user",
        createdAt: 150,
        updatedAt: 180,
        parts: [
          { partType: "tool_call", payload: { name: "workspace_read", arguments: { path: "README.md" } } },
          { partType: "tool_result", payload: { name: "workspace_read", output: "readme content" } },
        ],
      });
      db.updateAiCall(firstCall.id, { responseMessageIds: ["first-tool-result"] });

      const secondCall = db.appendAiCall({
        roundIndex: 2,
        kind: "chat",
        status: "done",
        provider: "openai",
        model: "gpt-5.1",
        requestUrl: "https://api.example.test/v1/responses",
        requestBody: { model: "gpt-5.1" },
        createdAt: 220,
        updatedAt: 280,
        completedAt: 280,
        isComplete: true,
      });
      db.upsertMessage({
        messageId: "second-input",
        aiCallId: secondCall.id,
        roundIndex: 2,
        scope: "heartbeat_part",
        role: "user",
        createdAt: 220,
        updatedAt: 225,
        parts: [{ partType: "text", payload: { content: "commit attention items for the next step" } }],
      });
      db.upsertMessage({
        messageId: "second-response",
        aiCallId: secondCall.id,
        roundIndex: 2,
        scope: "heartbeat_part",
        role: "assistant",
        createdAt: 240,
        updatedAt: 280,
        parts: [{ partType: "text", payload: { content: "Next record completed." } }],
      });
      db.updateAiCall(secondCall.id, {
        requestMessageIds: ["second-input"],
        responseMessageIds: ["second-response"],
      });

      db.refreshHeartbeatRecords();

      const page = db.pageHeartbeatRecords({ pageSize: 10, anchor: { kind: "latest" } });
      expect(page.records.map((record) => record.kind)).toEqual(["model_call", "model_call"]);
      expect(page.records.map((record) => record.primaryAiCallId)).toEqual([firstCall.id, secondCall.id]);
      expect(page.records[0]?.previewText).toBeNull();
      expect(page.records[0]?.summary.counts).toMatchObject({ toolCalls: 1, toolResults: 1 });
      expect(page.records[0]?.sourceRefs).toContainEqual({
        kind: "message_part",
        messageId: "first-tool-result",
        partId: "first-tool-result:1",
        role: "tool_result",
      });
      expect(page.records[1]?.sourceRefs).toContainEqual({
        kind: "message_part",
        messageId: "second-input",
        partId: "second-input:0",
        role: "input",
      });
    } finally {
      db.close();
    }
  });

  test("Scenario: Given one selected heartbeat record When detail is loaded Then full structured content is reconstructed separately from the bounded list row", () => {
    const db = createDb();
    try {
      const call = db.appendAiCall({
        roundIndex: 1,
        kind: "chat",
        status: "running",
        provider: "openai",
        model: "gpt-5.1",
        requestUrl: "https://api.example.test/v1/responses",
        requestBody: { model: "gpt-5.1" },
        createdAt: 100,
        updatedAt: 150,
        isComplete: false,
      });
      db.upsertMessage({
        messageId: "tool-run",
        aiCallId: call.id,
        roundIndex: 1,
        scope: "heartbeat_part",
        role: "assistant",
        createdAt: 120,
        updatedAt: 150,
        parts: [
          {
            partType: "tool_call",
            payload: { name: "workspace_read", arguments: { path: "package.json" } },
            isComplete: false,
          },
        ],
      });
      db.updateAiCall(call.id, { responseMessageIds: ["tool-run"] });
      db.refreshHeartbeatRecords();

      const record = db.pageHeartbeatRecords({ pageSize: 1, anchor: { kind: "latest" } }).records[0]!;
      const detail = db.getHeartbeatRecordDetail(record.id);
      expect(detail?.record.id).toBe(record.id);
      expect(detail?.aiCalls.map((item) => item.id)).toEqual([call.id]);
      expect(detail?.messages.map((item) => item.messageId)).toEqual(["tool-run"]);
      expect(detail?.messages[0]?.parts[0]).toMatchObject({
        partType: "tool_call",
        isComplete: false,
      });
    } finally {
      db.close();
    }
  });

  test("Scenario: Given collected user input metadata When heartbeat detail is loaded Then the synthetic input boundary is preserved", () => {
    const db = createDb();
    try {
      const attentionItemsText = [
        "## Attention Items",
        "",
        "```yaml+attention-item",
        "contextId: ctx-room",
        "commitId: commit-room-message",
        "provenance:",
        "  author: Gaubee",
        "  source: message",
        '  src: "room:walkthrough#8"',
        'summary: "今天科技圈有什么新闻？"',
        "change:",
        "  type: update",
        "  value: |",
        "    ```yaml",
        "    message:",
        "      messageId: 8",
        "    ```",
        "",
        "    今天科技圈有什么新闻？",
        "```",
      ].join("\n");
      const call = db.appendAiCall({
        roundIndex: 1,
        kind: "chat",
        status: "done",
        provider: "openai",
        model: "gpt-5.1",
        requestUrl: "https://api.example.test/v1/responses",
        requestBody: {
          model: "gpt-5.1",
          meta: {
            collectedInputs: [
              {
                role: "user",
                parts: [{ type: "text", text: attentionItemsText }],
                meta: { createdAt: 100, updatedAt: 120 },
              },
            ],
          },
        },
        createdAt: 100,
        updatedAt: 180,
        completedAt: 180,
        isComplete: true,
      });
      db.upsertMessage({
        messageId: "synthetic-response",
        aiCallId: call.id,
        roundIndex: 1,
        scope: "heartbeat_part",
        role: "assistant",
        createdAt: 140,
        updatedAt: 180,
        parts: [{ partType: "text", payload: { content: "Done." } }],
      });
      db.updateAiCall(call.id, { responseMessageIds: ["synthetic-response"] });
      db.refreshHeartbeatRecords();

      const record = db.pageHeartbeatRecords({ pageSize: 1, anchor: { kind: "latest" } }).records[0]!;
      const detail = db.getHeartbeatRecordDetail(record.id);
      expect(detail?.messages[0]?.role).toBe("user");
      expect(detail?.messages[0]?.parts[0]?.partType).toBe("text");
      expect(detail?.messages[0]?.parts[0]?.payload).toMatchObject({
        type: "text",
        content: attentionItemsText,
      });
      expect(record.summary.parts[0]?.label).toBe(attentionItemsText);
    } finally {
      db.close();
    }
  });

  test("Scenario: Given collected input older than the ai_call When heartbeat records refresh Then model-call list ordering starts at invocation time", () => {
    const db = createDb();
    try {
      const call = db.appendAiCall({
        roundIndex: 1,
        kind: "chat",
        status: "done",
        provider: "openai",
        model: "gpt-5.1",
        requestUrl: "https://api.example.test/v1/responses",
        requestBody: {
          model: "gpt-5.1",
          meta: {
            collectedInputs: [
              {
                role: "user",
                parts: [{ type: "text", text: "old prompt-window context" }],
                meta: { createdAt: 100, updatedAt: 120 },
              },
            ],
          },
        },
        createdAt: 1_000,
        updatedAt: 1_180,
        completedAt: 1_180,
        isComplete: true,
      });
      db.upsertMessage({
        messageId: "fresh-response",
        aiCallId: call.id,
        roundIndex: 1,
        scope: "heartbeat_part",
        role: "assistant",
        createdAt: 1_120,
        updatedAt: 1_180,
        parts: [{ partType: "text", payload: { content: "fresh response" } }],
      });
      db.updateAiCall(call.id, { responseMessageIds: ["fresh-response"] });
      db.refreshHeartbeatRecords();

      const record = db.pageHeartbeatRecords({ pageSize: 10, anchor: { kind: "latest" } }).records[0]!;
      expect(record.startedAt).toBe(call.createdAt);
      expect(record.completedAt).toBe(call.completedAt);
      expect(record.summary.firstFrameMs).toBe(120);
      expect(record.summary.parts[0]).toMatchObject({
        label: "old prompt-window context",
        startedAt: 100,
      });
    } finally {
      db.close();
    }
  });

  test("Scenario: Given an existing model-call projection with old context start When heartbeat records are ensured fresh Then the row is updated without shrinking history", () => {
    const filePath = createDbFile();
    let db: SessionDb | null = new SessionDb(filePath);
    try {
      const call = db.appendAiCall({
        roundIndex: 1,
        kind: "chat",
        status: "done",
        provider: "openai",
        model: "gpt-5.1",
        requestUrl: "https://api.example.test/v1/responses",
        requestBody: {
          model: "gpt-5.1",
          meta: {
            collectedInputs: [
              {
                role: "user",
                parts: [{ type: "text", text: "carried prompt-window fact" }],
                meta: { createdAt: 100, updatedAt: 120 },
              },
            ],
          },
        },
        createdAt: 1_000,
        updatedAt: 1_180,
        completedAt: 1_180,
        isComplete: true,
      });
      db.upsertMessage({
        messageId: "repair-start-response",
        aiCallId: call.id,
        roundIndex: 1,
        scope: "heartbeat_part",
        role: "assistant",
        createdAt: 1_120,
        updatedAt: 1_180,
        parts: [{ partType: "text", payload: { content: "repaired response" } }],
      });
      db.updateAiCall(call.id, { responseMessageIds: ["repair-start-response"] });
      db.refreshHeartbeatRecords();

      const beforeRepair = db.pageHeartbeatRecords({ pageSize: 10, anchor: { kind: "latest" } }).records[0]!;
      expect(beforeRepair.startedAt).toBe(1_000);
      db.close();
      db = null;

      const raw = new Database(filePath, { create: true, strict: true });
      try {
        raw.query(`update heartbeat_record set started_at = ? where primary_ai_call_id = ?`).run(100, call.id);
      } finally {
        raw.close();
      }

      const reopened = new SessionDb(filePath);
      try {
        const dirty = reopened.pageHeartbeatRecords({ pageSize: 10, anchor: { kind: "latest" } }).records[0]!;
        expect(dirty.id).toBe(beforeRepair.id);
        expect(dirty.startedAt).toBe(100);

        reopened.ensureHeartbeatRecordsFresh();

        const repairedPage = reopened.pageHeartbeatRecords({ pageSize: 10, anchor: { kind: "latest" } });
        expect(repairedPage.totalRecords).toBe(1);
        expect(repairedPage.records[0]).toMatchObject({
          id: beforeRepair.id,
          primaryAiCallId: call.id,
          startedAt: call.createdAt,
          completedAt: call.completedAt,
        });
      } finally {
        reopened.close();
      }
    } finally {
      db?.close();
    }
  });

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

  test("Scenario: Given the same runtime watch identity When scheduling refreshes it Then durable persistence updates the watch instead of inserting a duplicate", () => {
    const db = createDb();
    try {
      db.appendRuntimeWatch({
        watchId: "watch-refresh",
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
        createdAt: 100,
        updatedAt: 100,
        status: "expired",
        resolvedAt: 520,
        reminderContextId: "ctx-chat-main",
        reminderCommitId: "commit-old",
        meta: { attempt: 1 },
      });

      const refreshed = db.upsertRuntimeWatch({
        watchId: "watch-refresh",
        ownerActionId: "action-2",
        ownerActionKind: "message_send",
        ownerActorId: "session:test",
        ownerCycleId: 8,
        ownerSessionModelCallId: 43,
        target: "room:chat-main",
        predicate: {
          kind: "message_latest_visible",
          chatId: "chat-main",
          anchorMessageId: 11,
        },
        dueAt: 900,
        updatedAt: 700,
        status: "pending",
        meta: { attempt: 2 },
      });

      expect(db.listRuntimeWatches()).toHaveLength(1);
      expect(refreshed).toMatchObject({
        watchId: "watch-refresh",
        ownerActionId: "action-2",
        ownerCycleId: 8,
        ownerSessionModelCallId: 43,
        dueAt: 900,
        status: "pending",
        createdAt: 100,
        updatedAt: 700,
        resolvedAt: null,
        reminderContextId: null,
        reminderCommitId: null,
        meta: { attempt: 2 },
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

  test("Scenario: Given notify sends are recorded When quota history is queried Then durable records explain target, focus state, and rolling window", () => {
    const db = createDb();
    try {
      const first = db.appendNotifyQuotaRecord({
        notifyId: "notify-1",
        contextId: "ctx-room-muted",
        quotaTarget: "ctx-room-muted:msg:room-muted/202",
        focusState: "muted",
        sourceId: "msg:room-muted/202",
        commitId: "commit-1",
        sentAt: 1_000,
        windowMs: 12 * 60 * 60 * 1_000,
        meta: { reason: "notification" },
      });
      const second = db.appendNotifyQuotaRecord({
        notifyId: "notify-2",
        contextId: "ctx-room-muted",
        quotaTarget: "ctx-room-muted:msg:room-muted/202",
        focusState: "muted",
        sourceId: "msg:room-muted/202",
        commitId: "commit-2",
        sentAt: 2_000,
        windowMs: 12 * 60 * 60 * 1_000,
      });

      expect(first).toMatchObject({
        notifyId: "notify-1",
        quotaTarget: "ctx-room-muted:msg:room-muted/202",
        focusState: "muted",
        sourceId: "msg:room-muted/202",
        commitId: "commit-1",
      });
      expect(db.getNotifyQuotaRecordByNotifyId("notify-2")).toMatchObject({
        notifyId: "notify-2",
        commitId: "commit-2",
        sentAt: 2_000,
      });
      expect(
        db.listNotifyQuotaRecords({
          quotaTarget: "ctx-room-muted:msg:room-muted/202",
        }),
      ).toHaveLength(2);
      expect(
        db
          .listNotifyQuotaRecords({
            quotaTarget: "ctx-room-muted:msg:room-muted/202",
            sentAfter: 1_500,
          })
          .map((record) => record.notifyId),
      ).toEqual(["notify-2"]);
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

  test("Scenario: Given AI calls across multiple rounds When compact advances the prompt-window round Then all AI-call rows remain queryable", () => {
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

      const nextHead = db.bumpRound(300);
      db.savePromptWindow({
        createdAt: 300,
        roundIndex: nextHead.currentRoundIndex,
        messages: [{ role: "assistant", content: "compact seed" }],
        setCurrent: true,
      });

      expect(db.getHead().currentRoundIndex).toBe(1);
      expect(db.listAiCalls().map((row) => row.roundIndex)).toEqual([0, 1, 2]);
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
