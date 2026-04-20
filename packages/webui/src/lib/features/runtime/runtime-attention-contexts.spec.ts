import type { MessageChannelEntry, RuntimeAttentionState, RuntimeSchedulerState } from "@agenter/client-sdk";
import { describe, expect, test } from "vitest";

import {
  buildRuntimeAttentionContextItems,
  buildRuntimeSchedulerSignals,
  resolveRuntimeContextJumpTarget,
  type RuntimeContextTerminal,
} from "./runtime-attention-contexts";

const createCommit = (input: {
  commitId: string;
  contextId: string;
  summary: string;
  createdAt: string;
  source: string;
}): RuntimeAttentionState["active"][number]["recentCommits"][number] => ({
  commitId: input.commitId,
  contextId: input.contextId,
  ingressType: "commit",
  parentCommitIds: [],
  meta: {
    author: "system",
    source: input.source,
  },
  scores: {},
  summary: input.summary,
  change: {
    type: "update",
    value: input.summary,
  },
  createdAt: input.createdAt,
});

const createContextState = (input: {
  contextId: string;
  owner: string;
  updatedAt: string;
  scoreMap?: Record<string, number>;
}): RuntimeAttentionState["active"][number]["context"] => ({
  contextId: input.contextId,
  owner: input.owner,
  focusState: "focused",
  content: "",
  headCommitId: null,
  createdAt: input.updatedAt,
  updatedAt: input.updatedAt,
  scoreMap: input.scoreMap ?? {},
  consumedPushCommitIds: [],
});

const createSnapshotContext = (input: {
  contextId: string;
  owner: string;
  updatedAt: string;
  commits?: RuntimeAttentionState["snapshot"]["contexts"][number]["commits"];
  commitCount?: number;
  commitsTruncated?: boolean;
  scoreMap?: Record<string, number>;
}): RuntimeAttentionState["snapshot"]["contexts"][number] => ({
  ...createContextState(input),
  commits: input.commits ?? [],
  commitCount: input.commitCount,
  commitsTruncated: input.commitsTruncated,
});

const createAttentionState = (input?: {
  active?: RuntimeAttentionState["active"];
  snapshotContexts?: RuntimeAttentionState["snapshot"]["contexts"];
}): RuntimeAttentionState => ({
  snapshot: {
    contexts: input?.snapshotContexts ?? [],
  },
  active: input?.active ?? [],
  cycleFrames: [],
  hooks: [],
});

const createSchedulerState = (overrides?: Partial<RuntimeSchedulerState>): RuntimeSchedulerState => ({
  schemaVersion: 2,
  stateVersion: 1,
  running: false,
  paused: false,
  runtimeStatus: "idle",
  phase: "stopped",
  gate: "open",
  queueSize: 0,
  cycle: 0,
  sentBatches: 0,
  updatedAt: 0,
  lastMessageAt: null,
  lastResponseAt: null,
  lastWakeAt: null,
  lastWakeSource: null,
  lastWakeCause: null,
  activeContextCount: 0,
  activeItemCount: 0,
  unresolvedScoreCount: 0,
  waitingReason: null,
  nextAutoWakeAt: null,
  backoffMs: null,
  retryCount: 0,
  blockedReason: null,
  lastProgressAt: null,
  lastError: null,
  ...overrides,
});

const channels = [
  {
    chatId: "room-alpha",
    kind: "room",
    title: "Alpha room",
    owner: "message-system",
    contextId: "ctx-room-alpha",
    participants: [],
    metadata: {},
    createdAt: 0,
    updatedAt: 0,
    focused: true,
    accessRole: "admin",
    accessToken: "room-alpha-token",
  } satisfies MessageChannelEntry,
] as const;

const terminals = [
  {
    terminalId: "terminal-1",
    title: "Main shell",
    cwd: "/repo/app",
  } satisfies RuntimeContextTerminal,
] as const;

describe("Feature: Runtime attention helper contract", () => {
  test("Scenario: Given a room or terminal attention context When resolving jump targets Then the helper maps them to stable global routes", () => {
    expect(resolveRuntimeContextJumpTarget("ctx-room-alpha", channels, terminals)).toEqual({
      kind: "room",
      targetId: "room-alpha",
      label: "Alpha room",
      actionLabel: "Open",
    });

    expect(resolveRuntimeContextJumpTarget("ctx-terminal-terminal-1", channels, terminals)).toEqual({
      kind: "terminal",
      targetId: "terminal-1",
      label: "Main shell",
      actionLabel: "Jump",
    });
  });

  test("Scenario: Given active attention contexts When building the list Then actionable room and terminal items stay ahead of internal contexts", () => {
    const attention = createAttentionState({
      active: [
        {
          contextId: "ctx-task-index",
          context: createContextState({
            contextId: "ctx-task-index",
            owner: "tasks",
            updatedAt: "2026-04-06T10:00:00.000Z",
            scoreMap: {
              stale: 2,
            },
          }),
          recentCommits: [
            createCommit({
              commitId: "commit-task",
              contextId: "ctx-task-index",
              summary: "Task graph refreshed",
              createdAt: "2026-04-06T10:00:00.000Z",
              source: "task",
            }),
          ],
        },
        {
          contextId: "ctx-terminal-terminal-1",
          context: createContextState({
            contextId: "ctx-terminal-terminal-1",
            owner: "terminal",
            updatedAt: "2026-04-06T09:00:00.000Z",
            scoreMap: {
              terminal: 3,
            },
          }),
          recentCommits: [
            createCommit({
              commitId: "commit-terminal",
              contextId: "ctx-terminal-terminal-1",
              summary: "Shell output changed",
              createdAt: "2026-04-06T09:00:00.000Z",
              source: "terminal",
            }),
          ],
        },
        {
          contextId: "ctx-room-alpha",
          context: createContextState({
            contextId: "ctx-room-alpha",
            owner: "messages",
            updatedAt: "2026-04-06T08:00:00.000Z",
            scoreMap: {
              room: 8,
            },
          }),
          recentCommits: [
            createCommit({
              commitId: "commit-room-1",
              contextId: "ctx-room-alpha",
              summary: "Room summary updated",
              createdAt: "2026-04-06T08:00:00.000Z",
              source: "chat",
            }),
            createCommit({
              commitId: "commit-room-2",
              contextId: "ctx-room-alpha",
              summary: "Operator reply queued",
              createdAt: "2026-04-06T08:05:00.000Z",
              source: "chat",
            }),
          ],
        },
      ],
    });

    const items = buildRuntimeAttentionContextItems({
      attention,
      channels,
      terminals,
    });

    expect(items.map((item) => item.contextId)).toEqual([
      "ctx-room-alpha",
      "ctx-terminal-terminal-1",
      "ctx-task-index",
    ]);
    expect(items.map((item) => item.jumpTarget?.kind ?? null)).toEqual(["room", "terminal", null]);
    expect(items[0]?.commitLabel).toBe("2 recent");
    expect(items[0]?.scores.map((score) => score.key)).toEqual(["room"]);
    expect(items[0]?.recentCommits.map((commit) => commit.commitId)).toEqual(["commit-room-2", "commit-room-1"]);
  });

  test("Scenario: Given no active contexts but tracked snapshot contexts When building the list Then tracked items still expose details and jump actions", () => {
    const attention = createAttentionState({
      snapshotContexts: [
        createSnapshotContext({
          contextId: "ctx-room-alpha",
          owner: "messages",
          updatedAt: "2026-04-06T07:00:00.000Z",
          commitCount: 9,
          commitsTruncated: true,
          scoreMap: {
            room: 4,
          },
          commits: [
            createCommit({
              commitId: "commit-room-snapshot",
              contextId: "ctx-room-alpha",
              summary: "Tracked room snapshot",
              createdAt: "2026-04-06T07:00:00.000Z",
              source: "chat",
            }),
          ],
        }),
      ],
    });

    const items = buildRuntimeAttentionContextItems({
      attention,
      channels,
      terminals,
    });

    expect(items).toHaveLength(1);
    expect(items[0]?.source).toBe("tracked");
    expect(items[0]?.commitLabel).toBe("9 commits");
    expect(items[0]?.commitsTruncated).toBe(true);
    expect(items[0]?.jumpTarget?.targetId).toBe("room-alpha");
  });

  test("Scenario: Given scheduler facts When building compact chips Then idle noise disappears and only actionable signals remain", () => {
    expect(
      buildRuntimeSchedulerSignals({
        schedulerPhase: "idle",
        schedulerState: createSchedulerState(),
      }),
    ).toEqual([]);

    expect(
      buildRuntimeSchedulerSignals({
        schedulerPhase: "collecting_inputs",
        schedulerState: createSchedulerState({
          waitingReason: "attention_backoff",
          unresolvedScoreCount: 3,
          retryCount: 2,
          backoffMs: 1200,
        }),
      }).map((signal) => signal.id),
    ).toEqual(["phase", "waiting", "unresolved", "retries", "backoff"]);
  });

  test("Scenario: Given scheduler containment is blocked When building compact chips Then the blocked reason is surfaced as an explicit destructive signal", () => {
    expect(
      buildRuntimeSchedulerSignals({
        schedulerPhase: "waiting_commits",
        schedulerState: createSchedulerState({
          runtimeStatus: "blocked",
          waitingReason: "attention_blocked",
          blockedReason: "retry policy max attempts reached (2/2)",
        }),
      }),
    ).toEqual([
      {
        id: "phase",
        label: "Phase: waiting_commits",
        variant: "destructive",
      },
      {
        id: "waiting",
        label: "Waiting: attention_blocked",
        variant: "outline",
      },
      {
        id: "blocked",
        label: "Blocked: retry policy max attempts reached (2/2)",
        variant: "destructive",
      },
    ]);
  });
});
