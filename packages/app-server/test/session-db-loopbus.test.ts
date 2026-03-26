import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { SessionDb } from "@agenter/session-system";

const tempDirs: string[] = [];

const makeTempDir = (): string => {
  const dir = mkdtempSync(join(tmpdir(), "agenter-session-db-"));
  tempDirs.push(dir);
  return dir;
};

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("Feature: session cycle ledger persistence", () => {
  test("Scenario: Given cycles and a moved head When reading the current branch Then the branch follows head pointers instead of append order", () => {
    const root = makeTempDir();
    const db = new SessionDb(join(root, "session.db"));

    const cycle1 = db.appendCycle({
      wake: { source: "user" },
      collectedInputs: [
        {
          source: "message",
          role: "user",
          name: "User",
          parts: [{ type: "text", text: "first" }],
        },
      ],
      result: { kind: "model-call" },
    });
    db.setHead(cycle1.id);

    const cycle2 = db.appendCycle({
      prevCycleId: cycle1.id,
      wake: { source: "terminal" },
      collectedInputs: [
        {
          source: "terminal",
          sourceId: "iflow",
          role: "user",
          name: "Terminal-iflow",
          parts: [{ type: "text", text: "diff-2" }],
        },
      ],
      result: { kind: "model-call" },
    });
    db.setHead(cycle2.id);

    const branch = db.appendCycle({
      prevCycleId: cycle1.id,
      wake: { source: "attention" },
      collectedInputs: [
        {
          source: "attention",
          role: "user",
          name: "AttentionSystem",
          parts: [{ type: "text", text: "branch" }],
        },
      ],
      result: { kind: "model-call" },
    });
    db.setHead(branch.id);

    const currentBranch = db.listCurrentBranchCycles();
    expect(currentBranch.map((item) => item.id)).toEqual([cycle1.id, branch.id]);
    expect(currentBranch[1]?.prevCycleId).toBe(cycle1.id);

    db.close();
  });

  test("Scenario: Given cycle traces model calls and blocks When paginating Then rows stay ordered by their own ledgers", () => {
    const root = makeTempDir();
    const db = new SessionDb(join(root, "session.db"));

    const cycle = db.appendCycle({
      wake: { source: "user" },
      collectedInputs: [
        {
          source: "message",
          role: "user",
          name: "User",
          parts: [{ type: "text", text: "hello" }],
        },
      ],
      result: { kind: "model-call" },
    });
    db.setHead(cycle.id);

    const call = db.appendModelCall({
      cycleId: cycle.id,
      provider: "openai-compatible",
      model: "deepseek-chat",
      request: { messages: [{ role: "user", content: "hello" }] },
      response: { text: "hi" },
    });
    db.appendApiCall({
      modelCallId: call.id,
      request: { body: "request" },
      response: { body: "response" },
    });
    db.appendBlock({
      cycleId: cycle.id,
      role: "user",
      channel: "user_input",
      content: "hello",
    });
    db.appendBlock({
      cycleId: cycle.id,
      role: "assistant",
      channel: "to_user",
      content: "hi",
    });
    db.appendLoopTrace({
      cycleId: cycle.id,
      traceId: "trace-1",
      spanId: "span-1",
      kind: "source.collect",
      name: "collect_inputs",
      status: "done",
      startedAt: 10,
      endedAt: 11,
      refs: [],
      links: [],
      events: [],
      attributes: { inputs: 1 },
      outcome: { code: "done" },
    });
    db.appendLoopTrace({
      cycleId: cycle.id,
      traceId: "trace-1",
      spanId: "span-2",
      parentSpanId: "span-1",
      kind: "model.call",
      name: "call_model",
      status: "done",
      startedAt: 11,
      endedAt: 20,
      refs: [],
      links: [],
      events: [],
      attributes: { provider: "openai-compatible" },
      outcome: { code: "done" },
    });

    expect(db.listModelCallsAfter(0, 10).map((item) => item.id)).toEqual([call.id]);
    expect(db.listBlocksAfter(0, 10).map((item) => item.content)).toEqual(["hello", "hi"]);
    expect(db.listLoopTracesAfter(0, 10).map((item) => item.name)).toEqual(["collect_inputs", "call_model"]);
    expect(db.listApiCallsAfter(0, 10)[0]?.modelCallId).toBe(call.id);

    db.close();
  });

  test("Scenario: Given a running model call When it completes Then the same row is updated with lifecycle details", () => {
    const root = makeTempDir();
    const db = new SessionDb(join(root, "session.db"));

    const cycle = db.appendCycle({
      wake: { source: "user" },
      collectedInputs: [
        {
          source: "message",
          role: "user",
          name: "User",
          parts: [{ type: "text", text: "hello" }],
        },
      ],
      result: { kind: "model-call" },
    });
    db.setHead(cycle.id);

    const running = db.appendModelCall({
      cycleId: cycle.id,
      createdAt: 100,
      status: "running",
      provider: "openai-compatible",
      model: "deepseek-chat",
      request: { messages: [{ role: "user", content: "hello" }] },
      trace: { traceId: "trace-2", spanId: "span-model-1", parentSpanId: null },
    });

    const done = db.updateModelCall(running.id, {
      status: "done",
      completedAt: 120,
      response: { assistant: { text: "hi" } },
      trace: { traceId: "trace-2", spanId: "span-model-1", parentSpanId: null },
      outcome: { code: "done" },
    });

    expect(done.id).toBe(running.id);
    expect(done.status).toBe("done");
    expect(done.completedAt).toBe(120);
    expect(done.response).toEqual({ assistant: { text: "hi" } });
    expect(done.trace?.spanId).toBe("span-model-1");
    expect(done.outcome?.code).toBe("done");
    expect(db.listModelCallsAfter(0, 10)).toEqual([done]);

    db.close();
  });
});
