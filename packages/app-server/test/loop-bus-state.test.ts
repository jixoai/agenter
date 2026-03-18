import { describe, expect, test } from "bun:test";

import { LoopBus, type LoopBusInput, type LoopBusPhase, type LoopBusWakeSource } from "../src/loop-bus";

const userInput: LoopBusInput = {
  name: "User",
  role: "user",
  type: "text",
  source: "chat",
  text: "hello",
};

const createInput = (text: string): LoopBusInput => ({
  ...userInput,
  text,
});

describe("Feature: loop bus state transitions", () => {
  test("Scenario: Given one committed input When a cycle runs Then phases follow the new fixed ledger flow", async () => {
    const phases: LoopBusPhase[] = [];
    const persisted: Array<{ wakeSource: LoopBusWakeSource; inputs: LoopBusInput[] }> = [];
    const sent: LoopBusInput[][] = [];
    const outputs: string[] = [];
    const sleeps: number[] = [];

    let waitCalls = 0;
    let releaseWait: ((value: LoopBusWakeSource | void) => void) | null = null;

    const bus = new LoopBus({
      processor: {
        send: async (messages) => {
          sent.push(messages);
          return {
            outputs: {
              toUser: [
                {
                  id: "assistant-1",
                  role: "assistant",
                  content: "done",
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
      collectInputs: async () => [userInput],
      persistCycle: async (input) => {
        persisted.push({ wakeSource: input.wakeSource, inputs: input.inputs });
        return { cycleId: 7 };
      },
      onUserMessage: (message) => {
        outputs.push(message.content);
      },
      onStateChange: (state) => {
        phases.push(state.phase);
      },
      sleep: async (ms) => {
        sleeps.push(ms);
      },
    });

    bus.start();

    const deadline = Date.now() + 1_000;
    while (Date.now() < deadline) {
      if (sent.length === 1 && outputs.length === 1) {
        break;
      }
      await Bun.sleep(10);
    }

    bus.stop();
    const resolver: (value: LoopBusWakeSource | void) => void = releaseWait ?? (() => {});
    resolver(undefined);
    await Bun.sleep(10);

    expect(sleeps).toContain(300);
    expect(persisted).toHaveLength(1);
    expect(persisted[0]?.wakeSource).toBe("user");
    expect(persisted[0]?.inputs[0]?.text).toBe("hello");
    expect(sent).toHaveLength(1);
    expect(outputs).toEqual(["done"]);
    expect(phases).toContain("waiting_commits");
    expect(phases).toContain("collecting_inputs");
    expect(phases).toContain("persisting_cycle");
    expect(phases).toContain("calling_model");
    expect(phases).toContain("applying_outputs");
  });

  test("Scenario: Given wake signal but no collected facts When the cycle returns to race Then model call is skipped", async () => {
    const phases: LoopBusPhase[] = [];
    const persisted: number[] = [];
    const sent: number[] = [];

    let waitCalls = 0;
    let releaseWait: ((value: LoopBusWakeSource | void) => void) | null = null;

    const bus = new LoopBus({
      processor: {
        send: async () => {
          sent.push(1);
          return { outputs: { toUser: [], toTerminal: [], toTools: [] } };
        },
      },
      logger: { log: () => {} },
      waitForCommit: async () => {
        waitCalls += 1;
        if (waitCalls === 1) {
          return "terminal";
        }
        return await new Promise<LoopBusWakeSource | void>((resolve) => {
          releaseWait = resolve;
        });
      },
      collectInputs: async () => [],
      persistCycle: async () => {
        persisted.push(1);
        return { cycleId: 1 };
      },
      onStateChange: (state) => {
        phases.push(state.phase);
      },
      sleep: async () => {},
    });

    bus.start();
    await Bun.sleep(20);
    bus.stop();
    const resolver: (value: LoopBusWakeSource | void) => void = releaseWait ?? (() => {});
    resolver(undefined);
    await Bun.sleep(10);

    expect(persisted).toHaveLength(0);
    expect(sent).toHaveLength(0);
    expect(phases).not.toContain("collecting_inputs");
  });

  test("Scenario: Given more inputs arrive inside the debounce window When collecting Then the bus batches them into one cycle", async () => {
    const persisted: Array<{ wakeSource: LoopBusWakeSource; inputs: LoopBusInput[] }> = [];
    const sleeps: number[] = [];
    const collectResults = [[createInput("first")], [createInput("second")], []] as Array<LoopBusInput[]>;

    let waitCalls = 0;
    let releaseWait: ((value: LoopBusWakeSource | void) => void) | null = null;

    const bus = new LoopBus({
      processor: {
        send: async () => ({ outputs: { toUser: [], toTerminal: [], toTools: [] } }),
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
      collectInputs: async () => collectResults.shift() ?? [],
      persistCycle: async (input) => {
        persisted.push({ wakeSource: input.wakeSource, inputs: input.inputs });
        return { cycleId: 11 };
      },
      sleep: async (ms) => {
        sleeps.push(ms);
      },
    });

    bus.start();
    await Bun.sleep(20);
    bus.stop();
    (releaseWait ?? ((_value?: LoopBusWakeSource | void) => {}))(undefined);
    await Bun.sleep(10);

    expect(sleeps).toEqual([300, 300]);
    expect(persisted).toHaveLength(1);
    expect(persisted[0]?.inputs.map((item) => item.text)).toEqual(["first", "second"]);
  });

  test("Scenario: Given inputs keep arriving When collecting Then the bus stops batching after the 1s throttle window", async () => {
    const persisted: Array<{ wakeSource: LoopBusWakeSource; inputs: LoopBusInput[] }> = [];
    const sleeps: number[] = [];
    const collectResults = [
      [createInput("first")],
      [createInput("second")],
      [createInput("third")],
      [createInput("fourth")],
      [createInput("fifth")],
      [createInput("late")],
    ] as Array<LoopBusInput[]>;

    let waitCalls = 0;
    let releaseWait: ((value: LoopBusWakeSource | void) => void) | null = null;

    const bus = new LoopBus({
      processor: {
        send: async () => ({ outputs: { toUser: [], toTerminal: [], toTools: [] } }),
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
      collectInputs: async () => collectResults.shift() ?? [],
      persistCycle: async (input) => {
        persisted.push({ wakeSource: input.wakeSource, inputs: input.inputs });
        return { cycleId: 12 };
      },
      sleep: async (ms) => {
        sleeps.push(ms);
      },
    });

    bus.start();
    await Bun.sleep(20);
    bus.stop();
    (releaseWait ?? ((_value?: LoopBusWakeSource | void) => {}))(undefined);
    await Bun.sleep(10);

    expect(sleeps).toEqual([300, 300, 300, 100]);
    expect(persisted).toHaveLength(1);
    expect(persisted[0]?.inputs.map((item) => item.text)).toEqual(["first", "second", "third", "fourth", "fifth"]);
  });
});
