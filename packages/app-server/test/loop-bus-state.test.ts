import { describe, expect, test } from "bun:test";

import { LoopBus, type LoopBusPhase } from "../src/loop-bus";

describe("Feature: loop bus state transitions", () => {
  test("Scenario: Given queued message When processor is in-flight Then phase includes waiting_processor_response", async () => {
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

  test("Scenario: Given silent queue When loop ticks Then phase remains waiting_messages", async () => {
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

  test("Scenario: Given collectInputs polling When queue is silent Then loop still processes injected input", async () => {
    const phases: LoopBusPhase[] = [];
    let polled = 0;
    const bus = new LoopBus({
      processor: {
        send: async () => ({
          outputs: {
            toUser: [],
            toTerminal: [],
            toTools: [],
          },
        }),
      },
      logger: { log: () => {} },
      idleCollectIntervalMs: 120,
      collectInputs: async () => {
        polled += 1;
        if (polled !== 2) {
          return;
        }
        return {
          name: "Terminal-iflow",
          role: "user",
          type: "text",
          source: "terminal",
          text: "{\"kind\":\"terminal-heartbeat\"}",
        };
      },
      onStateChange: (state) => {
        phases.push(state.phase);
      },
    });

    bus.start();
    await Bun.sleep(420);
    bus.stop();

    expect(polled).toBeGreaterThanOrEqual(2);
    expect(phases.includes("collecting_inputs")).toBeTrue();
    expect(phases.includes("waiting_processor_response")).toBeTrue();
  });

  test("Scenario: Given terminal summary signal message When loop wakes Then processor is not called", async () => {
    let called = 0;
    const bus = new LoopBus({
      processor: {
        send: async () => {
          called += 1;
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
    });

    bus.start();
    bus.pushMessage({
      name: "Terminal-iflow",
      role: "user",
      type: "text",
      source: "terminal",
      text: "{\"kind\":\"terminal-dirty-summary\"}",
      meta: {
        signal: "summary",
      },
    });

    await Bun.sleep(80);
    bus.stop();

    expect(called).toBe(0);
  });
});
