import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { LoopBusInput } from "../src/loop-bus";
import { SessionRuntime } from "../src/session-runtime";

interface RuntimeInternal {
  agent: { requestCompact: (reason?: string) => void } | null;
  attentionEngine: {
    list: () => Array<{ id: number }>;
  };
  collectLoopInputs: () => Promise<LoopBusInput[] | undefined>;
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
});
