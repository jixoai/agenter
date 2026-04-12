import { describe, expect, test } from "bun:test";

import { AttentionSystem } from "@agenter/attention-system";

import { LoopBusPluginRuntime, type LoopBusPlugin, type LoopMessageSourceRef } from "../src/loopbus-plugin-runtime";

const createMessageRef = (channelId: string, subjectId: string): LoopMessageSourceRef => ({
  systemId: "message",
  channelId,
  subjectId,
  reason: "message-committed",
});

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
      meta: { author: "avatar:jane", source: "attention" },
      egress: { kind: "message_reply", chatId: "chat-kzf" },
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

  test("Scenario: Given an attentionShouldLoad denial When drafts are read Then the ref stays invalidated until a later round allows it", async () => {
    let allow = false;
    const messages = new Map<string, string>([["chat-1:msg-1", "hello"]]);
    const runtime = new LoopBusPluginRuntime([
      {
        name: "message-source",
        setup: (api) => {
          api.registerSource({
            systemId: "message",
            match: (ref) => ref.systemId === "message",
            read: async (request) => ({
              kind: "snapshot",
              content:
                request.ref.systemId === "message" && "channelId" in request.ref
                  ? (messages.get(`${request.ref.channelId}:${request.ref.subjectId}`) ?? "")
                  : "",
              bytes: 0,
              fromHash: null,
              toHash: null,
            }),
            toAttentionDrafts: async (result, request) => [
              {
                sourceRef: request.ref,
                content: result.content,
                from: "User",
              },
            ],
          });
        },
      },
      {
        name: "gate",
        attentionShouldLoad: () => ({ allow }),
      },
    ]);

    await runtime.setup();
    runtime.invalidate(createMessageRef("chat-1", "msg-1"));

    const deferred = await runtime.readInvalidatedAttentionDrafts();
    expect(deferred).toEqual([]);
    expect(runtime.hasInvalidations()).toBe(true);

    allow = true;
    const drafts = await runtime.readInvalidatedAttentionDrafts();
    expect(drafts).toHaveLength(1);
    expect(drafts[0]?.content).toBe("hello");
    expect(runtime.hasInvalidations()).toBe(false);
  });

  test("Scenario: Given two rooms reuse the same message id When invalidations are keyed Then message refs do not collide", async () => {
    const messages = new Map<string, string>([
      ["chat-alpha:msg-1", "from alpha"],
      ["chat-beta:msg-1", "from beta"],
    ]);
    const runtime = new LoopBusPluginRuntime([
      {
        name: "message-source",
        setup: (api) => {
          api.registerSource({
            systemId: "message",
            match: (ref) => ref.systemId === "message",
            read: async (request) => ({
              kind: "snapshot",
              content:
                request.ref.systemId === "message" && "channelId" in request.ref
                  ? (messages.get(`${request.ref.channelId}:${request.ref.subjectId}`) ?? "")
                  : "",
              bytes: 0,
              fromHash: null,
              toHash: null,
            }),
            toAttentionDrafts: async (result, request) => [
              {
                sourceRef: request.ref,
                content: result.content,
                from: "User",
              },
            ],
          });
        },
      },
    ]);

    await runtime.setup();
    runtime.invalidate(createMessageRef("chat-alpha", "msg-1"));
    runtime.invalidate(createMessageRef("chat-beta", "msg-1"));

    const drafts = await runtime.readInvalidatedAttentionDrafts();
    expect(drafts).toHaveLength(2);
    expect(
      drafts.map((draft) => ({
        content: draft.content,
        channelId: draft.sourceRef.systemId === "message" && "channelId" in draft.sourceRef ? draft.sourceRef.channelId : null,
      })),
    ).toEqual([
      { content: "from alpha", channelId: "chat-alpha" },
      { content: "from beta", channelId: "chat-beta" },
    ]);
  });
});
