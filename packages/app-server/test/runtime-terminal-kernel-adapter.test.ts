import { describe, expect, test } from "bun:test";

import { RuntimeTerminalKernelAdapter } from "../src/runtime-system-kernel-adapters/terminal-adapter";
import type { RuntimeSystemIngressEnvelope, RuntimeSystemKernelHost } from "../src/runtime-system-kernel-adapters/types";

const terminalEnvelope = (input: Partial<RuntimeSystemIngressEnvelope> = {}): RuntimeSystemIngressEnvelope => ({
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
  ...input,
});

const lifecycleEnvelope = (input: {
  terminalId: string;
  contextId: string;
  event: string;
  summary: string;
  score?: number;
  boundaryChannel?: RuntimeSystemIngressEnvelope["boundaryChannel"];
}): RuntimeSystemIngressEnvelope => ({
  system: "terminal",
  boundaryChannel: input.boundaryChannel ?? "scheduler_signal",
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
});

const createRecordingHost = (
  committed: Array<{ envelope: RuntimeSystemIngressEnvelope; notifyLoop: boolean | undefined }>,
): RuntimeSystemKernelHost => ({
  registerCommitRef: (input) => ({ ...input, createdAt: 1 }),
  getDeliveryProjection: () => null,
  listDeliveryProjections: () => [],
  queryAttentionDeliveryTimeline: () => ({ dispatches: [], receipts: [] }),
  signalIngress: () => {},
  commitIngress: async (envelope, input) => {
    committed.push({ envelope, notifyLoop: input?.notifyLoop });
    return {
      contextId: envelope.contextKey,
      commit: {
        commitId: `commit-${committed.length}`,
        contextId: envelope.contextKey,
        ingressType: envelope.ingressType ?? "commit",
        contextMutation: envelope.contextMutation ?? "preserve",
        parentCommitIds: [],
        meta: {
          author: envelope.author,
          source: envelope.system,
          src: envelope.sourceId,
          tags: envelope.tags,
          createdAt: new Date(envelope.createdAt).toISOString(),
        },
        scores: { test: envelope.score ?? 0 },
        summary: envelope.summary,
        change: {
          type: "update",
          value: envelope.content,
          format: envelope.format,
        },
        createdAt: new Date(envelope.createdAt).toISOString(),
      },
    };
  },
});

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
      getTerminalHeadHash: () => null,
      getTerminalReadCursorHash: () => null,
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
      getTerminalHeadHash: () => null,
      getTerminalReadCursorHash: () => null,
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
      getTerminalHeadHash: () => null,
      getTerminalReadCursorHash: () => null,
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
      getTerminalHeadHash: () => null,
      getTerminalReadCursorHash: () => null,
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

  test("Scenario: Given terminal HEAD equals read cursor When focused terminal becomes idle Then no read or attention commit occurs", async () => {
    const committed: Array<{ envelope: RuntimeSystemIngressEnvelope; notifyLoop: boolean | undefined }> = [];
    const signals: string[] = [];
    const reads: string[] = [];
    const adapter = new RuntimeTerminalKernelAdapter({
      isLoopPaused: () => false,
      listFocusedTerminalIds: () => ["iflow"],
      isTerminalRunning: () => true,
      getTerminalStatus: () => "IDLE",
      getTerminalHeadHash: () => "hash-2",
      getTerminalReadCursorHash: () => "hash-2",
      getTerminalContextId: (terminalId) => `ctx-terminal-${terminalId}`,
      isTerminalActionable: () => true,
      readTerminalIngress: async (terminalId) => {
        reads.push(terminalId);
        return terminalEnvelope();
      },
      buildLifecycleIngressEnvelope: lifecycleEnvelope,
      onTerminalActionableSignal: ({ terminalId, reason }) => {
        signals.push(`${terminalId}:${reason}`);
      },
    });
    adapter.mount(createRecordingHost(committed));

    await adapter.handleStatusChange({
      terminalId: "iflow",
      previousStatus: "BUSY",
      running: true,
      status: "IDLE",
    });

    expect(reads).toEqual([]);
    expect(committed).toEqual([]);
    expect(signals).toEqual([]);
  });

  test("Scenario: Given terminal HEAD is ahead of read cursor When focused terminal becomes idle Then one wakeable terminal fact is committed", async () => {
    const committed: Array<{ envelope: RuntimeSystemIngressEnvelope; notifyLoop: boolean | undefined }> = [];
    const reads: string[] = [];
    const adapter = new RuntimeTerminalKernelAdapter({
      isLoopPaused: () => false,
      listFocusedTerminalIds: () => ["iflow"],
      isTerminalRunning: () => true,
      getTerminalStatus: () => "BUSY",
      getTerminalHeadHash: () => "hash-2",
      getTerminalReadCursorHash: () => "hash-1",
      getTerminalContextId: (terminalId) => `ctx-terminal-${terminalId}`,
      isTerminalActionable: () => true,
      readTerminalIngress: async (terminalId) => {
        reads.push(terminalId);
        return terminalEnvelope({
          kind: "terminal_diff",
          summary: "Terminal iflow diff updated",
          content: "+raw line",
          changeType: "diff",
          meta: {
            terminalId,
            fromHash: "hash-1",
            toHash: "hash-2",
          },
        });
      },
      buildLifecycleIngressEnvelope: lifecycleEnvelope,
      onTerminalActionableSignal: () => {},
    });
    adapter.mount(createRecordingHost(committed));
    adapter.markTerminalDirty("iflow");

    await adapter.handleStatusChange({
      terminalId: "iflow",
      previousStatus: "BUSY",
      running: true,
      status: "IDLE",
    });

    expect(reads).toEqual(["iflow"]);
    expect(committed).toHaveLength(1);
    expect(committed[0]?.notifyLoop).toBeTrue();
    expect(committed[0]?.envelope.score).toBe(100);
    expect(committed[0]?.envelope.ingressType).toBe("commit");
    expect(committed[0]?.envelope.tags).toContain("idle-unread");
    expect(adapter.hasFocusedDirtyWork()).toBeFalse();
  });

  test("Scenario: Given raw PTY output advances HEAD without terminal_write When focused terminal becomes idle Then idle bridge still reads", async () => {
    const committed: Array<{ envelope: RuntimeSystemIngressEnvelope; notifyLoop: boolean | undefined }> = [];
    const reads: string[] = [];
    const adapter = new RuntimeTerminalKernelAdapter({
      isLoopPaused: () => false,
      listFocusedTerminalIds: () => ["iflow"],
      isTerminalRunning: () => true,
      getTerminalStatus: () => "IDLE",
      getTerminalHeadHash: () => "raw-head",
      getTerminalReadCursorHash: () => null,
      getTerminalContextId: (terminalId) => `ctx-terminal-${terminalId}`,
      isTerminalActionable: () => true,
      readTerminalIngress: async (terminalId) => {
        reads.push(terminalId);
        return terminalEnvelope({
          sourceId: `tty:${terminalId}`,
          content: "typed raw transport",
          meta: {
            terminalId,
            transport: "inputBytes",
          },
        });
      },
      buildLifecycleIngressEnvelope: lifecycleEnvelope,
      onTerminalActionableSignal: () => {},
    });
    adapter.mount(createRecordingHost(committed));

    await adapter.handleStatusChange({
      terminalId: "iflow",
      previousStatus: "BUSY",
      running: true,
      status: "IDLE",
    });

    expect(reads).toEqual(["iflow"]);
    expect(committed).toHaveLength(1);
    expect(committed[0]?.envelope.content).toContain("typed raw transport");
  });
});
