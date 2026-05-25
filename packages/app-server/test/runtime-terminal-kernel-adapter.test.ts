import { describe, expect, test } from "bun:test";

import { RuntimeTerminalKernelAdapter } from "../src/runtime-system-kernel-adapters/terminal-adapter";
import type { RuntimeSystemIngressEnvelope, RuntimeSystemKernelHost } from "../src/runtime-system-kernel-adapters/types";

describe("Feature: runtime-terminal-kernel-adapter", () => {
  test("Scenario: Given a focused dirty terminal When adapter drains Then terminal observations become neutral ingress", async () => {
    const signals: string[] = [];
    const envelope: RuntimeSystemIngressEnvelope = {
      system: "terminal",
      boundaryChannel: "world_fact",
      sourceId: "tty:iflow",
      contextKey: "ctx-terminal-iflow",
      kind: "terminal_snapshot",
      summary: "Terminal iflow: echo ready",
      content: "```text\necho ready\n```",
      format: "text/markdown",
      score: 0,
      tags: ["terminal", "snapshot"],
      createdAt: 1,
      author: "terminal:iflow",
    };
    const adapter = new RuntimeTerminalKernelAdapter({
      isLoopPaused: () => false,
      listFocusedTerminalIds: () => ["iflow"],
      isTerminalRunning: () => true,
      getTerminalStatus: () => "IDLE",
      getTerminalContextId: (terminalId) => `ctx-terminal-${terminalId}`,
      isTerminalActionable: () => false,
      readTerminalIngress: async () => envelope,
      buildLifecycleIngressEnvelope: (input) => ({
        system: "terminal",
        boundaryChannel: "scheduler_signal",
        sourceId: `tty:${input.terminalId}`,
        contextKey: input.contextId,
        kind: input.event,
        summary: input.summary,
        content: input.summary,
        format: "text/plain",
        score: input.score ?? 0,
        tags: ["terminal", "lifecycle"],
        createdAt: 1,
        author: "avatar",
      }),
      onTerminalActionableSignal: () => {
        signals.push("terminal");
      },
    });

    adapter.markTerminalDirty("iflow");

    expect(signals).toEqual([]);
    expect(adapter.hasFocusedDirtyWork()).toBeFalse();
    expect(await adapter.drainIngress()).toBeUndefined();
    expect(adapter.hasFocusedDirtyWork()).toBeFalse();
  });

  test("Scenario: Given a focused actionable terminal When adapter drains Then one actionable signal and ingress are emitted", async () => {
    const signals: string[] = [];
    const envelope: RuntimeSystemIngressEnvelope = {
      system: "terminal",
      boundaryChannel: "world_fact",
      sourceId: "tty:iflow",
      contextKey: "ctx-terminal-iflow",
      kind: "terminal_snapshot",
      summary: "Terminal iflow: ready",
      content: "ready",
      format: "text/plain",
      score: 0,
      tags: ["terminal", "snapshot"],
      createdAt: 1,
      author: "terminal:iflow",
    };
    const adapter = new RuntimeTerminalKernelAdapter({
      isLoopPaused: () => false,
      listFocusedTerminalIds: () => ["iflow"],
      isTerminalRunning: () => true,
      getTerminalStatus: () => "IDLE",
      getTerminalContextId: (terminalId) => `ctx-terminal-${terminalId}`,
      isTerminalActionable: () => true,
      readTerminalIngress: async () => envelope,
      buildLifecycleIngressEnvelope: (input) => ({
        system: "terminal",
        boundaryChannel: "scheduler_signal",
        sourceId: `tty:${input.terminalId}`,
        contextKey: input.contextId,
        kind: input.event,
        summary: input.summary,
        content: input.summary,
        format: "text/plain",
        score: input.score ?? 0,
        tags: ["terminal", "lifecycle"],
        createdAt: 1,
        author: "avatar",
      }),
      onTerminalActionableSignal: ({ terminalId, reason }) => {
        signals.push(`${terminalId}:${reason}`);
      },
    });

    adapter.markTerminalDirty("iflow");

    expect(signals).toEqual(["iflow:terminal.actionable"]);
    expect(adapter.hasFocusedDirtyWork()).toBeTrue();
    expect(await adapter.drainIngress()).toEqual([envelope]);
    expect(adapter.hasFocusedDirtyWork()).toBeFalse();
  });

  test("Scenario: Given terminal lifecycle ingress before host boot When adapter bootstraps Then scheduler-only lifecycle stays out of host commits", async () => {
    const committed: RuntimeSystemIngressEnvelope[] = [];
    const adapter = new RuntimeTerminalKernelAdapter({
      isLoopPaused: () => false,
      listFocusedTerminalIds: () => [],
      isTerminalRunning: () => false,
      getTerminalStatus: () => null,
      getTerminalContextId: (terminalId) => `ctx-terminal-${terminalId}`,
      isTerminalActionable: () => false,
      readTerminalIngress: async () => null,
      buildLifecycleIngressEnvelope: (input) => ({
        system: "terminal",
        boundaryChannel: "scheduler_signal",
        sourceId: `tty:${input.terminalId}`,
        contextKey: input.contextId,
        kind: input.event,
        summary: input.summary,
        content: input.summary,
        format: "text/plain",
        score: input.score ?? 0,
        tags: ["terminal", "lifecycle"],
        createdAt: 1,
        author: "avatar",
      }),
      onTerminalActionableSignal: () => {},
    });
    const host: RuntimeSystemKernelHost = {
      registerCommitRef: (input) => ({ ...input, createdAt: 1 }),
      getDeliveryProjection: () => null,
      listDeliveryProjections: () => [],
      queryAttentionDeliveryTimeline: () => ({ dispatches: [], receipts: [] }),
      signalIngress: () => {},
      commitIngress: async (input) => {
        committed.push(input);
        return null;
      },
    };

    adapter.commitLifecycleIngress({
      terminalId: "iflow",
      contextId: "ctx-terminal-iflow",
      event: "terminal_idle_ready",
      summary: "Terminal iflow is ready for your input.",
      ingressType: "push",
      score: 100,
    });
    adapter.mount(host);
    await adapter.bootstrap();

    expect(committed).toEqual([]);
  });

  test("Scenario: Given terminal lifecycle ingress carries a boundary channel When adapter commits it Then the envelope preserves that channel", async () => {
    const committed: RuntimeSystemIngressEnvelope[] = [];
    const adapter = new RuntimeTerminalKernelAdapter({
      isLoopPaused: () => false,
      listFocusedTerminalIds: () => [],
      isTerminalRunning: () => false,
      getTerminalStatus: () => null,
      getTerminalContextId: (terminalId) => `ctx-terminal-${terminalId}`,
      isTerminalActionable: () => false,
      readTerminalIngress: async () => null,
      buildLifecycleIngressEnvelope: (input) => ({
        system: "terminal",
        boundaryChannel: input.boundaryChannel ?? "scheduler_signal",
        sourceId: `tty:${input.terminalId}`,
        contextKey: input.contextId,
        kind: input.event,
        summary: input.summary,
        content: input.summary,
        format: "text/plain",
        score: input.score ?? 0,
        tags: ["terminal", "lifecycle", input.event],
        createdAt: 1,
        author: "avatar",
      }),
      onTerminalActionableSignal: () => {},
    });
    const host: RuntimeSystemKernelHost = {
      registerCommitRef: (input) => ({ ...input, createdAt: 1 }),
      getDeliveryProjection: () => null,
      listDeliveryProjections: () => [],
      queryAttentionDeliveryTimeline: () => ({ dispatches: [], receipts: [] }),
      signalIngress: () => {},
      commitIngress: async (input) => {
        committed.push(input);
        return null;
      },
    };
    adapter.mount(host);

    adapter.commitLifecycleIngress({
      terminalId: "iflow",
      contextId: "ctx-terminal-iflow",
      event: "terminal_killed",
      summary: "Terminal iflow was killed",
      boundaryChannel: "world_fact",
    });
    await adapter.bootstrap();

    expect(committed).toHaveLength(1);
    expect(committed[0]?.boundaryChannel).toBe("world_fact");
  });
});
