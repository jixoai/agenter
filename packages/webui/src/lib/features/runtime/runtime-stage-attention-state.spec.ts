import type { RuntimeAttentionState, SessionNotificationItem } from "@agenter/client-sdk";
import { describe, expect, test } from "vitest";

import type { RuntimeAttentionContextItem } from "./runtime-attention-contexts";
import {
  buildRuntimeAttentionEffectItems,
  buildRuntimeAttentionQueueItems,
  buildRuntimeAttentionScoreSummary,
  buildRuntimeAttentionWatchItems,
  filterRuntimeAttentionContextItems,
  filterRuntimeAttentionHooks,
  filterRuntimeAttentionQueueItems,
} from "./runtime-stage-attention-state";

const createContextItem = (overrides?: Partial<RuntimeAttentionContextItem>): RuntimeAttentionContextItem => ({
  contextId: "ctx-room-alpha",
  source: "active",
  label: "Alpha room",
  owner: "message",
  updatedAt: "2026-04-09T08:00:00.000Z",
  commitLabel: "2 recent",
  recentCommits: [
    {
      commitId: "commit-1",
      summary: "Operator reply queued",
      createdAt: "2026-04-09T08:00:00.000Z",
      source: "chat",
    },
  ],
  commitsTruncated: false,
  scores: [
    { key: "room", value: 8 },
    { key: "stale", value: 3 },
    { key: "terminal", value: 1 },
  ],
  jumpTarget: null,
  ...overrides,
});

const createHook = (
  overrides?: Partial<RuntimeAttentionState["hooks"][number]>,
): RuntimeAttentionState["hooks"][number] => ({
  id: "hook-1",
  cycleId: 1,
  hookId: "builtin-message-bridge",
  bridgeId: "message",
  contextId: "ctx-room-alpha",
  commitId: "commit-1",
  status: "failed",
  createdAt: 1,
  error: "credential invalid",
  ...overrides,
});

const createNotification = (overrides?: Partial<SessionNotificationItem>): SessionNotificationItem => ({
  id: "notification-1",
  sessionId: "session-alpha",
  src: "msg:room-alpha/11",
  sourceNamespace: "msg",
  sourceId: "room-alpha",
  bucketKey: "msg:room-alpha",
  attentionContextId: "ctx-room-alpha",
  attentionCommitId: "commit-1",
  workspacePath: "/repo/app",
  sessionName: "alpha",
  content: "Operator reply queued",
  timestamp: Date.parse("2026-04-09T08:05:00.000Z"),
  ...overrides,
});

describe("Feature: Runtime attention stage state contract", () => {
  test("Scenario: Given positive scores When building the collapsed summary Then the strongest scores stay visible and overflow stays countable", () => {
    expect(
      buildRuntimeAttentionScoreSummary([
        { key: "room", value: 8 },
        { key: "stale", value: 3 },
        { key: "terminal", value: 1 },
      ]),
    ).toEqual({
      activeCount: 3,
      maxScore: 8,
      totalScore: 12,
      previewEntries: [
        { key: "room", value: 8 },
        { key: "stale", value: 3 },
      ],
      overflowCount: 1,
    });
  });

  test("Scenario: Given a local attention query When filtering contexts Then label owner score keys and recent commit summaries are all searchable", () => {
    const items = [
      createContextItem(),
      createContextItem({
        contextId: "ctx-terminal-main",
        label: "Main shell",
        owner: "terminal",
        scores: [{ key: "stdout", value: 2 }],
        recentCommits: [
          {
            commitId: "commit-2",
            summary: "Build failed",
            createdAt: "2026-04-09T08:01:00.000Z",
            source: "terminal",
          },
        ],
      }),
    ];

    expect(filterRuntimeAttentionContextItems(items, "stale").map((item) => item.contextId)).toEqual([
      "ctx-room-alpha",
    ]);
    expect(filterRuntimeAttentionContextItems(items, "build failed").map((item) => item.contextId)).toEqual([
      "ctx-terminal-main",
    ]);
    expect(filterRuntimeAttentionContextItems(items, "terminal").map((item) => item.contextId)).toEqual([
      "ctx-room-alpha",
      "ctx-terminal-main",
    ]);
  });

  test("Scenario: Given attention hook history When filtering hooks Then system status identifiers and error text all participate in search", () => {
    const hooks = [
      createHook(),
      createHook({
        id: "hook-2",
        hookId: "builtin-terminal-bridge",
        bridgeId: "terminal",
        status: "delivered",
        error: undefined,
      }),
    ];

    expect(filterRuntimeAttentionHooks(hooks, "credential").map((hook) => hook.id)).toEqual(["hook-1"]);
    expect(filterRuntimeAttentionHooks(hooks, "terminal").map((hook) => hook.id)).toEqual(["hook-2"]);
    expect(filterRuntimeAttentionHooks(hooks, "delivered").map((hook) => hook.id)).toEqual(["hook-2"]);
  });

  test("Scenario: Given unread push notifications When building the queued inbox Then labels reuse context metadata and newest items stay first", () => {
    const items = [
      createContextItem(),
      createContextItem({
        contextId: "ctx-terminal-main",
        label: "Main shell",
      }),
    ];

    const queue = buildRuntimeAttentionQueueItems(
      [
        createNotification(),
        createNotification({
          id: "notification-2",
          attentionContextId: "ctx-terminal-main",
          src: "tty:terminal-main/42",
          sourceNamespace: "tty",
          sourceId: "terminal-main",
          bucketKey: "tty:terminal-main",
          content: "Build failed",
          timestamp: Date.parse("2026-04-09T08:06:00.000Z"),
        }),
      ],
      items,
    );

    expect(queue.map((item) => item.id)).toEqual(["notification-2", "notification-1"]);
    expect(queue.map((item) => item.label)).toEqual(["Main shell", "Alpha room"]);
    expect(queue[0]?.sourceType).toBe("terminal");
  });

  test("Scenario: Given a local inbox query When filtering queued pushes Then source ids context ids labels and message text all participate in search", () => {
    const queue = buildRuntimeAttentionQueueItems(
      [
        createNotification(),
        createNotification({
          id: "notification-2",
          attentionContextId: "ctx-terminal-main",
          src: "tty:terminal-main/42",
          sourceNamespace: "tty",
          sourceId: "terminal-main",
          bucketKey: "tty:terminal-main",
          content: "Build failed",
        }),
      ],
      [
        createContextItem(),
        createContextItem({
          contextId: "ctx-terminal-main",
          label: "Main shell",
        }),
      ],
    );

    expect(filterRuntimeAttentionQueueItems(queue, "build failed").map((item) => item.id)).toEqual([
      "notification-2",
    ]);
    expect(filterRuntimeAttentionQueueItems(queue, "room-alpha").map((item) => item.id)).toEqual([
      "notification-1",
    ]);
    expect(filterRuntimeAttentionQueueItems(queue, "main shell").map((item) => item.id)).toEqual([
      "notification-2",
    ]);
  });

  test("Scenario: Given delivery effects for one selected context When building explicit effects Then only causally linked room effects stay visible in recency order", () => {
    const effects = buildRuntimeAttentionEffectItems({
      contextId: "ctx-room-alpha",
      delivery: {
        projections: [
          {
            contextId: "ctx-room-alpha",
            commitId: "commit-1",
            state: "completed",
            attemptCount: 1,
            latestDispatchId: "dispatch-1",
            latestReceiptId: "receipt-1",
            agentCallId: "agent-call-1",
            sessionModelCallId: 91,
            firstAcceptedAt: 1700000000001,
            latestReceiptAt: 1700000000002,
            latestError: null,
          },
        ],
        dispatches: [
          {
            dispatchId: "dispatch-1",
            contextId: "ctx-room-alpha",
            commitId: "commit-1",
            cycleId: 8,
            attemptIndex: 1,
            agentCallId: "agent-call-1",
            sessionModelCallId: 91,
            createdAt: 1700000000000,
          },
        ],
        receipts: [
          {
            receiptId: "receipt-1",
            dispatchId: "dispatch-1",
            contextId: "ctx-room-alpha",
            commitId: "commit-1",
            cycleId: 8,
            attemptIndex: 1,
            agentCallId: "agent-call-1",
            sessionModelCallId: 91,
            status: "completed",
            providerEventKind: "run_finished",
            timestamp: 1700000000201,
          },
        ],
        watches: [],
        effects: [
          {
            id: 2,
            effectId: "effect-2",
            actionId: "action-2",
            actionKind: "message_send",
            actorId: "assistant",
            cycleId: 8,
            sessionModelCallId: 91,
            target: "room:room-alpha",
            effectKind: "message_row_created",
            effectRecordId: "room-alpha/13",
            timestamp: 1700000000200,
            meta: { chatId: "room-alpha", messageId: 13, contextId: "ctx-room-alpha", commitId: "commit-1" },
          },
          {
            id: 1,
            effectId: "effect-1",
            actionId: "action-1",
            actionKind: "message_send",
            actorId: "assistant",
            cycleId: 8,
            sessionModelCallId: 91,
            target: "room:room-alpha",
            effectKind: "message_row_created",
            effectRecordId: "room-alpha/12",
            timestamp: 1700000000100,
            meta: { chatId: "room-alpha", messageId: 12, contextId: "ctx-room-alpha", commitId: "commit-1" },
          },
          {
            id: 3,
            effectId: "effect-3",
            actionId: "action-3",
            actionKind: "watch_remind",
            actorId: "assistant",
            cycleId: null,
            sessionModelCallId: null,
            target: "watch:watch-1",
            effectKind: "watch_due_marked",
            effectRecordId: "watch-1",
            timestamp: 1700000000300,
            meta: { contextId: "ctx-room-alpha", commitId: "commit-1" },
          },
          {
            id: 4,
            effectId: "effect-4",
            actionId: "action-4",
            actionKind: "message_send",
            actorId: "assistant",
            cycleId: 9,
            sessionModelCallId: 92,
            target: "room:room-beta",
            effectKind: "message_row_created",
            effectRecordId: "room-beta/1",
            timestamp: 1700000000400,
            meta: { chatId: "room-beta", messageId: 1, contextId: "ctx-room-beta", commitId: "commit-2" },
          },
        ],
      },
    });

    expect(effects.map((effect) => effect.effectId)).toEqual(["effect-2", "effect-1"]);
    expect(effects[0]).toEqual(
      expect.objectContaining({
        target: "room:room-alpha",
        actionKind: "message_send",
        effectKind: "message_row_created",
      }),
    );
  });

  test("Scenario: Given watches bound to one room context When building watch items Then pending, satisfied, and expired lifecycle records stay visible without depending on reminder identity", () => {
    const watches = buildRuntimeAttentionWatchItems({
      contextId: "ctx-room-alpha",
      delivery: {
        projections: [],
        dispatches: [],
        receipts: [],
        effects: [],
        watches: [
          {
            id: 1,
            watchId: "watch-1",
            ownerActionId: "action-1",
            ownerActionKind: "message_send",
            ownerActorId: "assistant",
            ownerCycleId: 8,
            ownerSessionModelCallId: 91,
            target: "room:room-alpha",
            predicate: {
              kind: "message_latest_visible",
              chatId: "room-alpha",
              anchorMessageId: 13,
            },
            dueAt: 1700000000100,
            status: "expired",
            createdAt: 1700000000000,
            updatedAt: 1700000000100,
            resolvedAt: 1700000000200,
            reminderContextId: "ctx-room-alpha",
            reminderCommitId: "commit-reminder-1",
            meta: {},
          },
          {
            id: 2,
            watchId: "watch-2",
            ownerActionId: "action-2",
            ownerActionKind: "message_send",
            ownerActorId: "assistant",
            ownerCycleId: 9,
            ownerSessionModelCallId: 92,
            target: "room:room-beta",
            predicate: {
              kind: "message_latest_visible",
              chatId: "room-beta",
              anchorMessageId: 2,
            },
            dueAt: 1700000000300,
            status: "pending",
            createdAt: 1700000000000,
            updatedAt: 1700000000300,
            resolvedAt: null,
            reminderContextId: "ctx-room-beta",
            reminderCommitId: null,
            meta: {},
          },
          {
            id: 3,
            watchId: "watch-3",
            ownerActionId: "action-3",
            ownerActionKind: "message_send",
            ownerActorId: "assistant",
            ownerCycleId: 10,
            ownerSessionModelCallId: 93,
            target: "room:room-alpha",
            predicate: {
              kind: "message_latest_visible",
              chatId: "room-alpha",
              anchorMessageId: 14,
            },
            dueAt: 1700000000200,
            status: "pending",
            createdAt: 1700000000000,
            updatedAt: 1700000000200,
            resolvedAt: null,
            reminderContextId: null,
            reminderCommitId: null,
            meta: {},
          },
          {
            id: 4,
            watchId: "watch-4",
            ownerActionId: "action-4",
            ownerActionKind: "message_send",
            ownerActorId: "assistant",
            ownerCycleId: 11,
            ownerSessionModelCallId: 94,
            target: "room:room-alpha",
            predicate: {
              kind: "message_latest_visible",
              chatId: "room-alpha",
              anchorMessageId: 15,
            },
            dueAt: 1700000000250,
            status: "satisfied",
            createdAt: 1700000000000,
            updatedAt: 1700000000250,
            resolvedAt: 1700000000260,
            reminderContextId: null,
            reminderCommitId: null,
            meta: {},
          },
        ],
      },
    });

    expect(watches.map((watch) => watch.watchId)).toEqual(["watch-1", "watch-3", "watch-4"]);
    expect(watches).toEqual([
      expect.objectContaining({
        watchId: "watch-1",
        ownerActionKind: "message_send",
        target: "room:room-alpha",
        status: "expired",
        predicateKind: "message_latest_visible",
        predicateLabel: "room-alpha#13",
      }),
      expect.objectContaining({
        watchId: "watch-3",
        target: "room:room-alpha",
        status: "pending",
        reminderContextId: null,
        predicateLabel: "room-alpha#14",
      }),
      expect.objectContaining({
        watchId: "watch-4",
        target: "room:room-alpha",
        status: "satisfied",
        reminderContextId: null,
        predicateLabel: "room-alpha#15",
      }),
    ]);
  });
});
