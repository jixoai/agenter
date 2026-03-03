import { describe, expect, test } from "bun:test";

import { buildViewModel } from "../src/types";

describe("Feature: tui view-model mapping", () => {
  test("Scenario: Given active instance runtime When building view Then expose phase text and messages", () => {
    const state = {
      connected: true,
      lastEventId: 3,
      instances: [
        {
          id: "i-1",
          name: "demo",
          cwd: "/tmp/demo",
          createdAt: new Date(0).toISOString(),
          updatedAt: new Date(0).toISOString(),
          autoStart: true,
          status: "running" as const,
        },
      ],
      runtimes: {
        "i-1": {
          instanceId: "i-1",
          started: true,
          loopPhase: "processing_messages" as const,
          stage: "observe" as const,
          focusedTerminalId: "iflow-main",
          chatMessages: [],
          terminals: [],
        },
      },
      chatsByInstance: {
        "i-1": [
          {
            id: "m-1",
            role: "assistant" as const,
            content: "hello",
            timestamp: Date.now(),
          },
        ],
      },
    };

    const view = buildViewModel(state, "i-1");
    expect(view.connected).toBe(true);
    expect(view.messages).toHaveLength(1);
    expect(view.phaseText).toContain("processing_messages");
    expect(view.phaseText).toContain("observe");
  });
});
