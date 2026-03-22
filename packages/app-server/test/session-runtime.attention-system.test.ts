import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { LoopBusInput } from "../src/loop-bus";
import { LoopBusPluginRuntime, type AttentionDraft, type LoopBusPlugin } from "../src/loopbus-plugin-runtime";
import { SessionRuntime } from "../src/session-runtime";

interface RuntimeInternal {
  agent: { requestCompact: (reason?: string) => void } | null;
  attentionEngine: {
    list: () => Array<{ id: number; content?: string; from?: string }>;
  };
  collectLoopInputs: () => Promise<LoopBusInput[] | undefined>;
  loopPluginRuntime: LoopBusPluginRuntime | null;
  createLoopPluginRuntime: () => Promise<LoopBusPluginRuntime>;
  createLoopPlugins: () => LoopBusPlugin[];
  flushPluginAttentionDrafts: () => Promise<boolean>;
  commitAttentionDrafts: (drafts: AttentionDraft[]) => Promise<boolean>;
  readTerminalRepresentation: (
    terminalId: string,
    input: { mode: "auto" | "diff" | "snapshot"; remark: boolean },
  ) => Promise<{ kind: string; representation: string } | { ok: false; reason: string }>;
  config: {
    terminals?: Record<string, { terminalId: string; cwd: string; command: string[]; commandLabel: string; gitLog?: false }>;
  } | null;
  terminals: Map<
    string,
    {
      isRunning: () => boolean;
      getSnapshot: () => {
        seq: number;
        cols: number;
        rows: number;
        cursor: { x: number; y: number };
        lines: string[];
      };
      getStatus: () => "IDLE" | "BUSY";
      sliceDirty: (input: { remark?: boolean; wait?: boolean }) => Promise<{
        ok: boolean;
        changed: boolean;
        fromHash: string | null;
        toHash: string | null;
        diff: string;
        bytes: number;
      }>;
    }
  >;
  focusedTerminalIds: string[];
  terminalDirtyState: Record<string, boolean>;
  terminalLatestSeq: Record<string, number>;
  terminalReads: Record<string, { representation: string }>;
}

const createRuntime = (): SessionRuntime => {
  const root = mkdtempSync(join(tmpdir(), "agenter-session-runtime-"));
  return new SessionRuntime({
    sessionId: `s-${Date.now()}`,
    cwd: root,
    sessionRoot: join(root, "session"),
    sessionName: "test",
    storeTarget: "workspace",
  });
};

describe("Feature: session runtime attention-system loop inputs", () => {
  test("Scenario: Given user chat is collected When collectLoopInputs runs Then attention facts ride in the same batch", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal;

    runtime.pushUserChat("Please continue the task");

    const firstRound = await internal.collectLoopInputs();
    expect(firstRound?.some((item) => item.source === "chat" && item.text === "Please continue the task")).toBe(true);
    const attentionFacts = firstRound?.find((item) => item.source === "attention-system");
    expect(attentionFacts).toBeDefined();
    if (!attentionFacts) {
      return;
    }

    const payload = JSON.parse(attentionFacts.text) as { kind: string; count: number };
    expect(payload.kind).toBe("attention-system-list");
    expect(payload.count).toBe(1);

    const secondRound = await internal.collectLoopInputs();
    expect(secondRound).toBeUndefined();
  });

  test("Scenario: Given compact command When pushUserChat('/compact') Then compact is requested and attention records stay untouched", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal;

    let compactRequested = 0;
    internal.agent = {
      requestCompact: () => {
        compactRequested += 1;
      },
    };

    runtime.pushUserChat("/compact");

    expect(compactRequested).toBe(1);
    expect(internal.attentionEngine.list()).toHaveLength(0);

    const outputs = await internal.collectLoopInputs();
    expect(outputs?.some((item) => item.source === "chat" && item.text === "/compact")).toBe(true);
  });

  test("Scenario: Given a fresh user message While the previous cycle is still running Then attention remains invisible until the next collect batch", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal;

    runtime.pushUserChat("What time is it?");

    expect(internal.attentionEngine.list()).toHaveLength(0);

    const firstRound = await internal.collectLoopInputs();
    expect(firstRound?.some((item) => item.source === "chat" && item.text === "What time is it?")).toBe(true);
    expect(internal.attentionEngine.list()).toHaveLength(1);
  });

  test("Scenario: Given legacy chat-system store When runtime starts Then files migrate to attention-system and records are restored", async () => {
    const root = mkdtempSync(join(tmpdir(), "agenter-session-runtime-migrate-"));
    const sessionRoot = join(root, "session");
    const legacyDir = join(sessionRoot, "chat-system");
    const nextDir = join(sessionRoot, "attention-system");
    await mkdir(legacyDir, { recursive: true });
    await writeFile(
      join(legacyDir, "state.json"),
      JSON.stringify({
        nextId: 2,
        records: [
          {
            id: 1,
            content: "legacy attention",
            from: "user",
            score: 100,
            remark: "",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      }),
      "utf8",
    );

    const runtime = new SessionRuntime({
      sessionId: `s-${Date.now()}`,
      cwd: root,
      sessionRoot,
      sessionName: "migrate",
      storeTarget: "workspace",
    });

    await runtime.start();
    const internal = runtime as unknown as RuntimeInternal;
    expect(internal.attentionEngine.list()).toHaveLength(1);
    await runtime.stop();

    await access(join(nextDir, "state.json"));
    const migrated = JSON.parse(await readFile(join(nextDir, "state.json"), "utf8")) as {
      records: Array<{ content: string }>;
    };
    expect(migrated.records[0]?.content).toBe("legacy attention");
  });

  test("Scenario: Given a plugin runtime-backed user message When attention drafts flush Then the message is committed before cycle gating", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal;

    internal.loopPluginRuntime = await internal.createLoopPluginRuntime();
    runtime.pushUserChat("plugin-backed message");

    const changed = await internal.flushPluginAttentionDrafts();
    expect(changed).toBe(true);
    const facts = internal.attentionEngine.list();
    expect(facts).toHaveLength(1);
    expect(facts[0]?.content).toBe("plugin-backed message");
    expect(facts[0]?.from).toBe("User");
  });

  test("Scenario: Given a focused terminal invalidation When plugin attention drafts flush Then terminal output is committed into attention", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal;

    internal.config = {
      terminals: {
        iflow: {
          terminalId: "iflow",
          cwd: "/tmp",
          command: ["bash"],
          commandLabel: "bash",
          gitLog: false,
        },
      },
    };
    internal.terminals.set("iflow", {
      isRunning: () => true,
      getSnapshot: () => ({
        seq: 7,
        cols: 80,
        rows: 24,
        cursor: { x: 0, y: 23 },
        lines: ["echo ready"],
      }),
      getStatus: () => "IDLE",
      sliceDirty: async () => ({
        ok: true,
        changed: false,
        fromHash: null,
        toHash: null,
        diff: "",
        bytes: 0,
      }),
    });
    internal.focusedTerminalIds = ["iflow"];
    internal.terminalDirtyState.iflow = true;
    internal.terminalLatestSeq.iflow = 7;
    internal.loopPluginRuntime = await internal.createLoopPluginRuntime();
    internal.loopPluginRuntime.invalidate({
      systemId: "terminal",
      subjectId: "iflow",
      reason: "semantic-change",
      versionHint: 7,
    });

    const changed = await internal.flushPluginAttentionDrafts();
    expect(changed).toBe(true);
    const facts = internal.attentionEngine.list();
    expect(facts).toHaveLength(1);
    expect(facts[0]?.from).toBe("terminal");
    expect(facts[0]?.content).toContain('"kind":"terminal-snapshot"');
  });

  test("Scenario: Given a focused terminal invalidation with unchanged semantic content When plugin drafts flush twice Then no duplicate attention delta is committed", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal;

    internal.config = {
      terminals: {
        iflow: {
          terminalId: "iflow",
          cwd: "/tmp",
          command: ["bash"],
          commandLabel: "bash",
          gitLog: false,
        },
      },
    };
    internal.terminals.set("iflow", {
      isRunning: () => true,
      getSnapshot: () => ({
        seq: 8,
        cols: 80,
        rows: 24,
        cursor: { x: 0, y: 23 },
        lines: ["echo ready"],
      }),
      getStatus: () => "IDLE",
      sliceDirty: async () => ({
        ok: true,
        changed: false,
        fromHash: null,
        toHash: null,
        diff: "",
        bytes: 0,
      }),
    });
    internal.focusedTerminalIds = ["iflow"];
    internal.terminalDirtyState.iflow = true;
    internal.terminalLatestSeq.iflow = 8;
    internal.loopPluginRuntime = await internal.createLoopPluginRuntime();

    internal.loopPluginRuntime.invalidate({
      systemId: "terminal",
      subjectId: "iflow",
      reason: "semantic-change",
      versionHint: 8,
    });
    expect(await internal.flushPluginAttentionDrafts()).toBe(true);
    expect(internal.attentionEngine.list()).toHaveLength(1);

    internal.terminalDirtyState.iflow = true;
    internal.loopPluginRuntime.invalidate({
      systemId: "terminal",
      subjectId: "iflow",
      reason: "semantic-change",
      versionHint: 8,
    });
    expect(await internal.flushPluginAttentionDrafts()).toBe(false);
    expect(internal.attentionEngine.list()).toHaveLength(1);
  });

  test("Scenario: Given a terminal source invalidation without readable output When plugin drafts flush Then no attention delta is committed", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal;

    internal.loopPluginRuntime = await internal.createLoopPluginRuntime();
    internal.loopPluginRuntime.invalidate({
      systemId: "terminal",
      subjectId: "missing-terminal",
      reason: "semantic-change",
      versionHint: 1,
    });

    const changed = await internal.flushPluginAttentionDrafts();
    expect(changed).toBe(false);
    expect(internal.attentionEngine.list()).toHaveLength(0);

    const outputs = await internal.collectLoopInputs();
    expect(outputs).toBeUndefined();
  });

  test("Scenario: Given an explicit terminal read When snapshot is queried Then representation metadata is published in runtime state", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal;

    internal.config = {
      terminals: {
        main: {
          terminalId: "main",
          cwd: "/tmp",
          command: ["bash"],
          commandLabel: "bash",
          gitLog: false,
        },
      },
    };
    internal.terminals.set("main", {
      isRunning: () => true,
      getSnapshot: () => ({
        seq: 3,
        cols: 80,
        rows: 24,
        cursor: { x: 4, y: 1 },
        lines: ["echo ready"],
      }),
      getStatus: () => "IDLE",
      sliceDirty: async () => ({
        ok: true,
        changed: false,
        fromHash: null,
        toHash: null,
        diff: "",
        bytes: 0,
      }),
    });

    const payload = await internal.readTerminalRepresentation("main", { mode: "snapshot", remark: false });
    expect("kind" in payload && payload.kind).toBe("terminal-snapshot");
    expect(internal.terminalReads.main?.representation).toBe("snapshot");
  });

  test("Scenario: Given source-driven drafts When a cycle policy hook defers Then attention commits but cycle start stays deferred", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal;

    internal.config = {
      terminals: {
        iflow: {
          terminalId: "iflow",
          cwd: "/tmp",
          command: ["bash"],
          commandLabel: "bash",
          gitLog: false,
        },
      },
    };
    internal.terminals.set("iflow", {
      isRunning: () => true,
      getSnapshot: () => ({
        seq: 9,
        cols: 80,
        rows: 24,
        cursor: { x: 0, y: 23 },
        lines: ["echo deferred"],
      }),
      getStatus: () => "IDLE",
      sliceDirty: async () => ({
        ok: true,
        changed: false,
        fromHash: null,
        toHash: null,
        diff: "",
        bytes: 0,
      }),
    });

    const pluginRuntime = new LoopBusPluginRuntime([
      ...internal.createLoopPlugins(),
      {
        name: "policy-defer",
        cycleShouldStart() {
          return { allow: false, reason: "policy-deferred" };
        },
      },
    ]);
    await pluginRuntime.setup();
    pluginRuntime.invalidate({
      systemId: "terminal",
      subjectId: "iflow",
      reason: "semantic-change",
      versionHint: 9,
    });

    const drafts = await pluginRuntime.readInvalidatedAttentionDrafts();
    expect(drafts).toHaveLength(1);

    await internal.commitAttentionDrafts(drafts);
    const decision = await pluginRuntime.shouldStartCycle(drafts);

    expect(internal.attentionEngine.list()).toHaveLength(1);
    expect(decision).toEqual({ allow: false, reason: "policy-deferred" });
  });
});
