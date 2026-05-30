import { describe, expect, test } from "bun:test";

import { AttentionSystem, type AttentionCommitHookResult } from "@agenter/attention-system";

import { LoopBusPluginRuntime } from "../src/loopbus-plugin-runtime";
import { RuntimeKernelHost } from "../src/runtime-kernel-host";
import type {
  RuntimeSystemIngressEnvelope,
  RuntimeSystemKernelAdapter,
} from "../src/runtime-system-kernel-adapters/types";

const createIngressEnvelope = (): RuntimeSystemIngressEnvelope => ({
  system: "message",
  boundaryChannel: "world_fact",
  sourceId: "room:room-alpha#1",
  contextKey: "ctx-room-alpha",
  kind: "room_ingress",
  summary: "Need reply",
  content: "hello",
  format: "text/plain",
  score: 100,
  tags: ["message"],
  createdAt: 1,
  author: "kzf",
});

describe("Feature: runtime-kernel-host", () => {
  test("Scenario: Given adapter ingress When host drains it Then commit truth stays separate from pending delivery", async () => {
    const attention = new AttentionSystem();
    const adapter: RuntimeSystemKernelAdapter = {
      name: "message",
      mount: () => {},
      drainIngress: () => [createIngressEnvelope()],
    };

    const host = new RuntimeKernelHost({
      commitIngress: async (envelope) => {
        attention.getContext(envelope.contextKey) ??
          attention.createContext({ contextId: envelope.contextKey, owner: "avatar" });
        const { commit } = attention.commit(envelope.contextKey, {
          meta: {
            author: envelope.author,
            source: envelope.system,
            src: envelope.sourceId,
            tags: envelope.tags,
            createdAt: new Date(envelope.createdAt).toISOString(),
          },
          scores: { seed: envelope.score ?? 100 },
          summary: envelope.summary,
          change: {
            type: envelope.changeType ?? "update",
            value: envelope.content,
            format: envelope.format,
          },
        });
        return {
          contextId: envelope.contextKey,
          commit,
        };
      },
      getAttentionCommit: (input) => attention.getContext(input.contextId)?.getCommit(input.commitId) ?? null,
      getAttentionContextState: (contextId) => attention.getContext(contextId)?.getState() ?? null,
    });

    host.mountAdapter(adapter);

    expect(await host.drainIngress()).toBe(1);
    const context = attention.getContext("ctx-room-alpha");
    const commitId = context?.getState().headCommitId ?? null;

    expect(commitId).not.toBeNull();
    if (!commitId) {
      throw new Error("expected committed ingress");
    }
    expect(
      host.getDeliveryProjection({
        contextId: "ctx-room-alpha",
        commitId,
      }),
    ).toMatchObject({
      state: "pending",
      attemptCount: 0,
      latestDispatchId: null,
      latestReceiptId: null,
    });
  });

  test("Scenario: Given dispatch and receipt When host bridges lifecycle Then plugins and adapters observe one neutral kernel law", async () => {
    const attention = new AttentionSystem();
    const recordedHooks: AttentionCommitHookResult[] = [];
    const adapterEvents: string[] = [];
    const pluginRuntime = new LoopBusPluginRuntime([
      {
        name: "delivery-observer",
        attentionDispatched: async () => ({
          hookId: "dispatch-hook",
          bridgeId: "message",
          status: "delivered",
        }),
        attentionReceipt: async ({ receipt }) => ({
          hookId: "receipt-hook",
          bridgeId: "message",
          status: receipt.status === "accepted" ? "delivered" : "ignored",
        }),
      },
    ]);
    await pluginRuntime.setup();

    const adapter: RuntimeSystemKernelAdapter = {
      name: "message",
      mount: () => {},
      onKernelEvent: async (event) => {
        adapterEvents.push(event.kind);
      },
    };

    const host = new RuntimeKernelHost({
      commitIngress: async (envelope) => {
        attention.getContext(envelope.contextKey) ??
          attention.createContext({ contextId: envelope.contextKey, owner: "avatar" });
        const { commit } = attention.commit(envelope.contextKey, {
          meta: {
            author: envelope.author,
            source: envelope.system,
            src: envelope.sourceId,
            tags: envelope.tags,
            createdAt: new Date(envelope.createdAt).toISOString(),
          },
          scores: { seed: envelope.score ?? 100 },
          summary: envelope.summary,
          change: {
            type: envelope.changeType ?? "update",
            value: envelope.content,
            format: envelope.format,
          },
        });
        return {
          contextId: envelope.contextKey,
          commit,
        };
      },
      getAttentionCommit: (input) => attention.getContext(input.contextId)?.getCommit(input.commitId) ?? null,
      getAttentionContextState: (contextId) => attention.getContext(contextId)?.getState() ?? null,
      notifyAttentionDispatched: async (input) =>
        await pluginRuntime.notifyAttentionDispatched(input, {
          contextId: input.contextId,
          commitId: input.commit.commitId,
          dispatchId: input.dispatch.dispatchId,
          cycleId: input.dispatch.cycleId,
          agentCallId: input.dispatch.agentCallId,
          sessionModelCallId: input.dispatch.sessionModelCallId,
        }),
      notifyAttentionReceipt: async (input) =>
        await pluginRuntime.notifyAttentionReceipt(input, {
          contextId: input.contextId,
          commitId: input.commit.commitId,
          dispatchId: input.dispatch.dispatchId,
          cycleId: input.dispatch.cycleId,
          agentCallId: input.dispatch.agentCallId,
          sessionModelCallId: input.dispatch.sessionModelCallId,
        }),
      recordAttentionHook: (_contextId, _commitId, result) => {
        recordedHooks.push(result);
      },
    });
    host.mountAdapter(adapter);

    const committed = await host.commitIngress(createIngressEnvelope());
    const commitId = committed?.commit.commitId ?? "";
    const dispatchResult = await host.createDispatch({
      contextId: "ctx-room-alpha",
      commitId,
      cycleId: 7,
      agentCallId: "agent-call-1",
    });
    await host.appendReceipt({
      dispatchId: dispatchResult.dispatch.dispatchId,
      status: "accepted",
      providerEventKind: "text_delta",
      timestamp: 10,
    });

    expect(adapterEvents).toEqual(["attentionDispatched", "attentionReceipt"]);
    expect(recordedHooks).toEqual([
      {
        hookId: "dispatch-hook",
        bridgeId: "message",
        status: "delivered",
      },
      {
        hookId: "receipt-hook",
        bridgeId: "message",
        status: "delivered",
      },
    ]);
    expect(
      host.getDeliveryProjection({
        contextId: "ctx-room-alpha",
        commitId,
      }),
    ).toMatchObject({
      state: "accepted",
      attemptCount: 1,
      latestDispatchId: dispatchResult.dispatch.dispatchId,
    });
  });

  test("Scenario: Given adapter ingress omits a valid boundary declaration When host drains it Then the host rejects the ambiguous runtime ingress", async () => {
    const adapter: RuntimeSystemKernelAdapter = {
      name: "message",
      mount: () => {},
      drainIngress: () => [
        {
          ...createIngressEnvelope(),
          boundaryChannel: "bad-boundary" as never,
        },
      ],
    };

    const host = new RuntimeKernelHost({
      commitIngress: async () => {
        throw new Error("should not commit invalid ingress");
      },
      getAttentionCommit: () => null,
      getAttentionContextState: () => null,
    });

    host.mountAdapter(adapter);

    await expect(host.drainIngress()).rejects.toThrow("invalid boundaryChannel");
  });

  test("Scenario: Given adapter ingress omits boundaryChannel entirely When host commits it Then the host rejects the ambiguous runtime ingress before attention changes", async () => {
    const host = new RuntimeKernelHost({
      commitIngress: async () => {
        throw new Error("should not commit invalid ingress");
      },
      getAttentionCommit: () => null,
      getAttentionContextState: () => null,
    });

    await expect(
      host.commitIngress({
        ...createIngressEnvelope(),
        boundaryChannel: undefined as never,
      }),
    ).rejects.toThrow("invalid boundaryChannel");
  });

  test("Scenario: Given adapter ingress omits source identity When host drains it Then the host rejects the ambiguous runtime ingress", async () => {
    const adapter: RuntimeSystemKernelAdapter = {
      name: "message",
      mount: () => {},
      drainIngress: () => [
        {
          ...createIngressEnvelope(),
          sourceId: "",
        },
      ],
    };

    const host = new RuntimeKernelHost({
      commitIngress: async () => {
        throw new Error("should not commit invalid ingress");
      },
      getAttentionCommit: () => null,
      getAttentionContextState: () => null,
    });

    host.mountAdapter(adapter);

    await expect(host.drainIngress()).rejects.toThrow("must declare sourceId");
  });

  test("Scenario: Given adapter ingress omits context identity When host drains it Then the host rejects the ambiguous runtime ingress", async () => {
    const adapter: RuntimeSystemKernelAdapter = {
      name: "message",
      mount: () => {},
      drainIngress: () => [
        {
          ...createIngressEnvelope(),
          contextKey: "",
        },
      ],
    };

    const host = new RuntimeKernelHost({
      commitIngress: async () => {
        throw new Error("should not commit invalid ingress");
      },
      getAttentionCommit: () => null,
      getAttentionContextState: () => null,
    });

    host.mountAdapter(adapter);

    await expect(host.drainIngress()).rejects.toThrow("must declare contextKey");
  });
});
