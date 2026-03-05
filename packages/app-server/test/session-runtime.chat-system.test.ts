import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { LoopBusInput, LoopBusMessage } from "../src/loop-bus";
import { SessionRuntime } from "../src/session-runtime";

interface RuntimeInternal {
  agent: { requestCompact: (reason?: string) => void } | null;
  runtime: { pushMessage: (input: LoopBusInput) => LoopBusMessage } | null;
  chatEngine: {
    add: (input: { content: string; from: string; score?: number; remark?: string }) => unknown;
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

describe("Feature: session runtime chat-system loop inputs", () => {
  test("Scenario: Given active chat attention When collecting loop inputs Then inject source chat-system facts", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal;

    internal.chatEngine.add({
      content: "请继续完成任务",
      from: "user",
      score: 100,
    });

    const outputs = await internal.collectLoopInputs();
    expect(outputs).toBeDefined();
    if (!outputs) {
      return;
    }

    const chatSystemInput = outputs.find((item) => item.source === "chat-system");
    expect(chatSystemInput).toBeDefined();
    if (!chatSystemInput) {
      return;
    }

    const payload = JSON.parse(chatSystemInput.text) as { kind: string; count: number };
    expect(payload.kind).toBe("chat-system-list");
    expect(payload.count).toBe(1);
  });

  test("Scenario: Given compact command chat When pushUserChat('/compact') Then it requests compact and does not append chat attention", () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal;

    let compactRequested = 0;
    const pushed: LoopBusInput[] = [];

    internal.agent = {
      requestCompact: () => {
        compactRequested += 1;
      },
    };
    internal.runtime = {
      pushMessage: (input) => {
        pushed.push(input);
        return {
          id: "mock-loop-message",
          timestamp: Date.now(),
          name: input.name,
          role: input.role,
          type: input.type,
          source: input.source,
          text: input.text,
          meta: input.meta,
        };
      },
    };

    runtime.pushUserChat("/compact");

    expect(compactRequested).toBe(1);
    expect(internal.chatEngine.list()).toHaveLength(0);
    expect(pushed).toHaveLength(1);
    expect(pushed[0].source).toBe("chat");
    expect(pushed[0].text).toBe("/compact");
  });
});
