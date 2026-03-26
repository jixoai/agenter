import { describe, expect, test } from "bun:test";

import { AttentionSystem } from "@agenter/attention-system";

import { LoopBusPluginRuntime, type LoopBusPlugin } from "../src/loopbus-plugin-runtime";

describe("Feature: loopbus-attention-output-pipeline", () => {
  test("Scenario: Given two attention committed hooks When runtime notifies a commit Then structured hook results are collected in order", async () => {
    const calls: string[] = [];
    const plugins: LoopBusPlugin[] = [
      {
        name: "first-hook",
        attentionCommitted: async () => {
          calls.push("first");
          return {
            hookId: "first-hook",
            systemId: "message",
            status: "ignored",
          };
        },
      },
      {
        name: "second-hook",
        attentionCommitted: async () => {
          calls.push("second");
          return {
            hookId: "second-hook",
            systemId: "message",
            status: "delivered",
            target: { chatId: "chat-kzf" },
          };
        },
      },
    ];

    const runtime = new LoopBusPluginRuntime(plugins);
    await runtime.setup();

    const system = new AttentionSystem();
    system.createContext({ contextId: "ctx-1", owner: "jane" });
    const { context, commit } = system.commit("ctx-1", {
      meta: { author: "avatar:jane", source: "attention", replyTarget: { systemId: "message", subjectId: "chat-kzf" } },
      scores: { hash1: 0 },
      summary: "reply",
      change: { type: "update", value: "reply", format: "text/plain" },
    });

    const results = await runtime.notifyAttentionCommitted({ contextId: "ctx-1", context, commit }, { contextId: "ctx-1" });
    expect(results).toEqual([
      {
        hookId: "first-hook",
        systemId: "message",
        status: "ignored",
      },
      {
        hookId: "second-hook",
        systemId: "message",
        status: "delivered",
        target: { chatId: "chat-kzf" },
      },
    ]);
    expect(calls).toEqual(["first", "second"]);
  });

  test("Scenario: Given lifecycle hooks When notify methods run Then abort signal is shared with plugins", async () => {
    const received: Array<{ hook: string; aborted: boolean }> = [];
    const controller = new AbortController();
    const runtime = new LoopBusPluginRuntime([
      {
        name: "lifecycle-observer",
        cycleWillCallModel: async ({ signal }) => {
          received.push({ hook: "will", aborted: signal.aborted });
        },
        cycleDidCallModel: async ({ signal }) => {
          received.push({ hook: "did", aborted: signal.aborted });
        },
        cycleDidAbort: async ({ signal }) => {
          received.push({ hook: "abort", aborted: signal.aborted });
        },
      },
    ]);

    await runtime.notifyCycleWillCallModel({ cycleId: "cycle-1", signal: controller.signal });
    await runtime.notifyCycleDidCallModel({ cycleId: "cycle-1", signal: controller.signal, result: { ok: true } });
    controller.abort("stop");
    await runtime.notifyCycleDidAbort({ cycleId: "cycle-1", signal: controller.signal, reason: "stop" });

    expect(received).toEqual([
      { hook: "will", aborted: false },
      { hook: "did", aborted: false },
      { hook: "abort", aborted: true },
    ]);
  });
});
