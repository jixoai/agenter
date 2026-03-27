import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { SessionRuntime } from "../src/session-runtime";

interface RuntimeInternals {
  createActiveCycle: (input: {
    cycleId: number;
    seq: number;
    createdAt: number;
    wakeSource: string | null;
    inputs: Array<{
      source: "message";
      role: "user";
      name: string;
      parts: Array<{ type: "text"; text: string }>;
      meta?: { clientMessageId?: string };
    }>;
  }) => void;
  handleAssistantStreamUpdate: (
    input:
      | {
          kind: "tool_call";
          toolCallId: string;
          toolName: string;
          argsText: string;
          input?: unknown;
          timestamp: number;
        }
      | {
          kind: "tool_result";
          toolCallId: string;
          toolName: string;
          ok: boolean;
          result?: unknown;
          error?: string | null;
          timestamp: number;
        },
  ) => void;
}

const createRuntime = (): SessionRuntime => {
  const root = mkdtempSync(join(tmpdir(), "agenter-cycle-stream-"));
  return new SessionRuntime({
    sessionId: `s-${Date.now()}`,
    cwd: root,
    sessionRoot: join(root, "session"),
    sessionName: "cycle-stream",
    storeTarget: "workspace",
  });
};

describe("Feature: session runtime live cycle projection", () => {
  test("Scenario: Given streamed tool events When the active cycle updates Then tool rows stay in the same cycle without injecting attention previews into chat streaming", () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternals;

    internal.createActiveCycle({
      cycleId: 11,
      seq: 11,
      createdAt: 11,
      wakeSource: "user",
      inputs: [
        {
          source: "message",
          role: "user",
          name: "User",
          parts: [{ type: "text", text: "continue" }],
          meta: { clientMessageId: "client-11" },
        },
      ],
    });

    internal.handleAssistantStreamUpdate({
      kind: "tool_call",
      toolCallId: "tool-1",
      toolName: "attention_item_patch",
      argsText: '{"content":"Streaming reply',
      timestamp: 12,
    });

    let activeCycle = runtime.snapshot().activeCycle;
    expect(activeCycle?.streaming).toBeNull();
    expect(activeCycle?.liveMessages).toHaveLength(1);
    expect(activeCycle?.liveMessages[0]?.channel).toBe("tool");
    expect(activeCycle?.liveMessages[0]?.tool?.invocationId).toBe("tool-1");
    expect(activeCycle?.liveMessages[0]?.tool?.status).toBe("running");

    internal.handleAssistantStreamUpdate({
      kind: "tool_result",
      toolCallId: "tool-1",
      toolName: "attention_item_patch",
      ok: true,
      result: { ok: true, id: 7 },
      timestamp: 13,
    });

    activeCycle = runtime.snapshot().activeCycle;
    expect(activeCycle?.liveMessages).toHaveLength(1);
    expect(activeCycle?.liveMessages[0]?.channel).toBe("tool");
    expect(activeCycle?.liveMessages[0]?.tool?.status).toBe("success");
    expect(activeCycle?.status).toBe("streaming");
  });
});
