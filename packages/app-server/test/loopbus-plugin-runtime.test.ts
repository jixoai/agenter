import { describe, expect, test } from "bun:test";

import { AttentionSystem } from "@agenter/attention-system";

import { formatMessageAttentionSrc, parseMessageAttentionSrc } from "../src/attention-src";
import { LoopBusPluginRuntime, type LoopBusPlugin, type LoopMessageSourceRef } from "../src/loopbus-plugin-runtime";

const createMessageRef = (chatId: string, messageId: number): LoopMessageSourceRef => ({
  src: formatMessageAttentionSrc({ chatId, messageId }),
  reason: "message-committed",
});

describe("Feature: loopbus-attention-output-pipeline", () => {
  test("Scenario: Given room-scope lifecycle refs When message attention sources are formatted and parsed Then room identity stays protocol-native without pretending to be a row ref", () => {
    const roomSrc = formatMessageAttentionSrc({ chatId: "chat-alpha" });
    const rowSrc = formatMessageAttentionSrc({ chatId: "chat-alpha", messageId: 7 });

    expect(roomSrc).toBe("msg:chat-alpha");
    expect(parseMessageAttentionSrc(roomSrc)).toEqual({ chatId: "chat-alpha" });
    expect(rowSrc).toBe("msg:chat-alpha/7");
    expect(parseMessageAttentionSrc(rowSrc)).toEqual({ chatId: "chat-alpha", messageId: 7 });
  });

  test("Scenario: Given two attention committed hooks When runtime notifies a commit Then structured hook results are collected in order", async () => {
    const calls: string[] = [];
    const plugins: LoopBusPlugin[] = [
      {
        name: "first-hook",
        attentionCommitted: async () => {
          calls.push("first");
          return {
            hookId: "first-hook",
            bridgeId: "message",
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
            bridgeId: "message",
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
      scores: { hash1: 0 },
      summary: "reply",
      change: { type: "update", value: "reply", format: "text/plain" },
    });

    const results = await runtime.notifyAttentionCommitted({ contextId: "ctx-1", context, commit }, { contextId: "ctx-1" });
    expect(results).toEqual([
      {
        hookId: "first-hook",
        bridgeId: "message",
        status: "ignored",
      },
      {
        hookId: "second-hook",
        bridgeId: "message",
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

  test("Scenario: Given dispatch and receipt hooks When runtime notifies delivery lifecycle Then hook results stay stage-specific", async () => {
    const runtime = new LoopBusPluginRuntime([
      {
        name: "delivery-observer",
        attentionDispatched: async () => ({
          hookId: "dispatch-hook",
          bridgeId: "message",
          status: "delivered",
          target: { phase: "dispatch" },
        }),
        attentionReceipt: async ({ receipt }) => ({
          hookId: "receipt-hook",
          bridgeId: "message",
          status: receipt.status === "accepted" ? "delivered" : "ignored",
          target: { phase: "receipt", status: receipt.status },
        }),
      },
    ]);

    const system = new AttentionSystem();
    system.createContext({ contextId: "ctx-1", owner: "jane" });
    const { context, commit } = system.commit("ctx-1", {
      meta: { author: "avatar:jane", source: "attention" },
      scores: { hash1: 100 },
      summary: "reply",
      change: { type: "update", value: "reply", format: "text/plain" },
    });

    const dispatchResults = await runtime.notifyAttentionDispatched(
      {
        contextId: "ctx-1",
        context,
        commit,
        dispatch: {
          dispatchId: "dispatch-1",
          cycleId: 7,
          attemptIndex: 1,
          agentCallId: "agent-call-1",
          sessionModelCallId: null,
          createdAt: 100,
        },
      },
      {
        contextId: "ctx-1",
        commitId: commit.commitId,
        dispatchId: "dispatch-1",
        cycleId: 7,
        agentCallId: "agent-call-1",
      },
    );
    const receiptResults = await runtime.notifyAttentionReceipt(
      {
        contextId: "ctx-1",
        context,
        commit,
        dispatch: {
          dispatchId: "dispatch-1",
          cycleId: 7,
          attemptIndex: 1,
          agentCallId: "agent-call-1",
          sessionModelCallId: 41,
          createdAt: 100,
        },
        receipt: {
          receiptId: "receipt-1",
          status: "accepted",
          providerEventKind: "text_delta",
          timestamp: 120,
        },
      },
      {
        contextId: "ctx-1",
        commitId: commit.commitId,
        dispatchId: "dispatch-1",
        cycleId: 7,
        agentCallId: "agent-call-1",
        sessionModelCallId: 41,
      },
    );

    expect(dispatchResults).toEqual([
      {
        hookId: "dispatch-hook",
        bridgeId: "message",
        status: "delivered",
        target: { phase: "dispatch" },
      },
    ]);
    expect(receiptResults).toEqual([
      {
        hookId: "receipt-hook",
        bridgeId: "message",
        status: "delivered",
        target: { phase: "receipt", status: "accepted" },
      },
    ]);
  });

  test("Scenario: Given an attentionShouldLoad denial When drafts are read Then the ref stays invalidated until a later round allows it", async () => {
    let allow = false;
    const messages = new Map<string, string>([["chat-1:1", "hello"]]);
    const runtime = new LoopBusPluginRuntime([
      {
        name: "message-source",
        setup: (api) => {
          api.registerSource({
            namespace: "msg",
            parse: parseMessageAttentionSrc,
            format: formatMessageAttentionSrc,
            key: formatMessageAttentionSrc,
            bucket: (ref) => `msg:${ref.chatId}`,
            read: async (request) => ({
              kind: "snapshot",
              content: messages.get(`${request.parsed.chatId}:${request.parsed.messageId}`) ?? "",
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
    runtime.invalidate(createMessageRef("chat-1", 1));

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
      ["chat-alpha:1", "from alpha"],
      ["chat-beta:1", "from beta"],
    ]);
    const runtime = new LoopBusPluginRuntime([
      {
        name: "message-source",
        setup: (api) => {
          api.registerSource({
            namespace: "msg",
            parse: parseMessageAttentionSrc,
            format: formatMessageAttentionSrc,
            key: formatMessageAttentionSrc,
            bucket: (ref) => `msg:${ref.chatId}`,
            read: async (request) => ({
              kind: "snapshot",
              content: messages.get(`${request.parsed.chatId}:${request.parsed.messageId}`) ?? "",
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
    runtime.invalidate(createMessageRef("chat-alpha", 1));
    runtime.invalidate(createMessageRef("chat-beta", 1));

    const drafts = await runtime.readInvalidatedAttentionDrafts();
    expect(drafts).toHaveLength(2);
    expect(
      drafts.map((draft) => ({
        content: draft.content,
        src: draft.sourceRef.src,
      })),
    ).toEqual([
      { content: "from alpha", src: "msg:chat-alpha/1" },
      { content: "from beta", src: "msg:chat-beta/1" },
    ]);
  });
});
