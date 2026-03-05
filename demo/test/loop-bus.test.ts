import { expect, test } from "bun:test";

import { LoopBus, type LoopBusMessage } from "@agenter/app-server";
import type { ChatMessage } from "../src/core/protocol";
import { DebugLogger } from "../src/infra/logger";

const waitUntil = async (predicate: () => boolean, timeoutMs = 1200): Promise<void> => {
  const startedAt = Date.now();
  while (!predicate()) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error("waitUntil timeout");
    }
    await Bun.sleep(20);
  }
};

test("loop bus keeps message order and dispatches user/terminal handlers", async () => {
  const logger = new DebugLogger("logs/test", 120);
  const receivedBatches: string[][] = [];
  const userMessages: ChatMessage[] = [];
  const terminalCommands: string[] = [];

  const bus = new LoopBus({
    logger,
    processor: {
      send: async (messages) => {
        receivedBatches.push(messages.map((item) => item.text));
        return {
          user: {
            id: "assistant-1",
            role: "assistant",
            timestamp: Date.now(),
            content: "ack",
          },
          terminal: [
            {
              taskId: "task-1",
              terminalId: "t-1",
              text: "run",
              submit: true,
            },
          ],
        };
      },
    },
    onUserMessage: (message) => {
      userMessages.push(message);
    },
    onTerminalDispatch: (command) => {
      terminalCommands.push(command.text);
    },
  });

  bus.pushMessage({
    id: "late",
    timestamp: 20,
    name: "User",
    role: "user",
    type: "text",
    source: "chat",
    text: "B",
  });
  bus.pushMessage({
    id: "early",
    timestamp: 10,
    name: "User",
    role: "user",
    type: "text",
    source: "chat",
    text: "A",
  });
  bus.start();

  await waitUntil(() => receivedBatches.length > 0);
  bus.stop();

  expect(receivedBatches[0]).toEqual(["A", "B"]);
  expect(userMessages[0]?.content).toBe("ack");
  expect(terminalCommands).toEqual(["run"]);
});

test("loop bus pushes tool-call results back to queue", async () => {
  const logger = new DebugLogger("logs/test", 120);
  const seenMessages: LoopBusMessage[][] = [];
  const userMessages: ChatMessage[] = [];
  let turns = 0;

  const bus = new LoopBus({
    logger,
    processor: {
      send: async (messages) => {
        seenMessages.push(messages);
        turns += 1;
        if (turns === 1) {
          return {
            tools: [{ id: "call-1", name: "echo", input: "hello" }],
          };
        }
        return {
          done: true,
          user: {
            id: "assistant-2",
            role: "assistant",
            timestamp: Date.now(),
            content: "tool handled",
          },
        };
      },
    },
    onToolCall: async () => ({
      name: "Tool-echo",
      role: "tool",
      type: "text",
      source: "tool",
      text: "echo result",
    }),
    onUserMessage: (message) => {
      userMessages.push(message);
    },
  });

  bus.start();
  bus.pushMessage({
    name: "User",
    role: "user",
    type: "text",
    source: "chat",
    text: "start",
  });

  await waitUntil(() => userMessages.length > 0);
  bus.stop();

  expect(seenMessages.length).toBe(2);
  expect(seenMessages[1]?.[0]?.source).toBe("tool");
  expect(userMessages[0]?.content).toContain("tool handled");
});

test("loop bus merges terminal dirty messages before pop", async () => {
  const logger = new DebugLogger("logs/test", 120);
  const batches: LoopBusMessage[][] = [];
  const bus = new LoopBus({
    logger,
    processor: {
      send: async (messages) => {
        batches.push(messages);
      },
    },
  });

  bus.pushMessage({
    name: "Terminal-terminal-main",
    role: "user",
    source: "terminal",
    type: "text",
    text: "[terminal-dirty] seq=1 ops=3",
    timestamp: 10,
  });
  bus.pushMessage({
    name: "Terminal-terminal-main",
    role: "user",
    source: "terminal",
    type: "text",
    text: "[terminal-dirty] seq=2 ops=7",
    timestamp: 12,
  });
  bus.pushMessage({
    name: "Terminal-terminal-main",
    role: "user",
    source: "terminal",
    type: "text",
    text: "[terminal-dirty] seq=3 ops=1",
    timestamp: 14,
  });

  bus.start();
  await waitUntil(() => batches.length > 0);
  bus.stop();

  expect(batches[0]?.length).toBe(1);
  expect(batches[0]?.[0]?.source).toBe("terminal");
  expect(batches[0]?.[0]?.text).toContain("seq=3");
});

test("loop bus ignores terminal signal message and uses collected diff payload", async () => {
  const logger = new DebugLogger("logs/test", 120);
  const received: LoopBusMessage[][] = [];
  const bus = new LoopBus({
    logger,
    processor: {
      send: async (messages) => {
        received.push(messages);
      },
    },
    collectInputs: async () => ({
      name: "Terminal-terminal-main",
      role: "user",
      source: "terminal",
      type: "text",
      text: '{"kind":"terminal-diff"}',
      meta: {
        terminalId: "terminal-main",
      },
    }),
  });

  bus.start();
  bus.pushMessage({
    name: "Terminal-terminal-main",
    role: "user",
    source: "terminal",
    type: "text",
    text: "__dirty__",
    meta: {
      signal: true,
    },
  });

  await waitUntil(() => received.length > 0);
  bus.stop();

  expect(received.length).toBe(1);
  expect(received[0]).toHaveLength(1);
  expect(received[0]?.[0]?.text).toContain("terminal-diff");
});
