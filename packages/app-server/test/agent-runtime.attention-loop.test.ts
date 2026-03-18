import { describe, expect, test } from "bun:test";

import { AgentRuntime } from "../src/agent-runtime";
import type { LoopBusInput, LoopBusWakeSource } from "../src/loop-bus";
import type { ChatMessage } from "../src/types";

describe("Feature: agent runtime orchestration", () => {
  test("Scenario: Given committed chat inputs When runtime runs one cycle Then processor receives them and user outputs are dispatched", async () => {
    const sent: LoopBusInput[][] = [];
    const outputs: ChatMessage[] = [];
    const queue: LoopBusInput[][] = [
      [
        {
          name: "User",
          role: "user",
          type: "text",
          source: "chat",
          text: "continue",
        },
      ],
    ];

    let waitCalls = 0;
    let releaseWait: ((value: LoopBusWakeSource | void) => void) | null = null;

    const runtime = new AgentRuntime<ChatMessage>({
      processor: {
        send: async (messages) => {
          sent.push(messages);
          return {
            outputs: {
              toUser: [
                {
                  id: "assistant-1",
                  role: "assistant",
                  content: "acknowledged",
                  channel: "to_user",
                  timestamp: Date.now(),
                },
              ],
              toTerminal: [],
              toTools: [],
            },
          };
        },
      },
      logger: { log: () => {} },
      waitForCommit: async () => {
        waitCalls += 1;
        if (waitCalls === 1) {
          return "user";
        }
        return await new Promise<LoopBusWakeSource | void>((resolve) => {
          releaseWait = resolve;
        });
      },
      collectInputs: async () => queue.shift(),
      persistCycle: async () => ({ cycleId: 1 }),
      onUserMessage: (message) => {
        outputs.push(message);
      },
      onLoopStateChange: () => {},
    });

    runtime.start();

    const deadline = Date.now() + 1_000;
    while (Date.now() < deadline) {
      if (outputs.length === 1) {
        break;
      }
      await Bun.sleep(10);
    }

    runtime.stop();
    const resolver: ((value: void) => void) = releaseWait ?? (() => {});
    resolver(undefined);
    await Bun.sleep(10);

    expect(sent).toHaveLength(1);
    expect(sent[0]?.[0]?.text).toBe("continue");
    expect(outputs).toHaveLength(1);
    expect(outputs[0]?.content).toBe("acknowledged");
  });
});
