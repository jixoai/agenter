import { describe, expect, test } from "bun:test";

import { LoopBus, type LoopBusPhase } from "../src/loop-bus";

describe("LoopBus state", () => {
  test("emits waiting_processor_response when processor call is in-flight", async () => {
    const phases: LoopBusPhase[] = [];
    const bus = new LoopBus({
      processor: {
        send: async () => {
          await Bun.sleep(20);
          return {
            outputs: {
              toUser: [],
              toTerminal: [],
              toTools: [],
            },
          };
        },
      },
      logger: { log: () => {} },
      onStateChange: (state) => {
        phases.push(state.phase);
      },
    });

    bus.start();
    bus.pushMessage({
      name: "User",
      role: "user",
      type: "text",
      source: "chat",
      text: "hello",
    });

    await Bun.sleep(80);
    bus.stop();

    expect(phases.includes("waiting_messages")).toBeTrue();
    expect(phases.includes("waiting_processor_response")).toBeTrue();
    expect(phases.includes("processing_messages")).toBeTrue();

    const waitIndex = phases.indexOf("waiting_processor_response");
    const silentIndex = phases.lastIndexOf("waiting_messages");
    expect(waitIndex).toBeGreaterThanOrEqual(0);
    expect(silentIndex).toBeGreaterThan(waitIndex);
  });

  test("stays in waiting_messages when queue is silent", async () => {
    const phases: LoopBusPhase[] = [];
    const bus = new LoopBus({
      processor: {
        send: async () => {
          throw new Error("processor should not be called in silent phase");
        },
      },
      logger: { log: () => {} },
      onStateChange: (state) => {
        phases.push(state.phase);
      },
    });

    bus.start();
    await Bun.sleep(20);
    bus.stop();

    expect(phases.includes("waiting_messages")).toBeTrue();
    expect(phases.includes("waiting_processor_response")).toBeFalse();
  });
});
