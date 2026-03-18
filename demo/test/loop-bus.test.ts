import { describe, expect, test } from "bun:test";

import { LoopBus, type LoopBusInput, type LoopBusWakeSource } from "@agenter/app-server";
import type { ChatMessage } from "../src/core/protocol";

const waitUntil = async (predicate: () => boolean, timeoutMs = 1_000): Promise<void> => {
  const startedAt = Date.now();
  while (!predicate()) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error("waitUntil timeout");
    }
    await Bun.sleep(10);
  }
};

describe("Feature: demo loop bus wiring", () => {
  test("Scenario: Given committed chat inputs When one cycle runs Then user and terminal outputs are dispatched", async () => {
    const queued: LoopBusInput[][] = [
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
    const userOutputs: ChatMessage[] = [];
    const terminalOutputs: string[] = [];
    const persisted: Array<{ wakeSource: LoopBusWakeSource; size: number }> = [];
    const releaseWaitRef: { current: null | (() => void) } = { current: null };

    let waitCalls = 0;

    const bus = new LoopBus({
      logger: { log: () => {} },
      processor: {
        send: async (messages) => {
          expect(messages).toHaveLength(1);
          expect(messages[0]?.text).toBe("continue");
          return {
            outputs: {
              toUser: [
                {
                  id: "assistant-1",
                  role: "assistant",
                  content: "acknowledged",
                  timestamp: Date.now(),
                },
              ],
              toTerminal: [
                {
                  taskId: "task-1",
                  terminalId: "iflow",
                  text: "date",
                  submit: true,
                },
              ],
              toTools: [],
            },
          };
        },
      },
      waitForCommit: async () => {
        waitCalls += 1;
        if (waitCalls === 1) {
          return "user";
        }
        return await new Promise<LoopBusWakeSource | void>((resolve) => {
          releaseWaitRef.current = () => resolve(undefined);
        });
      },
      collectInputs: async () => queued.shift(),
      persistCycle: async ({ wakeSource, inputs }) => {
        persisted.push({ wakeSource, size: inputs.length });
        return { cycleId: 1 };
      },
      onUserMessage: (message) => {
        userOutputs.push(message);
      },
      onTerminalDispatch: (command) => {
        terminalOutputs.push(command.text);
      },
      sleep: async () => {},
    });

    bus.start();
    await waitUntil(() => userOutputs.length === 1 && terminalOutputs.length === 1);
    bus.stop();
    if (releaseWaitRef.current !== null) {
      releaseWaitRef.current();
    }
    await Bun.sleep(10);

    expect(persisted).toEqual([{ wakeSource: "user", size: 1 }]);
    expect(userOutputs[0]?.content).toBe("acknowledged");
    expect(terminalOutputs).toEqual(["date"]);
  });

  test("Scenario: Given a wake signal but no collected inputs When the cycle settles Then the model call is skipped", async () => {
    const persisted: number[] = [];
    const modelCalls: number[] = [];
    const releaseWaitRef: { current: null | (() => void) } = { current: null };

    let waitCalls = 0;

    const bus = new LoopBus({
      logger: { log: () => {} },
      processor: {
        send: async () => {
          modelCalls.push(1);
        },
      },
      waitForCommit: async () => {
        waitCalls += 1;
        if (waitCalls === 1) {
          return "terminal";
        }
        return await new Promise<LoopBusWakeSource | void>((resolve) => {
          releaseWaitRef.current = () => resolve(undefined);
        });
      },
      collectInputs: async () => [],
      persistCycle: async () => {
        persisted.push(1);
        return { cycleId: 1 };
      },
      sleep: async () => {},
    });

    bus.start();
    await Bun.sleep(20);
    bus.stop();
    if (releaseWaitRef.current !== null) {
      releaseWaitRef.current();
    }
    await Bun.sleep(10);

    expect(persisted).toHaveLength(0);
    expect(modelCalls).toHaveLength(0);
  });
});
