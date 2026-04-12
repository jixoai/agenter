import type { RuntimeAttentionState, SessionNotificationItem } from "@agenter/client-sdk";
import { describe, expect, test } from "vitest";

import type { RuntimeAttentionContextItem } from "./runtime-attention-contexts";
import {
  buildRuntimeAttentionQueueItems,
  buildRuntimeAttentionScoreSummary,
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
  systemId: "message",
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
  sourceType: "chat",
  sourceId: "room-alpha",
  attentionContextId: "ctx-room-alpha",
  attentionCommitId: "commit-1",
  chatId: "room-alpha",
  workspacePath: "/repo/app",
  sessionName: "alpha",
  messageId: "11",
  messageSeq: 11,
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
        systemId: "terminal",
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
          sourceType: "terminal",
          sourceId: "terminal-main",
          terminalId: "terminal-main",
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
          sourceType: "terminal",
          sourceId: "terminal-main",
          terminalId: "terminal-main",
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
});
