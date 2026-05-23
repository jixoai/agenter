import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { privateKeyToAccount } from "viem/accounts";
import { parse as parseYaml } from "yaml";

import {
  AttentionSystem,
  type AttentionActiveContextMatch,
  type AttentionCommit,
  type AttentionCommitChange,
  type AttentionCommitMeta,
} from "@agenter/attention-system";
import {
  MessageControlPlane,
  resolveMessageControlDbPath,
  type MessageActorId,
  type MessageRecord,
} from "@agenter/message-system";
import { SessionDb } from "@agenter/session-system";
import { TerminalControlPlane, type TerminalActorId } from "@agenter/terminal-system";
import {
  formatMessageAttentionSrc,
  formatTerminalAttentionSrc,
  parseMessageAttentionSrc,
  parseTerminalAttentionSrc,
} from "../src/attention-src";
import { AttentionSearchEngine } from "../src/attention-search";
import type { LoopBusInput } from "../src/loop-bus";
import { LoopBusPluginRuntime, type AttentionDraft, type LoopBusPlugin } from "../src/loopbus-plugin-runtime";
import type { AssistantDeliveryEvent, AssistantStreamUpdate } from "../src/model-client";
import type { RuntimeSkillSystem } from "../src/runtime-skill-system";
import type { RuntimeMessageSendResult, RuntimeReachableParticipantView } from "../src/runtime-tool-views";
import { resolveSessionRoomActorId } from "../src/session-chat-projection";
import { SessionRuntime } from "../src/session-runtime";

interface RuntimeMessageSnapshotView {
  snapshot: (
    chatId: string,
    limit?: number,
  ) => {
    items: Array<{
      content: string;
      ref?: number;
      metadata?: Record<string, unknown>;
    }>;
  };
  queryMessages: (input: { chatId: string; limit?: number }) => {
    items: MessageRecord[];
  };
}

interface RuntimeInternal {
  agent: { requestCompact: (reason?: string) => void } | null;
  attentionSystem: AttentionSystem;
  messageSystem: RuntimeMessageSnapshotView;
  taskEngine: {
    create: (input: {
      source: string;
      id?: string;
      title: string;
      body?: string;
      status?: "backlog" | "pending" | "ready" | "running" | "done" | "failed" | "canceled";
      triggers?: Array<{ type: "at"; at: string }>;
    }) => unknown;
  };
  collectLoopInputs: () => Promise<LoopBusInput[] | undefined>;
  commitInterleavedAttentionItems: () => Promise<LoopBusInput[] | undefined>;
  collectAttentionInputs: () => LoopBusInput[] | undefined;
  hasUnreadRoomWork: () => boolean;
  collectUnreadRoomIngress: () => Promise<number>;
  waitForAnyInput: () => Promise<"user" | "terminal" | "task" | "attention">;
  notifyInput: (kind: "user" | "terminal" | "task" | "attention") => void;
  loopPluginRuntime: LoopBusPluginRuntime | null;
  createLoopPluginRuntime: () => Promise<LoopBusPluginRuntime>;
  createLoopPlugins: () => LoopBusPlugin[];
  execRootWorkspaceBash: (input: {
    command: string;
    cwd?: string;
    env?: Record<string, string>;
    stdin?: string;
  }) => Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
    cwd: string;
  }>;
  flushPluginAttentionDrafts: () => Promise<boolean>;
  commitAttentionDrafts: (drafts: AttentionDraft[]) => Promise<boolean>;
  persistCycle: (input: {
    wakeSource: "user" | "terminal" | "task" | "attention" | "unknown";
    inputs: LoopBusInput[];
  }) => Promise<{ cycleId: number }>;
  handleCommittedAttentionCommit: (
    contextId: string,
    commit: AttentionCommit,
    input: { notifyLoop: boolean },
  ) => Promise<void>;
  handleModelCall: (record: {
    id: string;
    timestamp: number;
    status: "running" | "done" | "error" | "cancelled";
    completedAt?: number;
    provider: string;
    model: string;
    request: unknown;
    response?: unknown;
    error?: unknown;
    outcome?: {
      code: "done" | "error" | "timeout" | "stopped" | "aborted" | "cancelled";
      message?: string;
      retryable?: boolean;
      error?: unknown;
      reason?: string;
    };
  }) => Promise<void>;
  upsertTraceRow: (input: {
    cycleId: number;
    traceId: string;
    spanId: string;
    parentSpanId?: string | null;
    kind: string;
    name: string;
    status: "running" | "done" | "error" | "cancelled";
    startedAt: number;
    endedAt: number;
    refs: Array<{ kind: string; ref: string }>;
    links: Array<{ kind: string; traceId?: string; spanId?: string }>;
    events: Array<{ id: string; name: string; timestamp: number }>;
    attributes: Record<string, unknown>;
    outcome?: {
      code: "done" | "error" | "timeout" | "stopped" | "aborted" | "cancelled";
      message?: string;
      retryable?: boolean;
      error?: unknown;
      reason?: string;
    };
  }) => unknown;
  listLoopbusTracesByRef: (
    ref: string,
    limit?: number,
  ) => Array<{
    kind: string;
    name: string;
    status: "running" | "done" | "error" | "cancelled";
    outcome?: {
      code: "done" | "error" | "timeout" | "stopped" | "aborted" | "cancelled";
    };
  }>;
  pageModelCalls: () => {
    items: Array<{
      id: number;
      status: "running" | "done" | "error" | "cancelled";
      outcome?: {
        code: "done" | "error" | "timeout" | "stopped" | "aborted" | "cancelled";
      };
    }>;
  };
  readTerminalRepresentation: (
    terminalId: string,
    input: { mode: "auto" | "diff" | "snapshot"; remark: boolean },
  ) => Promise<
    | {
        kind: "terminal-snapshot";
        representation: "snapshot";
        snapshot: {
          lines: string[];
        };
      }
    | {
        kind: "terminal-diff";
        representation: "diff";
        diff: string;
        fromHash: string | null;
        toHash: string | null;
      }
    | { ok: false; reason: string }
  >;
  readMessageChannelForTooling: (input: { chatId: string; limit?: number }) => Promise<{
    items: Array<{
      messageId: number;
      content: string;
      ref?: number;
    }>;
    referencedItems: Array<{
      messageId: number;
      content: string;
    }>;
    directory?: {
      visibleRooms: Array<{
        chatId: string;
        title: string;
        participantLabels: string[];
        focused: boolean;
      }>;
      reachableParticipants: Array<{
        label: string;
        rooms: Array<{
          chatId: string;
          title: string;
          participantLabels: string[];
          focused: boolean;
        }>;
      }>;
    };
  }>;
  config: {
    terminals?: Record<
      string,
      {
        terminalId: string;
        cwd: string;
        command: string[];
        commandLabel: string;
        gitLog?: false | "normal" | "verbose";
      }
    >;
  } | null;
  terminals: Map<
    string,
    {
      isRunning: () => boolean;
      getSnapshot: () => {
        seq: number;
        cols: number;
        rows: number;
        cursor: { x: number; y: number };
        lines: string[];
        scrollback: {
          viewportOffset: number;
          totalLines: number;
          screenLines: number;
        };
      };
      getStatus: () => "IDLE" | "BUSY";
      sliceDirty: (input: { fromHash?: string | null; wait?: boolean }) => Promise<{
        ok: boolean;
        changed: boolean;
        fromHash: string | null;
        toHash: string | null;
        diff: string;
        bytes: number;
      }>;
    }
  >;
  focusedTerminalIds: string[];
  terminalDirtyState: Record<string, boolean>;
  terminalLatestSeq: Record<string, number>;
  terminalReads: Record<string, { representation: string }>;
  attentionDebtBackoffMs: number;
  attentionContainment: Map<
    string,
    {
      retryCount: number;
      nextWakeAt: number;
    }
  >;
  dirtyAttentionContextIds: Set<string>;
  dirtyAttentionCommitIdsByContext: Map<string, Set<string>>;
  resolveCycleReplyChatId: (inputs: LoopBusInput[]) => string | null;
  inspectNotifyQuota: (input: {
    contextId: string;
    sourceId: string;
    focusState?: "focused" | "background" | "muted";
  }) => {
    quotaTarget: string;
    focusState: "focused" | "background" | "muted";
    effective: {
      windowKind: "period";
      windowMs: number | null;
    };
    remaining: {
      allowedNow: boolean;
      remainingSends: number | null;
      nextAllowedAt: number | null;
    };
    history: Array<{
      notifyId: string;
      contextId: string;
      commitId: string;
      sourceId: string;
      sentAt: number;
      windowMs: number;
    }>;
  };
}

interface RuntimeMessageEgressInternal extends RuntimeInternal {
  agent: {
    requestCompact: (reason?: string) => void;
  } | null;
  messageSystem: RuntimeMessageSnapshotView;
  sendMessageTool: (input: {
    chatId: string;
    content: string;
    ref?: number;
    from?: string;
    followUpAfterMs?: number;
  }) => Promise<RuntimeMessageSendResult>;
}

const createPrincipalId = (value: number): `0x${string}` => `0x${value.toString(16).padStart(40, "0")}`;
let nextRoomPrincipalSeed = 2;
const createRuntimeRoomAllocator = () => async (): Promise<string> => createPrincipalId(nextRoomPrincipalSeed++);

const PRIMARY_ROOM_ID = createPrincipalId(1);
const PRIMARY_CONTEXT_ID = `ctx-${PRIMARY_ROOM_ID}`;
const TEST_AVATAR_PRIVATE_KEY = "0x59c6995e998f97a5a0044966f094538c5f1b6f6db1d4c4a2a2d5f6b7c8d9e0f1";
const TEST_AVATAR_PRINCIPAL_ID = privateKeyToAccount(TEST_AVATAR_PRIVATE_KEY).address.toLowerCase();

const getActiveMatches = (internal: RuntimeInternal): AttentionActiveContextMatch[] =>
  internal.attentionSystem.listActiveContexts();

const getActiveCommits = (internal: RuntimeInternal): AttentionCommit[] =>
  getActiveMatches(internal).flatMap((match) => {
    const activeHashes = new Set(
      Object.entries(match.context.scoreMap)
        .filter(([, score]) => score >= 1)
        .map(([hash]) => hash),
    );
    return match.recentCommits.filter((commit) => Object.keys(commit.scores).some((hash) => activeHashes.has(hash)));
  });

const getActiveItems = (internal: RuntimeInternal) =>
  getActiveCommits(internal).map((commit) => ({
    id: commit.commitId,
    title: commit.summary,
    scores: commit.scores,
    detail:
      commit.change.type === "clean"
        ? undefined
        : {
            kind: commit.change.type === "diff" ? ("patch" as const) : ("replace" as const),
            value: commit.change.value,
            format: commit.change.format,
          },
    meta: commit.meta,
  }));

const getAttentionContextSnapshot = (internal: RuntimeInternal, contextId: string) =>
  internal.attentionSystem.snapshot().contexts.find((context) => context.contextId === contextId) ?? null;

const getBootstrapInput = (inputs: LoopBusInput[] | undefined): LoopBusInput | undefined =>
  inputs?.find((item) => item.meta?.attentionProtocolKind === "context");

const getAttentionProtocolKinds = (inputs: LoopBusInput[] | undefined): string[] =>
  inputs
    ?.map((item) => item.meta?.attentionProtocolKind)
    .filter((value): value is string => typeof value === "string") ?? [];

const createMessageSrc = (chatId: string, messageId: number) => formatMessageAttentionSrc({ chatId, messageId });

const createTerminalSrc = (terminalId: string, eventId?: number) => formatTerminalAttentionSrc({ terminalId, eventId });

const isMessageMetaForChat = (meta: AttentionCommitMeta, chatId: string): boolean =>
  parseMessageAttentionSrc(meta.src ?? "")?.chatId === chatId;

const isTerminalMeta = (meta: AttentionCommitMeta, terminalId?: string): boolean => {
  const parsed = parseTerminalAttentionSrc(meta.src ?? "");
  return terminalId ? parsed?.terminalId === terminalId : parsed !== null;
};

const getItemsInput = (inputs: LoopBusInput[] | undefined): LoopBusInput | undefined =>
  inputs?.find((item) => item.meta?.attentionProtocolKind === "items");

const stringifyAttentionQuery = async (runtime: SessionRuntime, query: string): Promise<string> =>
  JSON.stringify(await runtime.queryAttention({ query }));

const parseMessageFactContext = (
  detail: string | undefined,
): {
  room?: {
    chatId?: string;
    title?: string;
    kind?: string;
    contextId?: string;
    focused?: boolean;
  };
  message?: {
    messageId?: number;
    ref?: number | null;
    senderActorId?: string | null;
    senderLabel?: string | null;
    kind?: string;
    sourceRef?: string;
  };
} | null => {
  if (!detail) {
    return null;
  }
  const match = detail.match(/^```yaml\n([\s\S]*?)\n```/);
  if (!match?.[1]) {
    return null;
  }
  return parseYaml(match[1]) as {
    room?: {
      chatId?: string;
      title?: string;
      kind?: string;
      contextId?: string;
      focused?: boolean;
    };
    message?: {
      messageId?: number;
      ref?: number | null;
      senderActorId?: string | null;
      senderLabel?: string | null;
      kind?: string;
      sourceRef?: string;
    };
  };
};

const ensureAttentionContext = (internal: RuntimeInternal, contextId: string): void => {
  if (internal.attentionSystem.getContext(contextId)) {
    return;
  }
  internal.attentionSystem.createContext({
    contextId,
    owner: "avatar:tester",
    focusState: "focused",
  });
};

const buildCommitChange = (
  internal: RuntimeInternal,
  contextId: string,
  input: {
    title: string;
    detail?: { kind: "replace" | "patch"; value: string; format?: string };
    preserveContext?: boolean;
  },
): AttentionCommitChange => {
  if (input.detail) {
    return {
      type: input.detail.kind === "patch" ? "diff" : "update",
      value: input.detail.value,
      format: input.detail.format,
    };
  }
  const state = internal.attentionSystem.getContext(contextId)?.getState();
  if (input.preserveContext && state) {
    return {
      type: "update",
      value: state.content,
      format: state.contentFormat,
    };
  }
  return {
    type: "update",
    value: input.title,
    format: "text/plain",
  };
};

const appendAttentionCommit = (
  internal: RuntimeInternal,
  contextId: string,
  input: {
    meta: Partial<AttentionCommitMeta>;
    scores: Record<string, number>;
    title: string;
    detail?: { kind: "replace" | "patch"; value: string; format?: string };
    preserveContext?: boolean;
  },
): AttentionCommit => {
  ensureAttentionContext(internal, contextId);
  return internal.attentionSystem.commit(contextId, {
    meta: input.meta,
    scores: input.scores,
    summary: input.title,
    change: buildCommitChange(internal, contextId, input),
  }).commit;
};

const createTerminalSystem = (root: string): TerminalControlPlane =>
  new TerminalControlPlane({
    dbPath: join(root, "terminal.db"),
    outputRoot: join(root, "terminals"),
  });

const attachPrimaryRoom = (runtime: SessionRuntime): void => {
  const messageSystem = Reflect.get(runtime, "messageSystem") as MessageControlPlane;
  const messageActorId = Reflect.get(runtime, "messageActorId") as MessageActorId;
  if (
    messageSystem.getChannelForActor(PRIMARY_ROOM_ID, messageActorId, {
      includeArchived: true,
      touchPresence: false,
    })
  ) {
    messageSystem.focusForActor(messageActorId, "add", [PRIMARY_ROOM_ID]);
    return;
  }
  messageSystem.createChannel({
    chatId: PRIMARY_ROOM_ID,
    kind: "room",
    title: "Primary room",
    owner: "test",
    contextId: PRIMARY_CONTEXT_ID,
    bootstrapActorId: messageActorId,
  });
  messageSystem.focusForActor(messageActorId, "add", [PRIMARY_ROOM_ID]);
};

const createRuntime = (): SessionRuntime => {
  const root = mkdtempSync(join(tmpdir(), "agenter-session-runtime-"));
  const sessionId = `s-${Date.now()}`;
  const runtime = new SessionRuntime({
    sessionId,
    cwd: root,
    sessionRoot: join(root, "session"),
    sessionName: "test",
    storeTarget: "workspace",
    primaryRoomId: PRIMARY_ROOM_ID,
    allocateRoomId: createRuntimeRoomAllocator(),
    terminalSystem: createTerminalSystem(root),
    avatarPrincipalId: TEST_AVATAR_PRINCIPAL_ID,
    avatarPrivateKey: TEST_AVATAR_PRIVATE_KEY,
    homeDir: root,
    rootWorkspacePath: root,
    resolveRuntimeTerminalCwd: async (input) => ({
      ok: true,
      cwd: input.cwd ?? root,
    }),
  });
  attachPrimaryRoom(runtime);
  return runtime;
};

const createSharedRoomRuntime = (input: {
  root: string;
  sessionId: string;
  sessionName: string;
  messageSystem: MessageControlPlane;
}): SessionRuntime =>
  new SessionRuntime({
    sessionId: input.sessionId,
    cwd: input.root,
    sessionRoot: join(input.root, input.sessionId),
    sessionName: input.sessionName,
    storeTarget: "workspace",
    primaryRoomId: PRIMARY_ROOM_ID,
    allocateRoomId: createRuntimeRoomAllocator(),
    terminalSystem: createTerminalSystem(join(input.root, input.sessionId)),
    messageSystem: input.messageSystem,
    messageActorId: resolveSessionRoomActorId(input.sessionId),
    avatarPrincipalId: TEST_AVATAR_PRINCIPAL_ID,
    avatarPrivateKey: TEST_AVATAR_PRIVATE_KEY,
    homeDir: input.root,
    rootWorkspacePath: input.root,
    resolveRuntimeTerminalCwd: async (runtimeInput) => ({
      ok: true,
      cwd: runtimeInput.cwd ?? input.root,
    }),
  });

describe("Feature: session runtime attention-system loop inputs", () => {
  test("Scenario: Given attention search indexing is slow When the session runtime starts Then startup does not wait for the derived search cache", async () => {
    const originalSync = AttentionSearchEngine.prototype.sync;
    let syncCalls = 0;
    AttentionSearchEngine.prototype.sync = async () => {
      syncCalls += 1;
      await new Promise<void>(() => {});
    };
    const runtime = createRuntime();
    try {
      const startResult = await Promise.race([
        runtime.start().then(() => "started" as const),
        new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), 1_500)),
      ]);

      expect(startResult).toBe("started");
      expect(syncCalls).toBe(0);
    } finally {
      AttentionSearchEngine.prototype.sync = originalSync;
      await runtime.stop();
    }
  });

  test("Scenario: Given plugin-backed user chat When collectLoopInputs runs Then the batch is attention-native without raw chat duplication", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal;
    internal.loopPluginRuntime = await internal.createLoopPluginRuntime();

    runtime.pushUserChat("Please continue the task");

    const firstRound = await internal.collectLoopInputs();
    expect(firstRound?.some((item) => item.source === "chat" && item.text === "Please continue the task")).toBe(false);
    expect(getAttentionProtocolKinds(firstRound)).toEqual(["context"]);
    const contextInput = getBootstrapInput(firstRound);
    const itemsInput = getItemsInput(firstRound);
    expect(contextInput).toBeDefined();
    expect(itemsInput).toBeUndefined();
    if (!contextInput) {
      return;
    }

    expect(contextInput.text).toContain("## AttentionContext.focused");
    expect(contextInput.text).not.toContain("## Systems Descriptions");
    expect(contextInput.text).not.toContain("## PreAICallContext Summary");
    expect(contextInput.text).not.toContain("## Attention Items");
    expect(contextInput.text).toContain("Please continue the task");
    expect(contextInput.meta?.attentionContextId).toBe(PRIMARY_CONTEXT_ID);
    expect(contextInput.meta?.attentionContextIds).toBe(JSON.stringify([PRIMARY_CONTEXT_ID]));
    expect(contextInput.meta?.chatId).toBe(PRIMARY_ROOM_ID);
    expect(contextInput.meta?.chatFocused).toBe(true);
    expect(typeof contextInput.meta?.attentionHeadCommitId).toBe("string");
    expect(internal.resolveCycleReplyChatId([contextInput])).toBe(PRIMARY_ROOM_ID);
    expect(await stringifyAttentionQuery(runtime, "Please continue the task")).toContain("Please continue the task");
    const secondRound = await internal.collectLoopInputs();
    expect(secondRound).toBeUndefined();
  });

  test("Scenario: Given plugin-backed user chat arrives during a model tool phase When interleaved attention items commit Then only attention-native payload is returned for the next model request", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal;
    internal.loopPluginRuntime = await internal.createLoopPluginRuntime();

    runtime.pushUserChat("再补充一个条件");

    const interleaved = await internal.commitInterleavedAttentionItems();
    expect(interleaved?.some((item) => item.source === "chat")).toBe(false);
    expect(getAttentionProtocolKinds(interleaved)).toEqual(["context"]);
    const contextInput = getBootstrapInput(interleaved);
    const itemsInput = getItemsInput(interleaved);
    expect(contextInput).toBeDefined();
    expect(itemsInput).toBeUndefined();
    if (!contextInput) {
      return;
    }

    expect(contextInput.meta?.attentionContextId).toBe(PRIMARY_CONTEXT_ID);
    expect(contextInput.meta?.chatId).toBe(PRIMARY_ROOM_ID);
    expect(contextInput.text).toContain("## AttentionContext.focused");
    expect(contextInput.text).not.toContain("## PreAICallContext Summary");
    expect(contextInput.text).toContain("再补充一个条件");
    expect(await stringifyAttentionQuery(runtime, "再补充一个条件")).toContain("再补充一个条件");

    const nextRound = await internal.commitInterleavedAttentionItems();
    expect(nextRound).toBeUndefined();
  });

  test("Scenario: Given a scheduled task fires When collectLoopInputs runs Then task ingress is committed as attention without raw task payload", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal;

    internal.taskEngine.create({
      source: "workspace",
      id: "task-report",
      title: "Send REAL-TASK-OK to chat-main",
      status: "backlog",
      triggers: [{ type: "at", at: new Date(Date.now() - 60_000).toISOString() }],
    });

    const firstRound = await internal.collectLoopInputs();
    expect(firstRound).toBeDefined();
    expect(firstRound?.some((item) => item.source === "task")).toBe(false);
    expect(firstRound?.every((item) => item.source === "attention")).toBe(true);
    expect(getBootstrapInput(firstRound)).toBeDefined();

    const activeTaskItems = getActiveItems(internal).filter((item) => item.meta.source === "task");
    expect(activeTaskItems.length).toBeGreaterThan(0);
    expect(activeTaskItems.some((item) => item.title.includes("Task trigger time"))).toBe(true);
    expect(activeTaskItems.some((item) => item.title.includes("Task heartbeat"))).toBe(true);
    expect(activeTaskItems.some((item) => item.detail?.value.includes("task-triggered"))).toBe(true);
  });

  test("Scenario: Given attention originates from a non-default chat channel When the runtime collects attention bootstrap Then replies still route back to that originating channel", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal;
    await runtime.start();
    try {
      const channel = await runtime.createMessageChannel({
        kind: "room",
        title: "Room 2",
        focus: true,
      });
      await internal.collectLoopInputs();

      const contextId = `ctx-${channel.chatId}`;
      ensureAttentionContext(internal, contextId);
      const commit = internal.attentionSystem.commit(contextId, {
        ingressType: "commit",
        meta: {
          author: "User",
          source: "message",
          src: createMessageSrc(channel.chatId, 1),
        },
        scores: { room2hash: 100 },
        summary: "[lunch-relay] ask gaubee lunch",
        change: {
          type: "update",
          value: "[lunch-relay] ask gaubee lunch",
          format: "text/plain",
        },
      }).commit;
      await internal.handleCommittedAttentionCommit(contextId, commit, { notifyLoop: false });

      const attentionInput = (await internal.collectLoopInputs())?.find((item) => item.meta?.attentionContextId === contextId);
      expect(attentionInput).toBeDefined();
      if (!attentionInput) {
        return;
      }

      expect(attentionInput.source).toBe("attention");
      expect(attentionInput.meta?.attentionContextId).toBe(contextId);
      expect(attentionInput.meta?.chatId).toBe(channel.chatId);
      expect(attentionInput.meta?.chatFocused).toBe(true);
      expect(internal.resolveCycleReplyChatId([attentionInput])).toBe(channel.chatId);
    } finally {
      await runtime.stop();
    }
  });

  test("Scenario: Given room lifecycle mutations When runtime changes the room Then structural room events stay in history without becoming active debt", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal;

    const room = await runtime.createMessageChannel({
      kind: "room",
      title: "QA",
      focus: false,
    });
    runtime.updateMessageChannel({
      chatId: room.chatId,
      accessToken: room.accessToken,
      patch: {
        title: "QA 2",
      },
    });
    runtime.archiveMessageChannel({
      chatId: room.chatId,
      accessToken: room.accessToken,
    });

    const roomContext = getAttentionContextSnapshot(internal, `ctx-${room.chatId}`);
    expect(roomContext).not.toBeNull();
    if (!roomContext) {
      return;
    }
    const roomLifecycleSrc = formatMessageAttentionSrc({ chatId: room.chatId });
    const lifecycleCommits = roomContext.commits.filter((commit) =>
      [
        `Created room ${room.chatId}`,
        `Updated chat channel ${room.chatId}`,
        `Archived chat channel ${room.chatId}`,
      ].includes(commit.summary),
    );
    expect(lifecycleCommits).toHaveLength(3);
    expect(lifecycleCommits.map((commit) => commit.meta.src)).toEqual([
      roomLifecycleSrc,
      roomLifecycleSrc,
      roomLifecycleSrc,
    ]);
    expect(
      lifecycleCommits.every((commit) => parseMessageAttentionSrc(commit.meta.src ?? "")?.messageId === undefined),
    ).toBeTrue();
    expect(roomContext?.commits.some((commit) => commit.summary === `Created room ${room.chatId}`)).toBeTrue();
    expect(roomContext?.commits.some((commit) => commit.summary === `Updated chat channel ${room.chatId}`)).toBeTrue();
    expect(roomContext?.commits.some((commit) => commit.summary === `Archived chat channel ${room.chatId}`)).toBeTrue();
    expect(getActiveItems(internal).filter((item) => isMessageMetaForChat(item.meta, room.chatId))).toHaveLength(0);
    expect(
      internal.attentionSystem.listActiveContexts().some((match) => match.contextId === `ctx-${room.chatId}`),
    ).toBeFalse();
  });

  test("Scenario: Given a shared room bus When the sender authored the room message and another actor is not granted or focused Then only the unread peer runtime can ingest it", async () => {
    const root = mkdtempSync(join(tmpdir(), "agenter-shared-room-runtime-"));
    const messageSystem = new MessageControlPlane({
      dbPath: resolveMessageControlDbPath(root),
    });
    const janeRuntime = createSharedRoomRuntime({
      root,
      sessionId: "jane",
      sessionName: "jane",
      messageSystem,
    });
    const jjRuntime = createSharedRoomRuntime({
      root,
      sessionId: "jj",
      sessionName: "jj",
      messageSystem,
    });
    const janeInternal = janeRuntime as unknown as RuntimeInternal;
    const jjInternal = jjRuntime as unknown as RuntimeInternal;

    try {
      const room = messageSystem.createChannel({
        chatId: createPrincipalId(900),
        kind: "room",
        owner: "ops",
        initialUsers: [
          {
            actorId: "session:jane",
            label: "Jane",
            role: "member",
            focused: true,
          },
        ],
      });
      const janeRoom = messageSystem.getChannelForActor(room.chatId, "session:jane", {
        includeArchived: true,
        touchPresence: false,
      });
      expect(janeRoom?.focused).toBeTrue();
      expect(
        messageSystem.getChannelForActor(room.chatId, "session:jj", {
          includeArchived: true,
          touchPresence: false,
        }),
      ).toBeUndefined();

      messageSystem.sendAuthorized({
        chatId: room.chatId,
        accessToken: janeRoom?.accessToken ?? "",
        kind: "text",
        content: "hello from room",
        senderActorId: "session:jane",
      });

      const janeInputs = await janeInternal.collectLoopInputs();
      const jjInputs = await jjInternal.collectLoopInputs();
      expect(janeInputs).toBeUndefined();
      expect(jjInputs).toBeUndefined();
    } finally {
      messageSystem.close();
    }
  });

  test("Scenario: Given a room message exists before the avatar runtime starts When startup hydration collects focused room work Then the focused AttentionContext includes the unread message while read truth stays deferred", async () => {
    const root = mkdtempSync(join(tmpdir(), "agenter-room-startup-replay-"));
    const messageSystem = new MessageControlPlane({
      dbPath: resolveMessageControlDbPath(root),
    });

    try {
      const roomId = createPrincipalId(901);
      const room = messageSystem.createChannel({
        chatId: roomId,
        kind: "room",
        owner: "ops",
        contextId: `ctx-${roomId}`,
        initialUsers: [
          {
            actorId: "auth:kzf",
            label: "kzf",
            role: "member",
            focused: true,
          },
          {
            actorId: "session:jane",
            label: "Jane",
            role: "member",
            focused: true,
          },
        ],
      });
      const kzfRoom = messageSystem.getChannelForActor(room.chatId, "auth:kzf", {
        includeArchived: true,
        touchPresence: false,
      });
      const sent = messageSystem.sendAuthorized({
        chatId: room.chatId,
        accessToken: kzfRoom?.accessToken ?? "",
        senderActorId: "auth:kzf",
        from: "kzf",
        content: "hello before jane starts",
      });
      expect(sent.unreadActorIds).toContain("session:jane");

      const janeRuntime = createSharedRoomRuntime({
        root,
        sessionId: "jane",
        sessionName: "jane",
        messageSystem,
      });
      const janeInternal = janeRuntime as unknown as RuntimeInternal;

      janeInternal.loopPluginRuntime = await janeInternal.createLoopPluginRuntime();
      const firstRound = await janeInternal.collectLoopInputs();
      const attentionInput = getBootstrapInput(firstRound);
      expect(attentionInput).toBeDefined();
      expect(attentionInput?.meta?.chatId).toBe(room.chatId);
      expect(attentionInput?.text).toContain("hello before jane starts");
      expect(await stringifyAttentionQuery(janeRuntime, "hello before jane starts")).toContain(
        "hello before jane starts",
      );

      const loaded = messageSystem.getMessage(room.chatId, sent.messageId);
      expect(loaded?.readActorIds).not.toContain("session:jane");
      expect(loaded?.unreadActorIds).toContain("session:jane");
    } finally {
      messageSystem.close();
    }
  });

  test("Scenario: Given an avatar runtime is stopped When a room message arrives later Then unread subscription stays dormant until the runtime resumes", async () => {
    const root = mkdtempSync(join(tmpdir(), "agenter-room-stopped-subscription-"));
    const messageSystem = new MessageControlPlane({
      dbPath: resolveMessageControlDbPath(root),
    });

    try {
      const roomId = createPrincipalId(9011);
      const room = messageSystem.createChannel({
        chatId: roomId,
        kind: "room",
        owner: "ops",
        contextId: `ctx-${roomId}`,
        initialUsers: [
          {
            actorId: "auth:kzf",
            label: "kzf",
            role: "member",
            focused: true,
          },
          {
            actorId: "session:jane",
            label: "Jane",
            role: "member",
            focused: true,
          },
        ],
      });
      const janeRuntime = createSharedRoomRuntime({
        root,
        sessionId: "jane",
        sessionName: "jane",
        messageSystem,
      });
      const janeInternal = janeRuntime as unknown as RuntimeInternal;

      await janeRuntime.start();
      await janeRuntime.stop();

      const kzfRoom = messageSystem.getChannelForActor(room.chatId, "auth:kzf", {
        includeArchived: true,
        touchPresence: false,
      });
      const sent = messageSystem.sendAuthorized({
        chatId: room.chatId,
        accessToken: kzfRoom?.accessToken ?? "",
        senderActorId: "auth:kzf",
        from: "kzf",
        content: "hello while jane is stopped",
      });
      expect(sent.unreadActorIds).toContain("session:jane");

      const pendingWake = janeInternal.waitForAnyInput();
      const winner = await Promise.race([
        pendingWake.then((kind) => ({ kind })),
        new Promise<{ kind: "timeout" }>((resolve) => setTimeout(() => resolve({ kind: "timeout" }), 30)),
      ]);
      expect(winner.kind).toBe("timeout");

      const collected = await janeInternal.collectLoopInputs();
      expect(collected).toBeUndefined();

      const loaded = messageSystem.getMessage(room.chatId, sent.messageId);
      expect(loaded?.readActorIds).not.toContain("session:jane");
      expect(loaded?.unreadActorIds).toContain("session:jane");

      janeInternal.notifyInput("user");
      expect(await pendingWake).toBe("user");
    } finally {
      messageSystem.close();
    }
  });

  test("Scenario: Given only a recalled unread room row remains When the runtime checks message ingress Then no user-input readiness remains from that row", async () => {
    const root = mkdtempSync(join(tmpdir(), "agenter-room-recalled-unread-"));
    const messageSystem = new MessageControlPlane({
      dbPath: resolveMessageControlDbPath(root),
    });

    try {
      const roomId = createPrincipalId(9012);
      const room = messageSystem.createChannel({
        chatId: roomId,
        kind: "room",
        owner: "ops",
        contextId: `ctx-${roomId}`,
        initialUsers: [
          {
            actorId: "auth:kzf",
            label: "kzf",
            role: "member",
            focused: true,
          },
          {
            actorId: "session:jane",
            label: "Jane",
            role: "member",
            focused: true,
          },
        ],
      });
      const janeRuntime = createSharedRoomRuntime({
        root,
        sessionId: "jane",
        sessionName: "jane",
        messageSystem,
      });
      const janeInternal = janeRuntime as unknown as RuntimeInternal;

      await janeRuntime.start();
      const kzfRoom = messageSystem.getChannelForActor(room.chatId, "auth:kzf", {
        includeArchived: true,
        touchPresence: false,
      });
      const sent = messageSystem.sendAuthorized({
        chatId: room.chatId,
        accessToken: kzfRoom?.accessToken ?? "",
        senderActorId: "auth:kzf",
        from: "kzf",
        content: "this unread row will be recalled",
      });
      expect(janeInternal.hasUnreadRoomWork()).toBe(true);

      messageSystem.recallAuthorized({
        chatId: room.chatId,
        accessToken: kzfRoom?.accessToken ?? "",
        messageId: sent.messageId,
        recalledAt: sent.createdAt + 1,
      });

      expect(messageSystem.getActorUnreadState("session:jane").unreadTotal).toBe(0);
      expect(messageSystem.listUnreadRoomSummaries("session:jane")).toHaveLength(0);
      expect(janeInternal.hasUnreadRoomWork()).toBe(false);
      expect(await janeInternal.collectUnreadRoomIngress()).toBe(0);

      await janeRuntime.stop();
    } finally {
      messageSystem.close();
    }
  });

  test("Scenario: Given one avatar already loaded a room message When another granted avatar collects the same unread room work Then the later avatar sees the same focused AttentionContext without advancing read truth", async () => {
    const root = mkdtempSync(join(tmpdir(), "agenter-room-multi-seat-replay-"));
    const messageSystem = new MessageControlPlane({
      dbPath: resolveMessageControlDbPath(root),
    });

    try {
      const roomId = createPrincipalId(902);
      const room = messageSystem.createChannel({
        chatId: roomId,
        kind: "room",
        owner: "ops",
        contextId: `ctx-${roomId}`,
        initialUsers: [
          {
            actorId: "auth:kzf",
            label: "kzf",
            role: "member",
            focused: true,
          },
          {
            actorId: "session:jane",
            label: "Jane",
            role: "member",
            focused: true,
          },
          {
            actorId: "session:jj",
            label: "JJ",
            role: "member",
            focused: true,
          },
        ],
      });
      const kzfRoom = messageSystem.getChannelForActor(room.chatId, "auth:kzf", {
        includeArchived: true,
        touchPresence: false,
      });
      const sent = messageSystem.sendAuthorized({
        chatId: room.chatId,
        accessToken: kzfRoom?.accessToken ?? "",
        senderActorId: "auth:kzf",
        from: "kzf",
        content: "hello everyone",
      });
      expect(sent.unreadActorIds).toEqual(expect.arrayContaining(["session:jane", "session:jj"]));

      const janeRuntime = createSharedRoomRuntime({
        root,
        sessionId: "jane",
        sessionName: "jane",
        messageSystem,
      });
      const janeInternal = janeRuntime as unknown as RuntimeInternal;
      janeInternal.loopPluginRuntime = await janeInternal.createLoopPluginRuntime();
      const janeInputs = await janeInternal.collectLoopInputs();
      expect(janeInputs?.some((item) => item.source === "attention" && item.meta?.chatId === room.chatId)).toBeTrue();

      const afterJane = messageSystem.getMessage(room.chatId, sent.messageId);
      expect(afterJane?.readActorIds).not.toContain("session:jane");
      expect(afterJane?.unreadActorIds).toContain("session:jane");
      expect(afterJane?.unreadActorIds).toContain("session:jj");

      const jjRuntime = createSharedRoomRuntime({
        root,
        sessionId: "jj",
        sessionName: "jj",
        messageSystem,
      });
      const jjInternal = jjRuntime as unknown as RuntimeInternal;
      jjInternal.loopPluginRuntime = await jjInternal.createLoopPluginRuntime();
      const jjInputs = await jjInternal.collectLoopInputs();
      const attentionInput = getBootstrapInput(jjInputs);
      expect(attentionInput).toBeDefined();
      expect(attentionInput?.meta?.chatId).toBe(room.chatId);
      expect(attentionInput?.text).toContain("hello everyone");
      expect(await stringifyAttentionQuery(jjRuntime, "hello everyone")).toContain("hello everyone");

      const afterJj = messageSystem.getMessage(room.chatId, sent.messageId);
      expect(afterJj?.readActorIds).not.toEqual(expect.arrayContaining(["session:jane", "session:jj"]));
      expect(afterJj?.unreadActorIds).toEqual(expect.arrayContaining(["session:jane", "session:jj"]));
    } finally {
      messageSystem.close();
    }
  });

  test("Scenario: Given a real model dispatch reads a shared-room prompt When the peer runtime starts handling the AI call Then the focused AttentionContext already carries the room message and read truth advances only at model dispatch", async () => {
    const root = mkdtempSync(join(tmpdir(), "agenter-room-runtime-reply-"));
    const messageSystem = new MessageControlPlane({
      dbPath: resolveMessageControlDbPath(root),
    });

    const roomId = createPrincipalId(903);
    messageSystem.createChannel({
      chatId: roomId,
      kind: "room",
      owner: "ops",
      contextId: `ctx-${roomId}`,
      initialUsers: [
        {
          actorId: "session:jane",
          label: "Jane",
          role: "member",
          focused: true,
        },
        {
          actorId: "session:jj",
          label: "JJ",
          role: "member",
          focused: true,
        },
      ],
    });

    const janeRuntime = createSharedRoomRuntime({
      root,
      sessionId: "jane",
      sessionName: "jane",
      messageSystem,
    });
    const jjRuntime = createSharedRoomRuntime({
      root,
      sessionId: "jj",
      sessionName: "jj",
      messageSystem,
    });
    const janeInternal = janeRuntime as unknown as RuntimeInternal;
    const jjInternal = jjRuntime as unknown as RuntimeInternal;

    try {
      janeInternal.loopPluginRuntime = await janeInternal.createLoopPluginRuntime();
      jjInternal.loopPluginRuntime = await jjInternal.createLoopPluginRuntime();
      janeInternal.attentionSystem.createContext({
        contextId: `ctx-${roomId}`,
        owner: "jane",
      });
      await (janeRuntime as unknown as RuntimeMessageEgressInternal).sendMessageTool({
        chatId: roomId,
        content: "hello from jane",
        from: "jane",
      });

      const sent = messageSystem.snapshot(roomId, 10).items.find((item) => item.content === "hello from jane");
      expect(sent).toBeDefined();
      expect(sent?.senderActorId).toBe("session:jane");
      expect(sent?.readActorIds).toContain("session:jane");
      expect(sent?.unreadActorIds).toContain("session:jj");
      expect(sent?.unreadActorIds).not.toContain("session:jane");

      const janeInputs = await janeInternal.collectLoopInputs();
      expect(janeInputs).toBeUndefined();

      const jjInputs = await jjInternal.collectLoopInputs();
      const jjReply = getBootstrapInput(jjInputs);
      expect(jjReply).toBeDefined();
      expect(jjReply?.meta?.chatId).toBe(roomId);
      expect(jjReply?.text).toContain("hello from jane");
      expect(getActiveItems(jjInternal).some((item) => item.detail?.value.includes("hello from jane"))).toBeTrue();

      const afterCollect = sent ? messageSystem.getMessage(roomId, sent.messageId) : undefined;
      expect(afterCollect?.readActorIds).toEqual(expect.arrayContaining(["session:jane"]));
      expect(afterCollect?.unreadActorIds).toContain("session:jj");

      await jjRuntime.start();
      await jjRuntime.pause();
      await jjInternal.persistCycle({ wakeSource: "user", inputs: jjInputs ?? [] });
      await jjInternal.handleModelCall({
        id: "call-jj-shared-room-read",
        timestamp: 100,
        status: "running",
        provider: "openai",
        model: "gpt-5.4",
        request: { messages: [{ role: "user", content: jjReply?.text ?? "" }] },
      });

      const afterDispatch = sent ? messageSystem.getMessage(roomId, sent.messageId) : undefined;
      expect(afterDispatch?.readActorIds).toEqual(expect.arrayContaining(["session:jane", "session:jj"]));
      expect(afterDispatch?.unreadActorIds).not.toContain("session:jj");
      const snapshotRow = sent
        ? messageSystem.snapshot(roomId, 10).items.find((item) => item.messageId === sent.messageId)
        : undefined;
      expect(snapshotRow?.readActorIds).toEqual(expect.arrayContaining(["session:jane", "session:jj"]));
      expect(snapshotRow && Object.prototype.hasOwnProperty.call(snapshotRow, "readProgress")).toBeFalse();
    } finally {
      messageSystem.close();
    }
  });

  test("Scenario: Given a room message arrives during an active model tool phase When interleaved attention items commit Then MessageRoom read truth commits through the same API", async () => {
    const root = mkdtempSync(join(tmpdir(), "agenter-room-interleaved-read-"));
    const messageSystem = new MessageControlPlane({
      dbPath: resolveMessageControlDbPath(root),
    });

    try {
      const roomId = createPrincipalId(904);
      const room = messageSystem.createChannel({
        chatId: roomId,
        kind: "room",
        owner: "ops",
        contextId: `ctx-${roomId}`,
        initialUsers: [
          {
            actorId: "auth:kzf",
            label: "kzf",
            role: "member",
            focused: true,
          },
          {
            actorId: "session:jane",
            label: "Jane",
            role: "member",
            focused: true,
          },
        ],
      });
      const janeRuntime = createSharedRoomRuntime({
        root,
        sessionId: "jane",
        sessionName: "jane",
        messageSystem,
      });
      const janeInternal = janeRuntime as unknown as RuntimeInternal;
      janeInternal.loopPluginRuntime = await janeInternal.createLoopPluginRuntime();

      await janeInternal.handleModelCall({
        id: "call-jane-active-tool-phase",
        timestamp: 100,
        status: "running",
        provider: "mock",
        model: "mock-loop",
        request: { messages: [{ role: "user", content: "initial" }] },
      });

      const kzfRoom = messageSystem.getChannelForActor(room.chatId, "auth:kzf", {
        includeArchived: true,
        touchPresence: false,
      });
      const sent = messageSystem.sendAuthorized({
        chatId: room.chatId,
        accessToken: kzfRoom?.accessToken ?? "",
        senderActorId: "auth:kzf",
        from: "kzf",
        content: "interleaved requirement while tool is running",
      });
      expect(sent.unreadActorIds).toContain("session:jane");

      const interleaved = await janeInternal.commitInterleavedAttentionItems();
      expect(getAttentionProtocolKinds(interleaved)).toEqual(["context"]);
      expect(await stringifyAttentionQuery(janeRuntime, "interleaved requirement while tool is running")).toContain(
        "interleaved requirement while tool is running",
      );

      const afterCommit = messageSystem.getMessage(room.chatId, sent.messageId);
      expect(afterCommit?.readActorIds).toContain("session:jane");
      expect(afterCommit?.unreadActorIds).not.toContain("session:jane");
    } finally {
      messageSystem.close();
    }
  });

  test("Scenario: Given a delivery dispatch exists before the ai_call row binds When the model call is only running with no SSE yet Then delivery stays dispatching while ai_call binding becomes visible", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal;

    ensureAttentionContext(internal, PRIMARY_CONTEXT_ID);
    const chatCommit = appendAttentionCommit(internal, PRIMARY_CONTEXT_ID, {
      meta: {
        author: "User",
        source: "message",
        src: createMessageSrc(PRIMARY_ROOM_ID, 11),
      },
      scores: { hash_delivery_running: 100 },
      title: "Need delivery dispatch evidence",
    });
    await internal.handleCommittedAttentionCommit(PRIMARY_CONTEXT_ID, chatCommit, { notifyLoop: false });
    const inputs = await internal.collectLoopInputs();
    if (!inputs) {
      throw new Error("expected collected inputs");
    }

    await runtime.start();
    try {
      await runtime.pause();
      await internal.persistCycle({ wakeSource: "user", inputs });

      await internal.handleModelCall({
        id: "call-delivery-running",
        timestamp: 100,
        status: "running",
        provider: "openai",
        model: "gpt-5.4",
        request: { messages: [{ role: "user", content: "Need delivery dispatch evidence" }] },
      });

      const modelCallId = internal.pageModelCalls().items[0]?.id;
      const delivery = runtime.queryAttentionDeliveryTimeline({
        contextId: PRIMARY_CONTEXT_ID,
        commitId: chatCommit.commitId,
      });

      expect(modelCallId).toBeGreaterThan(0);
      expect(delivery.projections).toEqual([
        expect.objectContaining({
          contextId: PRIMARY_CONTEXT_ID,
          commitId: chatCommit.commitId,
          state: "dispatching",
          attemptCount: 1,
          sessionModelCallId: modelCallId,
          firstAcceptedAt: null,
        }),
      ]);
      expect(delivery.dispatches).toEqual([
        expect.objectContaining({
          contextId: PRIMARY_CONTEXT_ID,
          commitId: chatCommit.commitId,
          attemptIndex: 1,
          sessionModelCallId: modelCallId,
        }),
      ]);
      expect(delivery.receipts).toEqual([]);
      expect(internal.pageModelCalls().items[0]?.status).toBe("running");
    } finally {
      await runtime.stop();
    }
  });

  test("Scenario: Given a model call advances from running to committed continuation When the final lifecycle persists Then requestBody stores the committed request messages", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal;
    const sessionRoot = (Reflect.get(runtime, "options") as { sessionRoot: string }).sessionRoot;
    let db: SessionDb | null = null;

    const initialMessages = [{ role: "user", content: "initial attention input" }];
    const committedMessages = [
      ...initialMessages,
      { role: "assistant", content: "tool call placeholder" },
      { role: "user", content: "tool_result\nsummary: 同轮补充条件" },
    ];
    const requestBase = {
      systemPrompt: "system",
      promptWindowStateId: "prompt-state-1",
      roundIndex: 0,
      messages: initialMessages,
      tools: [{ name: "root_bash" }],
      meta: { test: "committed-request-body" },
    };

    await runtime.start();
    try {
      await runtime.pause();
      await internal.persistCycle({ wakeSource: "user", inputs: [] });
      await internal.handleModelCall({
        id: "call-committed-request-body",
        timestamp: 500,
        status: "running",
        provider: "mock",
        model: "mock-loop",
        request: requestBase,
      });
      await internal.handleModelCall({
        id: "call-committed-request-body",
        timestamp: 550,
        completedAt: 560,
        status: "done",
        provider: "mock",
        model: "mock-loop",
        request: {
          ...requestBase,
          messages: committedMessages,
        },
        outcome: { code: "done" },
        response: {
          decision: { kind: "model" },
          assistant: {
            text: "done",
            finishReason: "stop",
          },
        },
      });

      db = new SessionDb(join(sessionRoot, "session.db"));
      const persistedCall = db.listAiCalls(4).find((call) => call.provider === "mock" && call.model === "mock-loop");
      expect(JSON.stringify(persistedCall?.requestBody)).toContain("summary: 同轮补充条件");
      expect(
        persistedCall?.requestBody &&
          typeof persistedCall.requestBody === "object" &&
          "messages" in persistedCall.requestBody &&
          Array.isArray(persistedCall.requestBody.messages)
          ? persistedCall.requestBody.messages.length
          : 0,
      ).toBe(committedMessages.length);
    } finally {
      db?.close();
      await runtime.stop();
    }
  });

  test("Scenario: Given the first model stream fact is an error When delivery receipts are projected Then the attempt is errored and never marked accepted", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal & {
      handleAssistantDeliveryEvent: (input: AssistantDeliveryEvent) => Promise<void>;
    };

    ensureAttentionContext(internal, PRIMARY_CONTEXT_ID);
    const chatCommit = appendAttentionCommit(internal, PRIMARY_CONTEXT_ID, {
      meta: {
        author: "User",
        source: "message",
        src: createMessageSrc(PRIMARY_ROOM_ID, 12),
      },
      scores: { hash_delivery_error: 100 },
      title: "Need first-frame error evidence",
    });
    await internal.handleCommittedAttentionCommit(PRIMARY_CONTEXT_ID, chatCommit, { notifyLoop: false });
    const inputs = await internal.collectLoopInputs();
    if (!inputs) {
      throw new Error("expected collected inputs");
    }

    await runtime.start();
    try {
      await runtime.pause();
      await internal.persistCycle({ wakeSource: "user", inputs });

      await internal.handleModelCall({
        id: "call-delivery-error",
        timestamp: 200,
        status: "running",
        provider: "openai",
        model: "gpt-5.4",
        request: { messages: [{ role: "user", content: "Need first-frame error evidence" }] },
      });

      const modelCallId = internal.pageModelCalls().items[0]?.id;
      await internal.handleAssistantDeliveryEvent({
        kind: "receipt",
        attemptIndex: 1,
        status: "errored",
        providerEventKind: "run_error",
        timestamp: 210,
        errorCode: "provider.unavailable",
        errorMessage: "provider rejected the first frame",
      });
      await internal.handleModelCall({
        id: "call-delivery-error",
        timestamp: 210,
        completedAt: 210,
        status: "error",
        provider: "openai",
        model: "gpt-5.4",
        request: { messages: [{ role: "user", content: "Need first-frame error evidence" }] },
        error: {
          message: "provider rejected the first frame",
          details: {
            deliveryError: {
              providerEventKind: "run_error",
              errorCode: "provider.unavailable",
              errorMessage: "provider rejected the first frame",
            },
          },
        },
        outcome: {
          code: "error",
          reason: "provider.unavailable",
          message: "provider rejected the first frame",
          retryable: true,
        },
      });

      const delivery = runtime.queryAttentionDeliveryTimeline({
        contextId: PRIMARY_CONTEXT_ID,
        commitId: chatCommit.commitId,
      });

      expect(delivery.projections).toEqual([
        expect.objectContaining({
          contextId: PRIMARY_CONTEXT_ID,
          commitId: chatCommit.commitId,
          state: "errored",
          attemptCount: 1,
          sessionModelCallId: modelCallId,
          firstAcceptedAt: null,
        }),
      ]);
      expect(delivery.dispatches).toEqual([
        expect.objectContaining({
          attemptIndex: 1,
          sessionModelCallId: modelCallId,
        }),
      ]);
      expect(delivery.receipts).toEqual([
        expect.objectContaining({
          status: "errored",
          providerEventKind: "run_error",
          errorCode: "provider.unavailable",
          errorMessage: "provider rejected the first frame",
        }),
      ]);
      expect(delivery.receipts.some((receipt) => receipt.status === "accepted")).toBeFalse();
    } finally {
      await runtime.stop();
    }
  });

  test("Scenario: Given the same attention commit retries after an earlier provider failure When the next stream yields a valid SSE Then delivery history keeps both attempts and promotes only the latest one", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal & {
      handleAssistantDeliveryEvent: (input: AssistantDeliveryEvent) => Promise<void>;
      handleAssistantStreamUpdate: (input: AssistantStreamUpdate) => Promise<void>;
    };

    ensureAttentionContext(internal, PRIMARY_CONTEXT_ID);
    const chatCommit = appendAttentionCommit(internal, PRIMARY_CONTEXT_ID, {
      meta: {
        author: "User",
        source: "message",
        src: createMessageSrc(PRIMARY_ROOM_ID, 13),
      },
      scores: { hash_delivery_retry: 100 },
      title: "Need retry delivery evidence",
    });
    await internal.handleCommittedAttentionCommit(PRIMARY_CONTEXT_ID, chatCommit, { notifyLoop: false });
    const firstBatch = await internal.collectLoopInputs();
    const attentionInput = getBootstrapInput(firstBatch);
    if (!firstBatch || !attentionInput) {
      throw new Error("expected collected attention batch");
    }

    await runtime.start();
    try {
      await runtime.pause();
      await internal.persistCycle({ wakeSource: "user", inputs: firstBatch });
      await internal.handleModelCall({
        id: "call-delivery-retry-1",
        timestamp: 300,
        status: "running",
        provider: "openai",
        model: "gpt-5.4",
        request: { messages: [{ role: "user", content: attentionInput.text }] },
      });
      await internal.handleAssistantDeliveryEvent({
        kind: "receipt",
        attemptIndex: 1,
        status: "errored",
        providerEventKind: "run_error",
        timestamp: 310,
        errorCode: "provider.unavailable",
        errorMessage: "attempt 1 failed before SSE",
      });
      await internal.handleModelCall({
        id: "call-delivery-retry-1",
        timestamp: 310,
        completedAt: 310,
        status: "error",
        provider: "openai",
        model: "gpt-5.4",
        request: { messages: [{ role: "user", content: attentionInput.text }] },
        error: {
          message: "attempt 1 failed before SSE",
          details: {
            deliveryError: {
              providerEventKind: "run_error",
              errorCode: "provider.unavailable",
              errorMessage: "attempt 1 failed before SSE",
            },
          },
        },
        outcome: {
          code: "error",
          reason: "provider.unavailable",
          message: "attempt 1 failed before SSE",
          retryable: true,
        },
      });

      const firstContainment = internal.attentionContainment.get(PRIMARY_CONTEXT_ID);
      expect(firstContainment?.retryCount).toBe(1);
      if (!firstContainment) {
        throw new Error("expected containment state after retryable delivery error");
      }
      firstContainment.nextWakeAt = Date.now() - 1;
      expect(await internal.waitForAnyInput()).toBe("attention");

      await internal.persistCycle({
        wakeSource: "attention",
        inputs: firstBatch,
      });
      await internal.handleModelCall({
        id: "call-delivery-retry-2",
        timestamp: 400,
        status: "running",
        provider: "openai",
        model: "gpt-5.4",
        request: { messages: [{ role: "user", content: attentionInput.text }] },
      });
      await internal.handleAssistantDeliveryEvent({
        kind: "receipt",
        attemptIndex: 1,
        status: "accepted",
        providerEventKind: "text_delta",
        timestamp: 410,
      });
      await internal.handleAssistantStreamUpdate({
        kind: "draft",
        content: "retry accepted",
        delta: "retry accepted",
        timestamp: 410,
      });

      const delivery = runtime.queryAttentionDeliveryTimeline({
        contextId: PRIMARY_CONTEXT_ID,
        commitId: chatCommit.commitId,
      });

      expect(delivery.projections).toEqual([
        expect.objectContaining({
          contextId: PRIMARY_CONTEXT_ID,
          commitId: chatCommit.commitId,
          state: "accepted",
          attemptCount: 2,
        }),
      ]);
      expect(delivery.dispatches.map((dispatch) => dispatch.attemptIndex)).toEqual([1, 2]);
      expect(delivery.receipts.map((receipt) => `${receipt.attemptIndex}:${receipt.status}`)).toEqual([
        "1:errored",
        "2:accepted",
      ]);
      expect(delivery.receipts[0]?.providerEventKind).toBe("run_error");
      expect(delivery.receipts[1]?.providerEventKind).toBe("text_delta");
    } finally {
      await runtime.stop();
    }
  });

  test("Scenario: Given one model call retries inside the same provider run When ModelClient starts a second attempt Then delivery ledger keeps both attempts under the same ai_call binding", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal & {
      handleAssistantDeliveryEvent: (input: AssistantDeliveryEvent) => Promise<void>;
    };

    ensureAttentionContext(internal, PRIMARY_CONTEXT_ID);
    const chatCommit = appendAttentionCommit(internal, PRIMARY_CONTEXT_ID, {
      meta: {
        author: "User",
        source: "message",
        src: createMessageSrc(PRIMARY_ROOM_ID, 14),
      },
      scores: { hash_delivery_internal_retry: 100 },
      title: "Need provider internal retry evidence",
    });
    await internal.handleCommittedAttentionCommit(PRIMARY_CONTEXT_ID, chatCommit, { notifyLoop: false });
    const inputs = await internal.collectLoopInputs();
    const attentionInput = getBootstrapInput(inputs);
    if (!inputs || !attentionInput) {
      throw new Error("expected collected attention batch");
    }

    await runtime.start();
    try {
      await runtime.pause();
      await internal.persistCycle({ wakeSource: "user", inputs });
      await internal.handleModelCall({
        id: "call-delivery-internal-retry",
        timestamp: 500,
        status: "running",
        provider: "openai",
        model: "gpt-5.4",
        request: { messages: [{ role: "user", content: attentionInput.text }] },
      });

      const modelCallId = internal.pageModelCalls().items[0]?.id;
      await internal.handleAssistantDeliveryEvent({
        kind: "receipt",
        attemptIndex: 1,
        status: "errored",
        providerEventKind: "transport_error",
        timestamp: 510,
        errorMessage: "attempt 1 transport error",
      });
      await internal.handleAssistantDeliveryEvent({
        kind: "attempt_started",
        attemptIndex: 2,
        timestamp: 520,
      });
      await internal.handleAssistantDeliveryEvent({
        kind: "receipt",
        attemptIndex: 2,
        status: "accepted",
        providerEventKind: "tool_call_start",
        timestamp: 530,
      });
      await internal.handleAssistantDeliveryEvent({
        kind: "receipt",
        attemptIndex: 2,
        status: "completed",
        providerEventKind: "run_finished",
        timestamp: 540,
        finishReason: "tool_calls",
      });

      const delivery = runtime.queryAttentionDeliveryTimeline({
        contextId: PRIMARY_CONTEXT_ID,
        commitId: chatCommit.commitId,
      });

      expect(delivery.projections).toEqual([
        expect.objectContaining({
          contextId: PRIMARY_CONTEXT_ID,
          commitId: chatCommit.commitId,
          state: "completed",
          attemptCount: 2,
          sessionModelCallId: modelCallId,
        }),
      ]);
      expect(delivery.dispatches.map((dispatch) => `${dispatch.attemptIndex}:${dispatch.sessionModelCallId}`)).toEqual([
        `1:${modelCallId}`,
        `2:${modelCallId}`,
      ]);
      expect(delivery.receipts.map((receipt) => `${receipt.attemptIndex}:${receipt.status}`)).toEqual([
        "1:errored",
        "2:accepted",
        "2:completed",
      ]);
      expect(delivery.receipts[0]?.providerEventKind).toBe("transport_error");
      expect(delivery.receipts[1]?.providerEventKind).toBe("tool_call_start");
      expect(delivery.receipts[2]?.providerEventKind).toBe("run_finished");
    } finally {
      await runtime.stop();
    }
  });

  test("Scenario: Given a shared-room unread message When collectLoopInputs commits attention ingress Then the message envelope keeps only raw room facts while room projections stay queryable", async () => {
    const root = mkdtempSync(join(tmpdir(), "agenter-room-social-meta-"));
    const messageSystem = new MessageControlPlane({
      dbPath: resolveMessageControlDbPath(root),
    });

    try {
      const roomId = createPrincipalId(9031);
      const room = messageSystem.createChannel({
        chatId: roomId,
        kind: "room",
        owner: "ops",
        contextId: `ctx-${roomId}`,
        initialUsers: [
          {
            actorId: "auth:kzf",
            label: "kzf",
            role: "member",
            focused: true,
          },
          {
            actorId: "session:jane",
            label: "Jane",
            role: "member",
            focused: true,
          },
          {
            actorId: "session:jj",
            label: "JJ",
            role: "member",
            focused: false,
          },
        ],
      });
      messageSystem.setActorPresence("auth:kzf", true);
      messageSystem.setActorPresence("session:jane", true);
      messageSystem.setActorPresence("session:jj", false);

      const janeRuntime = createSharedRoomRuntime({
        root,
        sessionId: "jane",
        sessionName: "jane",
        messageSystem,
      });
      const janeInternal = janeRuntime as unknown as RuntimeInternal;
      const relayRoom = await janeRuntime.createMessageChannel({
        kind: "room",
        title: "gaubee",
        participants: [
          { id: "session:jane", label: "Jane" },
          { id: "auth:gaubee", label: "gaubee" },
        ],
        focus: false,
      });
      messageSystem.upsertContact({
        ownerActorId: "session:jane",
        sourceId: "source-remote",
        remoteActorId: "auth:gaubee",
        label: "gaubee",
      });

      const kzfRoom = messageSystem.getChannelForActor(room.chatId, "auth:kzf", {
        includeArchived: true,
        touchPresence: false,
      });
      messageSystem.sendAuthorized({
        chatId: room.chatId,
        accessToken: kzfRoom?.accessToken ?? "",
        senderActorId: "auth:kzf",
        from: "kzf",
        content: "status update",
      });

      const inputs = await janeInternal.collectLoopInputs();
      expect(getBootstrapInput(inputs)).toBeDefined();
      const messageFact = parseMessageFactContext(
        getActiveItems(janeInternal).find((item) => item.detail?.value.includes("status update"))?.detail?.value,
      );
      expect(messageFact?.room?.kind).toBe("room");
      expect(messageFact?.room?.contextId).toBe(room.contextId);
      expect(messageFact?.room?.focused).toBe(true);
      expect(messageFact?.message).toMatchObject({
        senderActorId: "auth:kzf",
        senderLabel: "kzf",
        kind: "text",
      });
      expect(messageFact?.message?.sourceRef).toContain(`${room.chatId}/`);

      const projected = await janeInternal.readMessageChannelForTooling({
        chatId: room.chatId,
        limit: 10,
      });
      expect(projected.directory?.visibleRooms).toEqual([
        {
          chatId: relayRoom.chatId,
          title: "gaubee",
          participantLabels: ["Jane", "gaubee"],
          focused: false,
        },
      ]);
      const expectedReachableParticipants: RuntimeReachableParticipantView[] = [
        {
          kind: "contact",
          actorId: "auth:gaubee",
          sourceId: "source-remote",
          label: "gaubee",
          rooms: [
            {
              chatId: relayRoom.chatId,
              title: "gaubee",
              participantLabels: ["Jane", "gaubee"],
              focused: false,
            },
          ],
        },
        {
          kind: "room-label",
          label: "Jane",
          rooms: [
            {
              chatId: relayRoom.chatId,
              title: "gaubee",
              participantLabels: ["Jane", "gaubee"],
              focused: false,
            },
          ],
        },
      ];
      expect(projected.directory?.reachableParticipants).toEqual(expectedReachableParticipants);
    } finally {
      messageSystem.close();
    }
  });

  test("Scenario: Given a shared-room peer status update When collectLoopInputs commits attention ingress Then the message envelope stays visible as raw fact without auto-claiming a reply turn", async () => {
    const root = mkdtempSync(join(tmpdir(), "agenter-room-peer-meta-"));
    const messageSystem = new MessageControlPlane({
      dbPath: resolveMessageControlDbPath(root),
    });

    try {
      const roomId = createPrincipalId(9032);
      const room = messageSystem.createChannel({
        chatId: roomId,
        kind: "room",
        owner: "ops",
        contextId: `ctx-${roomId}`,
        initialUsers: [
          {
            actorId: "auth:kzf",
            label: "kzf",
            role: "member",
            focused: true,
          },
          {
            actorId: "session:jane",
            label: "Jane",
            role: "member",
            focused: true,
          },
          {
            actorId: "session:jj",
            label: "JJ",
            role: "member",
            focused: false,
          },
        ],
      });
      messageSystem.setActorPresence("auth:kzf", true);
      messageSystem.setActorPresence("session:jane", true);
      messageSystem.setActorPresence("session:jj", false);

      const jjRuntime = createSharedRoomRuntime({
        root,
        sessionId: "jj",
        sessionName: "jj",
        messageSystem,
      });
      const jjInternal = jjRuntime as unknown as RuntimeInternal;

      const janeRoom = messageSystem.getChannelForActor(room.chatId, "session:jane", {
        includeArchived: true,
        touchPresence: false,
      });
      messageSystem.sendAuthorized({
        chatId: room.chatId,
        accessToken: janeRoom?.accessToken ?? "",
        senderActorId: "session:jane",
        from: "Jane",
        content: "我先去把接口跑起来，稍后把结果发到群里。",
      });

      const inputs = await jjInternal.collectLoopInputs();
      expect(getBootstrapInput(inputs)).toBeDefined();
      const messageFact = parseMessageFactContext(
        getActiveItems(jjInternal).find((item) =>
          item.detail?.value.includes("我先去把接口跑起来，稍后把结果发到群里。"),
        )?.detail?.value,
      );
      expect(messageFact?.room?.kind).toBe("room");
      expect(messageFact?.room?.contextId).toBe(room.contextId);
      expect(messageFact?.room?.focused).toBe(false);
      expect(messageFact?.message?.senderActorId).toBe("session:jane");
      expect(messageFact?.message?.senderLabel).toBe("Jane");
      expect(messageFact?.message?.kind).toBe("text");
    } finally {
      messageSystem.close();
    }
  });

  test("Scenario: Given punctuation-heavy direct-room ingress When collectLoopInputs commits attention ingress Then the raw fact stays visible without platform reply obligations", async () => {
    const root = mkdtempSync(join(tmpdir(), "agenter-room-direct-question-"));
    const messageSystem = new MessageControlPlane({
      dbPath: resolveMessageControlDbPath(root),
    });

    try {
      const roomId = createPrincipalId(90321);
      const room = messageSystem.createChannel({
        chatId: roomId,
        kind: "room",
        owner: "ops",
        contextId: `ctx-${roomId}`,
        initialUsers: [
          {
            actorId: "auth:kzf",
            label: "kzf",
            role: "member",
            focused: true,
          },
          {
            actorId: "session:jane",
            label: "Jane",
            role: "member",
            focused: true,
          },
        ],
      });

      const janeRuntime = createSharedRoomRuntime({
        root,
        sessionId: "jane",
        sessionName: "jane",
        messageSystem,
      });
      const janeInternal = janeRuntime as unknown as RuntimeInternal;
      const kzfRoom = messageSystem.getChannelForActor(room.chatId, "auth:kzf", {
        includeArchived: true,
        touchPresence: false,
      });
      messageSystem.sendAuthorized({
        chatId: room.chatId,
        accessToken: kzfRoom?.accessToken ?? "",
        senderActorId: "auth:kzf",
        from: "kzf",
        content: "你现在能回复我吗？？",
      });

      const inputs = await janeInternal.collectLoopInputs();
      const bootstrap = getBootstrapInput(inputs);
      expect(bootstrap).toBeDefined();
      expect(bootstrap?.text).toContain("你现在能回复我吗？？");
      expect(bootstrap?.text).not.toContain("room_reply_pending");
      expect(bootstrap?.text).not.toContain("your_turn");
      expect(bootstrap?.text).not.toContain("chatObligationKind");
      expect(await stringifyAttentionQuery(janeRuntime, "你现在能回复我吗？？")).toContain("你现在能回复我吗？？");
    } finally {
      messageSystem.close();
    }
  });

  test("Scenario: Given a group-room auth actor ingress When collectLoopInputs commits attention ingress Then sender identity stays factual without platform reply obligations", async () => {
    const root = mkdtempSync(join(tmpdir(), "agenter-room-auth-actor-"));
    const messageSystem = new MessageControlPlane({
      dbPath: resolveMessageControlDbPath(root),
    });

    try {
      const roomId = createPrincipalId(90322);
      const room = messageSystem.createChannel({
        chatId: roomId,
        kind: "room",
        owner: "ops",
        contextId: `ctx-${roomId}`,
        initialUsers: [
          {
            actorId: "auth:kzf",
            label: "kzf",
            role: "member",
            focused: true,
          },
          {
            actorId: "auth:gaubee",
            label: "gaubee",
            role: "member",
            focused: true,
          },
          {
            actorId: "session:jane",
            label: "Jane",
            role: "member",
            focused: true,
          },
        ],
      });

      const janeRuntime = createSharedRoomRuntime({
        root,
        sessionId: "jane",
        sessionName: "jane",
        messageSystem,
      });
      const janeInternal = janeRuntime as unknown as RuntimeInternal;
      const gaubeeRoom = messageSystem.getChannelForActor(room.chatId, "auth:gaubee", {
        includeArchived: true,
        touchPresence: false,
      });
      messageSystem.sendAuthorized({
        chatId: room.chatId,
        accessToken: gaubeeRoom?.accessToken ?? "",
        senderActorId: "auth:gaubee",
        from: "gaubee",
        content: "同步一下当前状态。",
      });

      const inputs = await janeInternal.collectLoopInputs();
      const bootstrap = getBootstrapInput(inputs);
      expect(bootstrap).toBeDefined();
      expect(bootstrap?.text).toContain("同步一下当前状态。");
      expect(bootstrap?.text).not.toContain("room_reply_pending");
      expect(bootstrap?.text).not.toContain("your_turn");
      expect(bootstrap?.text).not.toContain("self_update");

      const messageFact = parseMessageFactContext(
        getActiveItems(janeInternal).find((item) => item.detail?.value.includes("同步一下当前状态。"))?.detail?.value,
      );
      expect(messageFact?.message?.senderActorId).toBe("auth:gaubee");
      expect(messageFact?.message?.senderLabel).toBe("gaubee");
    } finally {
      messageSystem.close();
    }
  });

  test("Scenario: Given message and terminal attention are both active When bootstrap context is assembled Then only minimal metadata for both contexts is emitted", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal;
    internal.loopPluginRuntime = await internal.createLoopPluginRuntime();

    internal.attentionSystem.createContext({
      contextId: "ctx-terminal-iflow",
      owner: "avatar:tester",
      focusState: "background",
    });
    const terminalCommit = appendAttentionCommit(internal, "ctx-terminal-iflow", {
      meta: {
        author: "terminal:iflow",
        source: "terminal",
        src: createTerminalSrc("iflow"),
      },
      scores: { hash_terminal: 100 },
      title: "Terminal iflow is waiting for auth",
    });
    await internal.handleCommittedAttentionCommit("ctx-terminal-iflow", terminalCommit, { notifyLoop: false });

    runtime.pushUserChat("Please continue the task");

    const firstRound = await internal.collectLoopInputs();
    const contextInput = getBootstrapInput(firstRound);
    expect(contextInput).toBeDefined();
    if (!contextInput) {
      return;
    }

    expect(contextInput.text).toContain("## AttentionContext.focused");
    expect(contextInput.text).toContain(PRIMARY_CONTEXT_ID);
    expect(contextInput.text).not.toContain("Systems Descriptions");
    expect(contextInput.text).not.toContain("yaml+background-attention-context");
    expect(contextInput.text).not.toContain("focusState:");
    expect(contextInput.text).not.toContain("scoreMap:");
    expect(contextInput.text).not.toContain("scores:");
  });

  test("Scenario: Given terminal focus changes When runtime replaces the focused terminal Then focus state changes without serializing focus lifecycle as terminal debt", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal;

    await runtime.start();
    try {
      const created1 = await runtime.createRuntimeTerminal({
        terminalId: "iflow-1",
        processKind: "shell",
        command: [process.execPath, "-e", "void 0"],
        focus: true,
      });
      const created2 = await runtime.createRuntimeTerminal({
        terminalId: "iflow-2",
        processKind: "shell",
        command: [process.execPath, "-e", "void 0"],
        focus: false,
      });

      expect(created1.ok).toBeTrue();
      expect(created2.ok).toBeTrue();

      const focusResult = await runtime.focusRuntimeTerminals({
        op: "replace",
        terminalIds: ["iflow-2"],
      });
      expect(focusResult.ok).toBeTrue();

      const firstSnapshot = getAttentionContextSnapshot(internal, "ctx-terminal-iflow-1");
      const secondSnapshot = getAttentionContextSnapshot(internal, "ctx-terminal-iflow-2");
      expect(firstSnapshot?.focusState).toBe("background");
      expect(secondSnapshot?.focusState).toBe("focused");
      expect(firstSnapshot?.commits.some((commit) => commit.meta.tags?.includes("terminal_unfocus"))).toBeFalse();
      expect(secondSnapshot?.commits.some((commit) => commit.meta.tags?.includes("terminal_focus"))).toBeFalse();

      const activeTerminalItems = getActiveItems(internal).filter((item) => isTerminalMeta(item.meta));
      expect(activeTerminalItems.some((item) => item.title === "Focused terminal iflow-2")).toBeFalse();
      expect(activeTerminalItems.some((item) => item.title === "Unfocused terminal iflow-1")).toBeFalse();
      expect(activeTerminalItems.some((item) => item.title === "Created terminal iflow-1")).toBeFalse();
      expect(activeTerminalItems.some((item) => item.title === "Created terminal iflow-2")).toBeFalse();
    } finally {
      await runtime.stop();
    }
  });

  test("Scenario: Given a terminal kill transition When runtime snapshots and attention are inspected Then transition truth stays observable without creating new terminal debt", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal;

    await runtime.start();
    try {
      const created = await runtime.createRuntimeTerminal({
        terminalId: "transition-no-attention",
        processKind: "shell",
        focus: false,
      });
      expect(created.ok).toBeTrue();

      const terminalControlPlane = Reflect.get(runtime, "terminalControlPlane") as TerminalControlPlane;
      const terminalContextId = "ctx-terminal-transition-no-attention";
      const beforeSnapshot = getAttentionContextSnapshot(internal, terminalContextId);
      const beforeCommitCount = beforeSnapshot?.commits.length ?? 0;
      const beforeActiveTitles = getActiveItems(internal)
        .filter((item) => isTerminalMeta(item.meta, "transition-no-attention"))
        .map((item) => item.title);

      const managed = terminalControlPlane.getManagedTerminal("transition-no-attention");
      if (!managed) {
        throw new Error("expected managed terminal");
      }
      const originalStop = managed.stop.bind(managed);
      managed.stop = async () => {
        await Bun.sleep(40);
        await originalStop();
      };

      const stopPromise = runtime.stopRuntimeTerminal("transition-no-attention");
      await Bun.sleep(5);

      const duringStop = runtime.snapshot().terminals.find((item) => item.terminalId === "transition-no-attention");
      expect(duringStop?.lifecycleTransition).toBe("killing");
      expect(
        getActiveItems(internal)
          .filter((item) => isTerminalMeta(item.meta, "transition-no-attention"))
          .map((item) => item.title),
      ).toEqual(beforeActiveTitles);

      const stopped = await stopPromise;
      expect(stopped.ok).toBeTrue();
      expect(
        runtime.snapshot().terminals.find((item) => item.terminalId === "transition-no-attention")?.processPhase,
      ).toBe("stopped");

      const afterStopSnapshot = getAttentionContextSnapshot(internal, terminalContextId);
      expect(afterStopSnapshot?.commits.length ?? 0).toBe(beforeCommitCount);

      const bootstrapped = await runtime.bootstrapRuntimeTerminal("transition-no-attention");
      expect(bootstrapped.ok).toBeTrue();

      const afterBootstrapSnapshot = getAttentionContextSnapshot(internal, terminalContextId);
      expect(afterBootstrapSnapshot?.commits.length ?? 0).toBe(beforeCommitCount);
      expect(
        runtime.snapshot().terminals.find((item) => item.terminalId === "transition-no-attention")?.lifecycleTransition,
      ).toBeNull();
    } finally {
      await runtime.stop();
    }
  });

  test("Scenario: Given another actor focuses a shared terminal When this runtime did not focus it Then the runtime keeps its own focused set unchanged", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal;

    await runtime.start();
    try {
      const created = await runtime.createRuntimeTerminal({
        terminalId: "shared-focus",
        processKind: "shell",
        focus: false,
      });
      expect(created.ok).toBeTrue();
      const focusedBefore = [...runtime.snapshot().focusedTerminalIds];
      expect(focusedBefore.includes("shared-focus")).toBeFalse();

      const terminalControlPlane = Reflect.get(runtime, "terminalControlPlane") as TerminalControlPlane;
      const terminalActorId = Reflect.get(runtime, "terminalActorId") as TerminalActorId;
      const observer = terminalControlPlane.issueGrantAuthorized({
        terminalId: "shared-focus",
        actorId: terminalActorId,
        participantId: "session:observer",
        role: "readonly",
      });

      terminalControlPlane.focusAuthorized("add", [
        {
          terminalId: "shared-focus",
          accessToken: observer.accessToken,
        },
      ]);

      expect(runtime.snapshot().focusedTerminalIds).toEqual(focusedBefore);
      expect(internal.focusedTerminalIds).toEqual(focusedBefore);
      expect(
        terminalControlPlane
          .listForActor("session:observer", { touchPresence: false })
          .find((item) => item.terminalId === "shared-focus")?.focused,
      ).toBeTrue();
    } finally {
      await runtime.stop();
    }
  });

  test("Scenario: Given terminal control-plane config changes When runtime updates config Then the change stays in history as world fact without becoming active debt", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal & {
      updateTerminalControlPlaneConfig: (patch: Record<string, unknown>) => Promise<Record<string, unknown>>;
    };

    await runtime.start();
    try {
      await internal.updateTerminalControlPlaneConfig({
        transport: {
          port: 0,
        },
      });

      const controlPlaneContext = getAttentionContextSnapshot(internal, "ctx-terminal-control-plane");
      expect(controlPlaneContext).not.toBeNull();
      expect(controlPlaneContext?.commits.at(-1)?.summary).toBe("Updated terminal control-plane config");
      expect(controlPlaneContext?.commits.at(-1)?.meta.tags).toContain("terminal_config_update");
      expect(
        internal.attentionSystem.listActiveContexts().some((match) => match.contextId === "ctx-terminal-control-plane"),
      ).toBeFalse();
    } finally {
      await runtime.stop();
    }
  });

  test("Scenario: Given a background terminal becomes ready When runtime records the scheduler signal Then no terminal-ready task fact is committed", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal & {
      enqueueTerminalLifecycleAttentionCommit: (input: {
        terminalId: string;
        contextId: string;
        event: string;
        summary: string;
        payload?: Record<string, unknown>;
        score?: number;
        ingressType?: "commit" | "push";
      }) => void;
    };

    await runtime.start();
    try {
      internal.enqueueTerminalLifecycleAttentionCommit({
        terminalId: "bg-ready",
        contextId: "ctx-terminal-bg-ready",
        event: "terminal_idle_ready",
        summary: "Terminal bg-ready is ready for your input.",
        score: 100,
      });
      await new Promise((resolve) => setTimeout(resolve, 0));

      const activeTerminalItems = getActiveItems(internal).filter((item) => isTerminalMeta(item.meta));
      expect(activeTerminalItems.some((item) => item.title === "Terminal bg-ready is ready for your input.")).toBeFalse();
    } finally {
      await runtime.stop();
    }
  });

  test("Scenario: Given a background push with score When it is committed Then runtime wakes without promoting the context to focused", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal & {
      handleCommittedAttentionCommit: (
        contextId: string,
        commit: AttentionCommit,
        input: { notifyLoop: boolean },
      ) => Promise<void>;
    };

    await runtime.start();
    try {
      internal.attentionSystem.createContext({
        contextId: "ctx-room-background",
        owner: "avatar:tester",
        focusState: "background",
      });
      const pendingWake = internal.waitForAnyInput();
      const commit = internal.attentionSystem.commit("ctx-room-background", {
        ingressType: "push",
        meta: {
          author: "user:kzf",
          source: "message",
          src: createMessageSrc("room-background", 101),
        },
        scores: { hash_background: 100 },
        summary: "background room needs attention",
        change: { type: "update", value: "background room needs attention" },
      }).commit;

      await internal.handleCommittedAttentionCommit("ctx-room-background", commit, { notifyLoop: true });

      expect(await pendingWake).toBe("attention");
      expect(
        internal.attentionSystem.listActiveContexts().some((match) => match.contextId === "ctx-room-background"),
      ).toBeTrue();
      expect(internal.attentionSystem.getContext("ctx-room-background")?.getState().focusState).toBe("background");
    } finally {
      await runtime.stop();
    }
  });

  test("Scenario: Given a focused terminal without runtime status When runtime records scheduler signals Then no terminal wake signal is emitted", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal & {
      isTerminalActionable: (terminalId: string) => boolean;
      terminalKernelAdapter: {
        markTerminalDirty: (terminalId: string) => void;
      };
    };

    await runtime.start();
    try {
      const beforeVersion = runtime.snapshot().schedulerSignals.terminal.version;
      internal.config = {
        ...(internal.config ?? {}),
        terminals: {
          ...(internal.config?.terminals ?? {}),
          iflow: {
            terminalId: "iflow",
            cwd: "/tmp",
            command: ["bash"],
            commandLabel: "bash",
            gitLog: false,
          },
        },
      };
      internal.terminals.set("iflow", {
        isRunning: () => true,
        getSnapshot: () => ({
          seq: 1,
          cols: 80,
          rows: 24,
          cursor: { x: 0, y: 0 },
          lines: ["echo passive"],
          scrollback: {
            viewportOffset: 0,
            totalLines: 24,
            screenLines: 24,
          },
        }),
        getStatus: () => "IDLE",
        sliceDirty: async () => ({
          ok: true,
          changed: false,
          fromHash: null,
          toHash: null,
          diff: "",
          bytes: 0,
        }),
      });
      internal.focusedTerminalIds = ["iflow"];
      internal.terminalKernelAdapter.markTerminalDirty("iflow");
      expect(internal.isTerminalActionable("iflow")).toBeFalse();
      await Bun.sleep(10);
      expect(runtime.snapshot().schedulerSignals.terminal.version).toBe(beforeVersion);
    } finally {
      await runtime.stop();
    }
  });

  test("Scenario: Given an actionable terminal signal When runtime records scheduler signals Then one terminal wake signal is emitted", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal & {
      terminalStatusById: Map<
        string,
        {
          processPhase: "not_started" | "running" | "stopped";
          lifecycleTransition: string | null;
          status: "IDLE" | "BUSY";
        }
      >;
      terminalKernelAdapter: {
        markTerminalDirty: (terminalId: string) => void;
      };
    };

    await runtime.start();
    try {
      const beforeVersion = runtime.snapshot().schedulerSignals.terminal.version;
      internal.config = {
        ...(internal.config ?? {}),
        terminals: {
          ...(internal.config?.terminals ?? {}),
          iflow: {
            terminalId: "iflow",
            cwd: "/tmp",
            command: ["bash"],
            commandLabel: "bash",
            gitLog: false,
          },
        },
      };
      internal.terminals.set("iflow", {
        isRunning: () => true,
        getSnapshot: () => ({
          seq: 1,
          cols: 80,
          rows: 24,
          cursor: { x: 0, y: 0 },
          lines: ["echo actionable"],
          scrollback: {
            viewportOffset: 0,
            totalLines: 24,
            screenLines: 24,
          },
        }),
        getStatus: () => "IDLE",
        sliceDirty: async () => ({
          ok: true,
          changed: false,
          fromHash: null,
          toHash: null,
          diff: "",
          bytes: 0,
        }),
      });
      internal.focusedTerminalIds = ["iflow"];
      internal.terminalStatusById.set("iflow", {
        processPhase: "running",
        lifecycleTransition: "bootstrapping",
        status: "IDLE",
      });

      internal.terminalKernelAdapter.markTerminalDirty("iflow");
      await Bun.sleep(10);

      expect(runtime.snapshot().schedulerSignals.terminal.version).toBe(beforeVersion + 1);
    } finally {
      await runtime.stop();
    }
  });

  test("Scenario: Given a focused steady-state running terminal When semantic terminal output changes Then runtime records a terminal wake signal without requiring a lifecycle transition", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal & {
      terminalStatusById: Map<
        string,
        {
          processPhase: "not_started" | "running" | "stopped";
          lifecycleTransition: string | null;
          status: "IDLE" | "BUSY";
        }
      >;
      terminalKernelAdapter: {
        markTerminalDirty: (terminalId: string) => void;
      };
      isTerminalActionable: (terminalId: string) => boolean;
    };

    await runtime.start();
    try {
      const beforeVersion = runtime.snapshot().schedulerSignals.terminal.version;
      internal.config = {
        ...(internal.config ?? {}),
        terminals: {
          ...(internal.config?.terminals ?? {}),
          iflow: {
            terminalId: "iflow",
            cwd: "/tmp",
            command: ["bash"],
            commandLabel: "bash",
            gitLog: false,
          },
        },
      };
      internal.terminals.set("iflow", {
        isRunning: () => true,
        getSnapshot: () => ({
          seq: 2,
          cols: 80,
          rows: 24,
          cursor: { x: 0, y: 1 },
          lines: ["echo ready", "matrixd-signal"],
          scrollback: {
            viewportOffset: 0,
            totalLines: 24,
            screenLines: 24,
          },
        }),
        getStatus: () => "IDLE",
        sliceDirty: async () => ({
          ok: true,
          changed: true,
          fromHash: "hash-1",
          toHash: "hash-2",
          diff: "+matrixd-signal",
          bytes: 14,
        }),
      });
      internal.focusedTerminalIds = ["iflow"];
      internal.terminalStatusById.set("iflow", {
        processPhase: "running",
        lifecycleTransition: null,
        status: "IDLE",
      });

      expect(internal.isTerminalActionable("iflow")).toBeTrue();
      internal.terminalKernelAdapter.markTerminalDirty("iflow");
      await Bun.sleep(10);

      expect(runtime.snapshot().schedulerSignals.terminal.version).toBe(beforeVersion + 1);
      expect(runtime.snapshot().schedulerSignals.terminal.timestamp).not.toBeNull();
    } finally {
      await runtime.stop();
    }
  });

  test("Scenario: Given a muted notification push When it is committed Then runtime still wakes for the forced notification", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal & {
      handleCommittedAttentionCommit: (
        contextId: string,
        commit: AttentionCommit,
        input: { notifyLoop: boolean },
      ) => Promise<void>;
    };

    await runtime.start();
    try {
      internal.attentionSystem.createContext({
        contextId: "ctx-room-muted",
        owner: "avatar:tester",
        focusState: "muted",
      });
      const pendingWake = internal.waitForAnyInput();
      const commit = internal.attentionSystem.commit("ctx-room-muted", {
        ingressType: "push",
        meta: {
          author: "user:kzf",
          source: "message",
          src: createMessageSrc("room-muted", 202),
          tags: ["notification"],
        },
        scores: { hash_notification: 100 },
        summary: "notification override",
        change: { type: "update", value: "notification override" },
      }).commit;

      await internal.handleCommittedAttentionCommit("ctx-room-muted", commit, { notifyLoop: true });

      expect(await pendingWake).toBe("attention");
      expect(internal.attentionSystem.listActiveContexts().some((match) => match.contextId === "ctx-room-muted")).toBe(
        true,
      );
    } finally {
      await runtime.stop();
    }
  });

  test("Scenario: Given a muted notification already crossed the injection boundary within 12 hours When another muted notify is inspected Then quota reports blocked with history and next allowed time", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal & {
      buildAttentionItemsPlan: (match: AttentionActiveContextMatch) => { messageId: string; text: string } | null;
      pendingAttentionMessagePlans: Map<string, { messageId: string; text: string }>;
      commitInjectedAttentionPlans: (input: { requestMessages?: readonly { role: string; content: string }[] }) => void;
    };

    await runtime.start();
    await runtime.pause();
    try {
      internal.attentionSystem.createContext({
        contextId: "ctx-room-muted",
        owner: "avatar:tester",
        focusState: "muted",
      });
      const firstCommit = internal.attentionSystem.commit("ctx-room-muted", {
        ingressType: "push",
        meta: {
          author: "user:kzf",
          source: "message",
          src: createMessageSrc("room-muted", 301),
          tags: ["notification"],
        },
        scores: { hash_notification_muted_1: 100 },
        summary: "muted notification one",
        change: { type: "update", value: "muted notification one" },
      }).commit;
      await internal.handleCommittedAttentionCommit("ctx-room-muted", firstCommit, { notifyLoop: false });
      const firstMatch = internal.attentionSystem
        .listActiveContexts()
        .find((match) => match.contextId === "ctx-room-muted");
      if (!firstMatch) {
        throw new Error("expected first muted notify context");
      }
      const firstPlan = internal.buildAttentionItemsPlan(firstMatch);
      if (!firstPlan) {
        throw new Error("expected first muted notify plan");
      }
      internal.pendingAttentionMessagePlans.set(firstPlan.messageId, firstPlan);
      internal.commitInjectedAttentionPlans({
        requestMessages: [{ role: "user", content: firstPlan.text }],
      });
      const firstQuota = internal.inspectNotifyQuota({
        contextId: "ctx-room-muted",
        sourceId: createMessageSrc("room-muted", 301),
        focusState: "muted",
      });

      const secondCommit = internal.attentionSystem.commit("ctx-room-muted", {
        ingressType: "push",
        meta: {
          author: "user:kzf",
          source: "message",
          src: createMessageSrc("room-muted", 301),
          tags: ["notification"],
        },
        scores: { hash_notification_muted_2: 100 },
        summary: "muted notification two",
        change: { type: "update", value: "muted notification two" },
      }).commit;
      await internal.handleCommittedAttentionCommit("ctx-room-muted", secondCommit, { notifyLoop: false });

      const quota = internal.inspectNotifyQuota({
        contextId: "ctx-room-muted",
        sourceId: createMessageSrc("room-muted", 301),
        focusState: "muted",
      });
      const secondMatch = internal.attentionSystem
        .listActiveContexts()
        .find((match) => match.contextId === "ctx-room-muted");
      if (!secondMatch) {
        throw new Error("expected second muted notify context");
      }
      const secondPlan = internal.buildAttentionItemsPlan(secondMatch);

      expect(firstQuota.history).toHaveLength(1);
      expect(firstQuota.remaining.allowedNow).toBe(false);
      expect(quota.focusState).toBe("muted");
      expect(quota.effective.windowMs).toBe(12 * 60 * 60 * 1_000);
      expect(quota.remaining.allowedNow).toBe(false);
      expect(quota.remaining.remainingSends).toBe(0);
      expect(quota.remaining.nextAllowedAt).toBeGreaterThan(Date.now());
      expect(quota.history).toHaveLength(1);
      expect(secondPlan).toBeNull();
    } finally {
      await runtime.stop();
    }
  });

  test("Scenario: Given a background notification already crossed the injection boundary within 0.5 hours When quota is queried Then the runtime reports blocked state, effective config, and send history", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal & {
      buildAttentionItemsPlan: (match: AttentionActiveContextMatch) => { messageId: string; text: string } | null;
      pendingAttentionMessagePlans: Map<string, { messageId: string; text: string }>;
      commitInjectedAttentionPlans: (input: { requestMessages?: readonly { role: string; content: string }[] }) => void;
    };

    await runtime.start();
    await runtime.pause();
    try {
      internal.attentionSystem.createContext({
        contextId: "ctx-room-background-notify",
        owner: "avatar:tester",
        focusState: "background",
      });
      const firstCommit = internal.attentionSystem.commit("ctx-room-background-notify", {
        ingressType: "push",
        meta: {
          author: "user:kzf",
          source: "message",
          src: createMessageSrc("room-background", 401),
          tags: ["notification"],
        },
        scores: { hash_notification_background_1: 100 },
        summary: "background notification one",
        change: { type: "update", value: "background notification one" },
      }).commit;
      await internal.handleCommittedAttentionCommit("ctx-room-background-notify", firstCommit, { notifyLoop: false });
      const firstMatch = internal.attentionSystem
        .listActiveContexts()
        .find((match) => match.contextId === "ctx-room-background-notify");
      if (!firstMatch) {
        throw new Error("expected background notify context");
      }
      const firstPlan = internal.buildAttentionItemsPlan(firstMatch);
      if (!firstPlan) {
        throw new Error("expected first background notify plan");
      }
      internal.pendingAttentionMessagePlans.set(firstPlan.messageId, firstPlan);
      internal.commitInjectedAttentionPlans({
        requestMessages: [{ role: "user", content: firstPlan.text }],
      });

      const quota = internal.inspectNotifyQuota({
        contextId: "ctx-room-background-notify",
        sourceId: createMessageSrc("room-background", 401),
        focusState: "background",
      });

      expect(quota.focusState).toBe("background");
      expect(quota.effective.windowMs).toBe(30 * 60 * 1_000);
      expect(quota.remaining.allowedNow).toBe(false);
      expect(quota.history).toHaveLength(1);
      expect(quota.history[0]).toMatchObject({
        contextId: "ctx-room-background-notify",
        sourceId: createMessageSrc("room-background", 401),
      });
    } finally {
      await runtime.stop();
    }
  });

  test("Scenario: Given historical push work already reached the model When the context is focused again Then only AttentionContext metadata is injected", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal & {
      handleCommittedAttentionCommit: (
        contextId: string,
        commit: AttentionCommit,
        input: { notifyLoop: boolean },
      ) => Promise<void>;
    };

    await runtime.start();
    await runtime.pause();
    try {
      const channel = await runtime.createMessageChannel({
        kind: "room",
        title: "Background room",
        focus: false,
      });
      const contextId = channel.contextId ?? `ctx-${channel.chatId}`;
      await internal.collectLoopInputs();

      const commit = internal.attentionSystem.commit(contextId, {
        ingressType: "push",
        meta: {
          author: "user:kzf",
          source: "message",
          src: createMessageSrc(channel.chatId, 303),
        },
        scores: { hash_background_focus: 100 },
        summary: "background room has historical work",
        change: { type: "update", value: "background room has historical work" },
      }).commit;
      await internal.handleCommittedAttentionCommit(contextId, commit, { notifyLoop: false });

      await internal.collectLoopInputs();

      await runtime.setChatVisibility({
        chatId: channel.chatId,
        visible: true,
        focused: true,
      });
      const focusInputs = await internal.collectLoopInputs();

      const bootstrap = getBootstrapInput(focusInputs)?.text ?? "";
      expect(bootstrap).toContain("## AttentionContext.focused");
      expect(bootstrap).toContain(contextId);
      expect(bootstrap).toContain("background room has historical work");
      expect(bootstrap).not.toContain("hash_background_focus");
      expect(getItemsInput(focusInputs)).toBeUndefined();
    } finally {
      await runtime.stop();
    }
  });

  test("Scenario: Given the model commits attention through the CLI When the next collection runs Then the commit is context state only and not an item reminder", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal;

    await runtime.start();
    await runtime.pause();
    try {
      await internal.collectLoopInputs();
      const result = await internal.execRootWorkspaceBash({
        command: "attention commit",
        stdin: JSON.stringify({
          contextId: PRIMARY_CONTEXT_ID,
          meta: {
            author: "assistant",
            source: "attention",
          },
          scores: { hash_model_authored: 100 },
          summary: "model-authored attention update",
          change: {
            type: "update",
            value: "model-authored attention update",
            format: "text/plain",
          },
        }),
      });
      expect(result.exitCode).toBe(0);

      const inputs = await internal.collectLoopInputs();
      expect(getItemsInput(inputs)).toBeUndefined();
      expect(getAttentionContextSnapshot(internal, PRIMARY_CONTEXT_ID)?.scoreMap).toEqual({
        hash_model_authored: 100,
      });
    } finally {
      await runtime.stop();
    }
  });

  test("Scenario: Given compact finished with active attention When the next boundary is collected Then focused contexts refresh as context without historical items afterward", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal & {
      handleCommittedAttentionCommit: (
        contextId: string,
        commit: AttentionCommit,
        input: { notifyLoop: boolean },
      ) => Promise<void>;
    };

    await runtime.start();
    await runtime.pause();
    await internal.collectLoopInputs();

    ensureAttentionContext(internal, PRIMARY_CONTEXT_ID);
    const commit = appendAttentionCommit(internal, PRIMARY_CONTEXT_ID, {
      meta: {
        author: "user:kzf",
        source: "message",
        src: createMessageSrc(PRIMARY_ROOM_ID, 404),
      },
      scores: { hash_compact_boundary: 100 },
      title: "Keep this unresolved",
    });
    await internal.handleCommittedAttentionCommit(PRIMARY_CONTEXT_ID, commit, { notifyLoop: false });
    const firstBatch = await internal.collectLoopInputs();

    await internal.persistCycle({ wakeSource: "user", inputs: firstBatch ?? [] });
    runtime.pushUserChat("/compact");
    const compactInputs = await internal.collectLoopInputs();
    await internal.persistCycle({ wakeSource: "user", inputs: compactInputs ?? [] });
    await internal.handleModelCall({
      id: "compact-boundary-call",
      timestamp: 100,
      completedAt: 101,
      status: "done",
      provider: "openai",
      model: "gpt-5.4",
      request: { messages: [] },
      response: { decision: { kind: "compact" } },
      outcome: { code: "done" },
    });

    (internal as RuntimeInternal & { requestAttentionContextBoundaryRefresh: () => void }).requestAttentionContextBoundaryRefresh();
    const boundaryInputs = internal.collectAttentionInputs();
    expect(getBootstrapInput(boundaryInputs)?.text).toContain("## AttentionContext.focused");
    expect(getBootstrapInput(boundaryInputs)?.text).toContain(PRIMARY_CONTEXT_ID);
    expect(getItemsInput(boundaryInputs)).toBeUndefined();

    await runtime.stop();
  });

  test("Scenario: Given focused contexts with seeded snapshots When collectLoopInputs runs Then one context can choose items while another chooses context in the same batch", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal & {
      buildFocusedAttentionContextText: (match: AttentionActiveContextMatch) => string;
      buildAttentionItemsPlan: (
        match: AttentionActiveContextMatch,
      ) => {
        kind: "items";
        text: string;
      } | null;
      attentionContextSnapshot: Map<
        string,
        {
          contextId: string;
          kind: "context" | "items";
          text: string;
          headCommitId: string | null;
          updatedAt: string;
          seededFocusState?: "focused" | "background";
        }
      >;
    };

    internal.attentionSystem.createContext({ contextId: "ctx-terminal-mixed", owner: "avatar:tester", focusState: "focused" });
    const primarySeedCommit = appendAttentionCommit(internal, PRIMARY_CONTEXT_ID, {
      meta: {
        author: "user:kzf",
        source: "message",
        src: createMessageSrc(PRIMARY_ROOM_ID, 790),
      },
      scores: { hash_primary_seed: 100 },
      title: "primary seed",
      detail: {
        kind: "replace",
        value: "primary seed",
        format: "text/plain",
      },
    });
    await internal.handleCommittedAttentionCommit(PRIMARY_CONTEXT_ID, primarySeedCommit, { notifyLoop: false });
    const primarySeedMatch = internal.attentionSystem.listActiveContexts().find((match) => match.contextId === PRIMARY_CONTEXT_ID);

    const terminalSeedCommit = appendAttentionCommit(internal, "ctx-terminal-mixed", {
      meta: {
        author: "terminal:mixed",
        source: "terminal",
        src: createTerminalSrc("mixed"),
      },
      scores: { hash_terminal_mixed: 100 },
      title: "terminal seed",
      detail: {
        kind: "replace",
        value: "terminal seed",
        format: "text/plain",
      },
    });
    await internal.handleCommittedAttentionCommit("ctx-terminal-mixed", terminalSeedCommit, { notifyLoop: false });
    const terminalSeedMatch = internal.attentionSystem
      .listActiveContexts()
      .find((match) => match.contextId === "ctx-terminal-mixed");
    if (!primarySeedMatch || !terminalSeedMatch) {
      throw new Error("expected seeded active attention contexts");
    }

    internal.attentionContextSnapshot.set(PRIMARY_CONTEXT_ID, {
      contextId: PRIMARY_CONTEXT_ID,
      kind: "context",
      text: internal.buildFocusedAttentionContextText(primarySeedMatch),
      headCommitId: primarySeedMatch.context.headCommitId,
      updatedAt: primarySeedMatch.context.updatedAt,
      seededFocusState: "focused",
    });
    internal.attentionContextSnapshot.set("ctx-terminal-mixed", {
      contextId: "ctx-terminal-mixed",
      kind: "context",
      text: internal.buildFocusedAttentionContextText(terminalSeedMatch),
      headCommitId: terminalSeedMatch.context.headCommitId,
      updatedAt: terminalSeedMatch.context.updatedAt,
      seededFocusState: "focused",
    });
    internal.dirtyAttentionContextIds.clear();
    internal.dirtyAttentionCommitIdsByContext.clear();

    for (const [index, messageId] of [801, 802, 803, 804, 805, 806].entries()) {
      const primaryUpdateCommit = appendAttentionCommit(internal, PRIMARY_CONTEXT_ID, {
        meta: {
          author: "user:kzf",
          source: "message",
          src: createMessageSrc(PRIMARY_ROOM_ID, messageId),
        },
        scores: { [`hash_primary_mixed_${index}`]: 100 },
        title: `primary update ${index + 1}`,
        detail: {
          kind: "replace",
          value: `primary update ${index + 1}: keep this room context synchronized with the latest visible factual detail and preserve the full rolling room state for later reasoning across multiple related facts in a single shared context.`,
          format: "text/plain",
        },
      });
      await internal.handleCommittedAttentionCommit(PRIMARY_CONTEXT_ID, primaryUpdateCommit, { notifyLoop: false });
    }

    for (const [index, eventId] of Array.from({ length: 24 }, (_, offset) => offset + 11).entries()) {
      const terminalUpdateCommit = appendAttentionCommit(internal, "ctx-terminal-mixed", {
        meta: {
          author: "terminal:mixed",
          source: "terminal",
          src: createTerminalSrc("mixed", eventId),
        },
        scores: { [`hash_terminal_mixed_${index}`]: 100 },
        title: `terminal blocked ${index + 1}`,
        detail: {
          kind: "replace",
          value: `terminal blocked ${index + 1}: interactive shell is waiting on a multi-step authentication checklist and the model should retain the broader terminal state summary instead of replaying many granular commits.`,
          format: "text/plain",
        },
      });
      await internal.handleCommittedAttentionCommit("ctx-terminal-mixed", terminalUpdateCommit, { notifyLoop: false });
    }

    const activeMatches = internal.attentionSystem.listActiveContexts();
    const primaryMatch = activeMatches.find((match) => match.contextId === PRIMARY_CONTEXT_ID);
    const terminalMatch = activeMatches.find((match) => match.contextId === "ctx-terminal-mixed");
    expect(primaryMatch).toBeDefined();
    expect(terminalMatch).toBeDefined();
    if (!primaryMatch || !terminalMatch) {
      return;
    }
    const primaryContextText = internal.buildFocusedAttentionContextText(primaryMatch);
    const terminalContextText = internal.buildFocusedAttentionContextText(terminalMatch);
    const primaryItemsText = internal.buildAttentionItemsPlan(primaryMatch)?.text ?? "";
    const terminalItemsText = internal.buildAttentionItemsPlan(terminalMatch)?.text ?? "";
    const expectedPrimaryKind = primaryContextText.length * 1.5 <= primaryItemsText.length ? "context" : "items";
    const expectedTerminalKind = terminalContextText.length * 1.5 <= terminalItemsText.length ? "context" : "items";

    const mixedBatch = await internal.collectLoopInputs();
    const primaryPlan = mixedBatch?.find((item) => item.meta?.attentionContextId === PRIMARY_CONTEXT_ID);
    const terminalPlan = mixedBatch?.find((item) => item.meta?.attentionContextId === "ctx-terminal-mixed");
    expect(primaryPlan).toBeDefined();
    expect(terminalPlan).toBeDefined();
    if (!primaryPlan || !terminalPlan) {
      return;
    }
    expect(expectedPrimaryKind).not.toBe(expectedTerminalKind);
    expect(primaryPlan.meta?.attentionProtocolKind).toBe(expectedPrimaryKind);
    expect(terminalPlan.meta?.attentionProtocolKind).toBe(expectedTerminalKind);
    expect(primaryPlan.text).not.toContain("focusState:");
    expect(primaryPlan.text).not.toContain("scoreMap:");
    expect(primaryPlan.text).not.toContain("scores:");
    expect(terminalPlan.text).not.toContain("focusState:");
    expect(terminalPlan.text).not.toContain("scoreMap:");
    expect(terminalPlan.text).not.toContain("scores:");
  });

  test("Scenario: Given chat attention arrives while another context is already dirty When collectLoopInputs runs Then higher-priority chat context is emitted before the older terminal context in the same round", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal;
    internal.loopPluginRuntime = await internal.createLoopPluginRuntime();

    internal.attentionSystem.createContext({ contextId: "ctx-terminal-iflow", owner: "avatar:tester" });
    const terminalCommit = appendAttentionCommit(internal, "ctx-terminal-iflow", {
      meta: {
        author: "terminal:iflow",
        source: "terminal",
        src: createTerminalSrc("iflow"),
      },
      scores: { hash_terminal: 100 },
      title: "Terminal iflow is waiting for auth",
    });
    await internal.handleCommittedAttentionCommit("ctx-terminal-iflow", terminalCommit, { notifyLoop: false });

    runtime.pushUserChat("Reply with exactly FOCUS-CHAT-FIRST");

    const firstRound = await internal.collectLoopInputs();
    expect(getAttentionProtocolKinds(firstRound)).toEqual(["context", "context"]);
    expect(firstRound?.[0]?.meta?.attentionContextId).toBe(PRIMARY_CONTEXT_ID);
    expect(firstRound?.[1]?.meta?.attentionContextId).toBe("ctx-terminal-iflow");

    const secondRound = await internal.collectLoopInputs();
    expect(secondRound).toBeUndefined();
  });

  test("Scenario: Given a skill reminder becomes dirty while room and terminal work are already active When collectLoopInputs runs Then the runtime keeps skill churn out of the current task round", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal & {
      ensureRuntimeSkillSystem: () => RuntimeSkillSystem;
      handleRuntimeSkillRefreshResult: (
        result: ReturnType<RuntimeSkillSystem["refresh"]>,
        input: { notifyLoop: boolean },
      ) => Promise<unknown>;
    };
    internal.loopPluginRuntime = await internal.createLoopPluginRuntime();

    const rootWorkspacePath = (Reflect.get(runtime, "options") as { rootWorkspacePath: string }).rootWorkspacePath;
    const skillDir = join(rootWorkspacePath, "skills", "skill-churn");
    await mkdir(skillDir, { recursive: true });
    await writeFile(
      join(skillDir, "SKILL.md"),
      ["---", "name: skill-churn", "description: runtime skill churn proof", "---", "", "# skill-churn", "", "Version one.", ""].join(
        "\n",
      ),
      "utf8",
    );
    const skillSystem = internal.ensureRuntimeSkillSystem();
    await internal.handleRuntimeSkillRefreshResult(
      skillSystem.refresh({ publishReminders: false }),
      { notifyLoop: false },
    );
    await internal.collectLoopInputs();

    const terminalContextId = "ctx-terminal-skill-churn";
    internal.attentionSystem.createContext({ contextId: terminalContextId, owner: "avatar:tester" });
    const terminalCommit = appendAttentionCommit(internal, terminalContextId, {
      meta: {
        author: "terminal:skill-churn",
        source: "terminal",
        src: createTerminalSrc("skill-churn"),
      },
      scores: { hash_terminal: 100 },
      title: "Terminal skill-churn is waiting for the next command",
    });
    await internal.handleCommittedAttentionCommit(terminalContextId, terminalCommit, { notifyLoop: false });

    runtime.pushUserChat("Reply with exactly ROOM-FIRST");

    await writeFile(
      join(skillDir, "SKILL.md"),
      ["---", "name: skill-churn", "description: runtime skill churn proof", "---", "", "# skill-churn", "", "Version two.", ""].join(
        "\n",
      ),
      "utf8",
    );
    await internal.handleRuntimeSkillRefreshResult(
      skillSystem.refresh({ publishReminders: true }),
      { notifyLoop: false },
    );

    const firstRound = await internal.collectLoopInputs();
    expect(firstRound).toHaveLength(2);
    expect(firstRound?.map((item) => item.meta?.attentionContextId)).toEqual([PRIMARY_CONTEXT_ID, terminalContextId]);
    expect(firstRound?.some((item) => item.meta?.attentionContextId === "ctx-workspace-runtime")).toBeFalse();
    expect((firstRound ?? []).map((item) => item.text).join("\n")).not.toContain("Updated runtime skill skill-churn");

    const secondRound = await internal.collectLoopInputs();
    expect(secondRound?.some((item) => item.meta?.attentionContextId === "ctx-workspace-runtime")).toBeTrue();
    expect((secondRound ?? []).map((item) => item.text).join("\n")).toContain("Updated runtime skill skill-churn");
  });

  test("Scenario: Given an attention round makes no progress When the final model call is recorded Then the affected context enters backoff before the next retry", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal;

    ensureAttentionContext(internal, PRIMARY_CONTEXT_ID);
    const chatCommit = appendAttentionCommit(internal, PRIMARY_CONTEXT_ID, {
      meta: {
        author: "User",
        source: "message",
        src: createMessageSrc(PRIMARY_ROOM_ID, 1),
      },
      scores: { hash_chat: 100 },
      title: "Reply with exactly REAL-AI-OK",
    });
    await internal.handleCommittedAttentionCommit(PRIMARY_CONTEXT_ID, chatCommit, { notifyLoop: false });

    try {
      const firstRound = await internal.collectLoopInputs();
      const attentionInput = getBootstrapInput(firstRound);
      expect(attentionInput?.meta?.attentionContextId).toBe(PRIMARY_CONTEXT_ID);
      if (!firstRound || !attentionInput) {
        return;
      }

      await runtime.start();
      await runtime.pause();
      await internal.persistCycle({ wakeSource: "user", inputs: firstRound });
      await internal.handleModelCall({
        id: "call-no-progress",
        timestamp: 100,
        completedAt: 101,
        status: "error",
        provider: "openai",
        model: "gpt-5.4",
        request: { messages: [{ role: "user", content: attentionInput.text }] },
        error: { message: "attention round made no progress" },
        outcome: {
          code: "error",
          reason: "attention.no_progress",
          retryable: false,
        },
      });

      expect(internal.dirtyAttentionContextIds.has(PRIMARY_CONTEXT_ID)).toBe(false);
      expect(internal.attentionContainment.get(PRIMARY_CONTEXT_ID)).toMatchObject({
        retryCount: 1,
      });
      const containment = internal.attentionContainment.get(PRIMARY_CONTEXT_ID);
      expect(typeof containment?.nextWakeAt).toBe("number");
      if (containment) {
        containment.nextWakeAt = Date.now() - 1;
      }

      await internal.waitForAnyInput();
    } finally {
      await runtime.stop();
    }
  });

  test("Scenario: Given a runtime snapshot When chat bootstrap data is read Then message-channel descriptors are embedded alongside attention state", async () => {
    const runtime = createRuntime();
    const channel = await runtime.createMessageChannel({
      kind: "room",
      title: "Room 2",
      focus: false,
    });

    const snapshot = runtime.snapshot();

    expect(snapshot.messageChannels?.map((entry) => entry.chatId)).toEqual([PRIMARY_ROOM_ID, channel.chatId]);
    expect(snapshot.messageChannels?.find((entry) => entry.chatId === PRIMARY_ROOM_ID)?.focused).toBe(true);
    expect(snapshot.messageChannels?.find((entry) => entry.chatId === channel.chatId)?.contextId).toBe(
      `ctx-${channel.chatId}`,
    );
  });

  test("Scenario: Given multiple active attention inputs from different chats When reply routing resolves Then the newest originating chat wins", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal;

    expect(
      internal.resolveCycleReplyChatId([
        {
          name: "Attention-ctx-chat-main",
          role: "user",
          type: "text",
          source: "attention",
          text: "main",
          meta: {
            chatId: PRIMARY_ROOM_ID,
            createdAt: "2026-03-24T10:00:00.000Z",
          },
        },
        {
          name: "Attention-ctx-chat-2",
          role: "user",
          type: "text",
          source: "attention",
          text: "chat-2",
          meta: {
            chatId: "chat-chat-2",
            createdAt: "2026-03-24T10:00:05.000Z",
          },
        },
      ]),
    ).toBe("chat-chat-2");
  });

  test("Scenario: Given compact command When pushUserChat('/compact') Then runtime emits a compact attention input without creating room attention debt", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal;

    runtime.pushUserChat("/compact");

    expect((internal as RuntimeInternal & { hasPendingCompactCycle: () => boolean }).hasPendingCompactCycle()).toBe(
      true,
    );
    expect(getActiveItems(internal)).toHaveLength(0);

    const outputs = await internal.collectLoopInputs();
    expect(outputs).toHaveLength(1);
    expect(outputs?.[0]?.source).toBe("attention");
    expect(JSON.parse(outputs?.[0]?.text ?? "{}")).toMatchObject({
      kind: "compact-cycle",
      trigger: "manual",
    });
    expect(outputs?.[0]?.meta?.cycleKind).toBe("compact");
    expect(outputs?.[0]?.meta?.compactTrigger).toBe("manual");
    expect(outputs?.[0]?.meta?.exclusiveCycle).toBe(true);
  });

  test("Scenario: Given bootstrap attention and a later compact cycle When cycles persist Then normal rounds keep context refs and compact rounds stay distinguishable without bogus item refs", async () => {
    const root = mkdtempSync(join(tmpdir(), "agenter-session-runtime-attention-cycle-"));
    const sessionRoot = join(root, "session");
    const runtime = new SessionRuntime({
      sessionId: `s-attention-cycle-${Date.now()}`,
      cwd: root,
      sessionRoot,
      sessionName: "attention-cycle",
      storeTarget: "workspace",
      primaryRoomId: PRIMARY_ROOM_ID,
      allocateRoomId: createRuntimeRoomAllocator(),
      terminalSystem: createTerminalSystem(root),
      resolveRuntimeTerminalCwd: async (input) => ({
        ok: true,
        cwd: input.cwd ?? root,
      }),
    });
    attachPrimaryRoom(runtime);
    const internal = runtime as unknown as RuntimeInternal;
    internal.loopPluginRuntime = await internal.createLoopPluginRuntime();

    runtime.pushUserChat("Please continue the task");
    const firstRound = await internal.collectLoopInputs();
    if (!firstRound) {
      throw new Error("expected first attention batch");
    }

    await runtime.start();
    await runtime.pause();
    const firstPersisted = await internal.persistCycle({ wakeSource: "user", inputs: firstRound });

    runtime.pushUserChat("/compact");
    const compactRound = await internal.collectLoopInputs();
    if (!compactRound) {
      throw new Error("expected compact batch");
    }
    const compactPersisted = await internal.persistCycle({ wakeSource: "user", inputs: compactRound });

    const persistedCycles = runtime.pageCurrentBranchCycles({ limit: 20 }).items;
    const firstCycle = persistedCycles.find((cycle) => cycle.id === firstPersisted.cycleId);
    const compactCycle = persistedCycles.find((cycle) => cycle.id === compactPersisted.cycleId);
    const firstFrame = firstCycle?.extendsRecord.attentionCycleFrame as
      | {
          protocolMode?: string;
          inputContextIds?: string[];
          inputCommitRefs?: Array<{ contextId: string; commitId: string }>;
        }
      | undefined;
    const compactFrame = compactCycle?.extendsRecord.attentionCycleFrame as
      | {
          protocolMode?: string;
          inputContextIds?: string[];
          inputCommitRefs?: Array<{ contextId: string; commitId: string }>;
        }
      | undefined;
    expect(firstFrame).toMatchObject({
      protocolMode: "bootstrap",
      inputContextIds: [PRIMARY_CONTEXT_ID],
    });
    expect(firstFrame?.inputCommitRefs).toHaveLength(1);
    expect(firstFrame?.inputCommitRefs?.[0]).toMatchObject({
      contextId: PRIMARY_CONTEXT_ID,
      commitId: expect.any(String),
    });
    expect(compactFrame).toMatchObject({
      protocolMode: "compact",
    });
    expect(compactFrame?.inputContextIds).toEqual([]);
    expect(compactFrame?.inputCommitRefs).toEqual([]);

    await runtime.stop();
  });

  test("Scenario: Given a fresh user message When the next collect batch runs Then the focused AttentionContext carries the message while active attention only appears after collection", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal;
    internal.loopPluginRuntime = await internal.createLoopPluginRuntime();

    runtime.pushUserChat("What time is it?");

    expect(getActiveItems(internal)).toHaveLength(0);

    const firstRound = await internal.collectLoopInputs();
    expect(getBootstrapInput(firstRound)).toBeDefined();
    expect(getBootstrapInput(firstRound)?.text).toContain("What time is it?");
    expect(getActiveItems(internal)).toHaveLength(1);
    expect(getActiveItems(internal)[0]?.detail?.value).toContain("What time is it?");
  });

  test("Scenario: Given an Avatar-owned room context When a user message is ingested Then message attention preserves the context summary", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal;
    internal.loopPluginRuntime = await internal.createLoopPluginRuntime();
    appendAttentionCommit(internal, PRIMARY_CONTEXT_ID, {
      meta: { author: "avatar:tester", source: "attention" },
      scores: {},
      title: "Avatar summary",
      detail: {
        kind: "replace",
        value: "Avatar topic summary: discussing release readiness",
        format: "text/plain",
      },
    });

    runtime.pushUserChat("Can you summarize what changed?");
    await internal.collectLoopInputs();

    const activeMessageItem = getActiveItems(internal).find((item) => item.meta.source === "message");
    expect(activeMessageItem?.detail?.value).toContain("Can you summarize what changed?");
    expect(getAttentionContextSnapshot(internal, PRIMARY_CONTEXT_ID)?.content).toBe(
      "Avatar topic summary: discussing release readiness",
    );
  });

  test("Scenario: Given runtime-generated attention scores When semantic ingress commits Then score keys use short hash aliases instead of semantic labels", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal;
    internal.loopPluginRuntime = await internal.createLoopPluginRuntime();

    runtime.pushUserChat("Please continue the task");
    await internal.collectLoopInputs();

    const commit = getActiveCommits(internal)[0];
    expect(commit).toBeDefined();
    const scoreKeys = Object.keys(commit?.scores ?? {});
    expect(scoreKeys.length).toBeGreaterThan(0);
    expect(scoreKeys.every((key) => /^[0-9a-f]{6,64}$/.test(key))).toBe(true);
    expect(scoreKeys.some((key) => key.includes(":"))).toBe(false);
  });

  test("Scenario: Given legacy terminal attention metadata When the runtime serializes a focused terminal context for the model Then giant fingerprint blobs are compacted into short hash previews", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal;

    internal.attentionSystem.createContext({ contextId: "ctx-terminal-iflow", owner: "avatar:tester" });
    const hugeFingerprint = JSON.stringify({
      cols: 80,
      rows: 24,
      lines: Array.from({ length: 24 }, () => " ".repeat(80)),
      richLines: Array.from({ length: 24 }, () => ({
        spans: [{ text: " ".repeat(80), bold: false, underline: false, inverse: false }],
      })),
    });
    const commit = appendAttentionCommit(internal, "ctx-terminal-iflow", {
      meta: {
        author: "terminal:iflow",
        source: "terminal",
        src: createTerminalSrc("iflow"),
      },
      scores: { abc123: 100 },
      title: "Terminal iflow diff updated",
      detail: {
        kind: "patch",
        value: "```diff\n+ ready\n```",
        format: "text/markdown",
      },
    });
    await internal.handleCommittedAttentionCommit("ctx-terminal-iflow", commit, { notifyLoop: false });

    const batch = await internal.collectLoopInputs();
    const attentionInput = getBootstrapInput(batch);
    expect(attentionInput).toBeDefined();
    if (!attentionInput) {
      return;
    }

    expect(attentionInput.text).toContain("## AttentionContext.focused");
    expect(attentionInput.text).not.toContain("richLines");
    expect(attentionInput.text.length).toBeLessThan(4_000);
  });

  test("Scenario: Given a resolved-only attention item When querying without minScore override Then score-zero rows stay filtered out", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal;

    ensureAttentionContext(internal, PRIMARY_CONTEXT_ID);
    appendAttentionCommit(internal, PRIMARY_CONTEXT_ID, {
      meta: {
        author: "avatar:tester",
        source: "attention",
      },
      scores: { a1b2c3: 0 },
      title: "resolved reply",
    });

    expect(await runtime.queryAttention({})).toHaveLength(0);
    expect(await runtime.queryAttention({ query: "minscore:0" })).toHaveLength(1);
  });

  test("Scenario: Given a later attention commit clears the same hash When runtime collects active debt Then the older unresolved item becomes history instead of active work", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal;

    ensureAttentionContext(internal, PRIMARY_CONTEXT_ID);
    appendAttentionCommit(internal, PRIMARY_CONTEXT_ID, {
      meta: {
        author: "User",
        source: "message",
        src: createMessageSrc(PRIMARY_ROOM_ID, 1),
      },
      scores: { hash1: 100 },
      title: "你好",
    });
    appendAttentionCommit(internal, PRIMARY_CONTEXT_ID, {
      meta: {
        author: "avatar:tester",
        source: "attention",
      },
      scores: { hash1: 0 },
      title: "Respond to user greeting",
      preserveContext: true,
    });

    expect(getActiveCommits(internal)).toHaveLength(0);
    expect(await runtime.queryAttention({})).toHaveLength(0);
    expect(await runtime.queryAttention({ query: "minscore:0" })).toHaveLength(2);
  });

  test("Scenario: Given unresolved attention debt When no new external input arrives Then the runtime self-wakes and re-collects attention", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal;
    internal.loopPluginRuntime = await internal.createLoopPluginRuntime();
    internal.attentionDebtBackoffMs = 5;

    runtime.pushUserChat("keep working until this is solved");
    const firstBatch = await internal.collectLoopInputs();
    expect(firstBatch?.some((item) => item.source === "attention")).toBe(true);

    const wake = await internal.waitForAnyInput();
    expect(wake).toBe("attention");

    const secondBatch = await internal.collectLoopInputs();
    expect(secondBatch?.some((item) => item.source === "attention")).toBe(true);
  });

  test("Scenario: Given repeated equivalent provider failures When containment is tracked Then the runtime keeps retrying through exponential backoff", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal;
    internal.loopPluginRuntime = await internal.createLoopPluginRuntime();

    runtime.pushUserChat("keep trying");
    const firstBatch = await internal.collectLoopInputs();
    const attentionInput = getBootstrapInput(firstBatch);
    expect(attentionInput?.meta?.attentionContextId).toBe(PRIMARY_CONTEXT_ID);
    if (!firstBatch || !attentionInput || typeof attentionInput.meta?.attentionContextId !== "string") {
      return;
    }

    await runtime.start();
    await runtime.pause();
    await internal.persistCycle({ wakeSource: "user", inputs: firstBatch });

    await internal.handleModelCall({
      id: "call-provider-error-1",
      timestamp: 100,
      completedAt: 101,
      status: "error",
      provider: "openai",
      model: "gpt-5.4",
      request: { messages: [{ role: "user", content: attentionInput.text }] },
      error: { name: "ProviderError", message: "upstream unavailable" },
      outcome: {
        code: "error",
        reason: "provider.unavailable",
        message: "upstream unavailable",
        retryable: true,
      },
    });

    const firstContainment = internal.attentionContainment.get(PRIMARY_CONTEXT_ID);
    expect(firstContainment?.retryCount).toBe(1);
    if (firstContainment) {
      firstContainment.nextWakeAt = Date.now() - 1;
    }

    await internal.waitForAnyInput();
    await internal.persistCycle({ wakeSource: "attention", inputs: [attentionInput] });

    await internal.handleModelCall({
      id: "call-provider-error-2",
      timestamp: 200,
      completedAt: 201,
      status: "error",
      provider: "openai",
      model: "gpt-5.4",
      request: { messages: [{ role: "user", content: attentionInput.text }] },
      error: { name: "ProviderError", message: "upstream unavailable" },
      outcome: {
        code: "error",
        reason: "provider.unavailable",
        message: "upstream unavailable",
        retryable: true,
      },
    });

    expect(internal.attentionContainment.get(PRIMARY_CONTEXT_ID)).toMatchObject({
      retryCount: 2,
    });
    const secondContainment = internal.attentionContainment.get(PRIMARY_CONTEXT_ID);
    expect(typeof secondContainment?.nextWakeAt).toBe("number");
    if (secondContainment) {
      secondContainment.nextWakeAt = Date.now() - 1;
    }

    await internal.waitForAnyInput();
  });

  test("Scenario: Given retry policy caps equivalent failures When the cap is reached Then the runtime publishes blocked recovery instead of rearming backoff", async () => {
    const root = mkdtempSync(join(tmpdir(), "agenter-session-runtime-policy-"));
    await mkdir(join(root, ".agenter"), { recursive: true });
    await writeFile(
      join(root, ".agenter", "settings.json"),
      `${JSON.stringify(
        {
          ai: {
            activeProvider: "default",
            providers: {
              default: {
                kind: "deepseek",
                apiKeyEnv: "DEEPSEEK_API_KEY",
                model: "deepseek-chat",
                baseUrl: "https://api.deepseek.com/v1",
                maxRetries: 2,
              },
            },
          },
          loop: {
            retryPolicy: {
              maxAttempts: 2,
              initialBackoffMs: 900,
              multiplier: 3,
              maxBackoffMs: 4000,
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const runtime = new SessionRuntime({
      sessionId: `s-policy-${Date.now()}`,
      cwd: root,
      sessionRoot: join(root, "session"),
      sessionName: "policy-test",
      storeTarget: "workspace",
      primaryRoomId: PRIMARY_ROOM_ID,
      allocateRoomId: createRuntimeRoomAllocator(),
      terminalSystem: createTerminalSystem(root),
      avatarPrincipalId: TEST_AVATAR_PRINCIPAL_ID,
      avatarPrivateKey: TEST_AVATAR_PRIVATE_KEY,
      homeDir: root,
      rootWorkspacePath: root,
      resolveRuntimeTerminalCwd: async (input) => ({
        ok: true,
        cwd: input.cwd ?? root,
      }),
    });
    attachPrimaryRoom(runtime);

    const internal = runtime as unknown as RuntimeInternal;
    internal.loopPluginRuntime = await internal.createLoopPluginRuntime();

    runtime.pushUserChat("keep retrying");
    const firstBatch = await internal.collectLoopInputs();
    const attentionInput = getBootstrapInput(firstBatch);
    expect(attentionInput?.meta?.attentionContextId).toBe(PRIMARY_CONTEXT_ID);
    if (!firstBatch || !attentionInput || typeof attentionInput.meta?.attentionContextId !== "string") {
      return;
    }

    try {
      await runtime.start();
      await runtime.pause();
      await internal.persistCycle({ wakeSource: "user", inputs: firstBatch });

      const firstFailureAt = Date.now();
      await internal.handleModelCall({
        id: "call-policy-error-1",
        timestamp: 100,
        completedAt: 101,
        status: "error",
        provider: "openai",
        model: "gpt-5.4",
        request: { messages: [{ role: "user", content: attentionInput.text }] },
        error: { name: "ProviderError", message: "upstream unavailable" },
        outcome: {
          code: "error",
          reason: "provider.unavailable",
          message: "upstream unavailable",
          retryable: true,
        },
      });

      const firstContainment = internal.attentionContainment.get(PRIMARY_CONTEXT_ID);
      expect(firstContainment?.retryCount).toBe(1);
      const firstBackoffMs = (firstContainment?.nextWakeAt ?? firstFailureAt) - firstFailureAt;
      expect(firstBackoffMs).toBeGreaterThanOrEqual(700);
      expect(firstBackoffMs).toBeLessThanOrEqual(1400);
      if (firstContainment) {
        firstContainment.nextWakeAt = Date.now() - 1;
      }

      await internal.waitForAnyInput();
      await internal.persistCycle({ wakeSource: "attention", inputs: [attentionInput] });

      await internal.handleModelCall({
        id: "call-policy-error-2",
        timestamp: 200,
        completedAt: 201,
        status: "error",
        provider: "openai",
        model: "gpt-5.4",
        request: { messages: [{ role: "user", content: attentionInput.text }] },
        error: { name: "ProviderError", message: "upstream unavailable" },
        outcome: {
          code: "error",
          reason: "provider.unavailable",
          message: "upstream unavailable",
          retryable: true,
        },
      });

      expect(internal.attentionContainment.get(PRIMARY_CONTEXT_ID)).toMatchObject({
        retryCount: 2,
      });
      expect(runtime.snapshot().schedulerState).toMatchObject({
        runtimeStatus: "blocked",
        waitingReason: "attention_blocked",
      });
      expect(runtime.snapshot().schedulerState?.blockedReason).toContain("2/2");
    } finally {
      await runtime.stop();
    }
  });

  test("Scenario: Given all attention scores are zero When no external input arrives Then the runtime does not self-wake again", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal;
    internal.loopPluginRuntime = await internal.createLoopPluginRuntime();
    internal.attentionDebtBackoffMs = 5;

    runtime.pushUserChat("resolve this and stay quiet after");
    await internal.collectLoopInputs();

    const [match] = getActiveMatches(internal);
    expect(match).toBeDefined();
    if (!match) {
      return;
    }
    appendAttentionCommit(internal, match.contextId, {
      meta: {
        author: "avatar:tester",
        source: "attention",
      },
      scores: Object.fromEntries(Object.keys(match.context.scoreMap).map((key) => [key, 0])),
      title: "resolve and stay quiet",
      preserveContext: true,
    });

    const pendingWake = internal.waitForAnyInput();
    const winner = await Promise.race([
      pendingWake.then((kind) => ({ kind })),
      new Promise<{ kind: "timeout" }>((resolve) => setTimeout(() => resolve({ kind: "timeout" }), 30)),
    ]);
    expect(winner.kind).toBe("timeout");

    internal.notifyInput("user");
    expect(await pendingWake).toBe("user");
  });

  test("Scenario: Given legacy chat-system store When runtime starts Then files migrate to attention-system and records are restored", async () => {
    const root = mkdtempSync(join(tmpdir(), "agenter-session-runtime-migrate-"));
    const sessionRoot = join(root, "session");
    const legacyDir = join(sessionRoot, "chat-system");
    const nextDir = join(sessionRoot, "attention-system");
    await mkdir(legacyDir, { recursive: true });
    await writeFile(
      join(legacyDir, "state.json"),
      JSON.stringify({
        nextId: 2,
        records: [
          {
            id: 1,
            content: "legacy attention",
            from: "user",
            score: 100,
            remark: "",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      }),
      "utf8",
    );

    const runtime = new SessionRuntime({
      sessionId: `s-${Date.now()}`,
      cwd: root,
      sessionRoot,
      sessionName: "migrate",
      storeTarget: "workspace",
      primaryRoomId: PRIMARY_ROOM_ID,
      terminalSystem: createTerminalSystem(root),
    });

    await runtime.start();
    const internal = runtime as unknown as RuntimeInternal;
    expect(getActiveItems(internal)).toHaveLength(1);
    await runtime.stop();

    await access(join(nextDir, "state.json"));
    const migrated = JSON.parse(await readFile(join(nextDir, "state.json"), "utf8")) as {
      version: number;
      contexts: Array<{ commits: Array<{ summary: string }> }>;
    };
    expect(migrated.version).toBe(8);
    expect(migrated.contexts[0]?.commits[0]?.summary).toBe("legacy attention");
  });

  test("Scenario: Given a plugin runtime-backed user message When room ingress drains through the message adapter Then the message is committed before cycle gating", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal;

    internal.loopPluginRuntime = await internal.createLoopPluginRuntime();
    runtime.pushUserChat("plugin-backed message");
    await internal.collectUnreadRoomIngress();
    await internal.collectUnreadRoomIngress();
    const changed = await internal.flushPluginAttentionDrafts();
    expect(changed).toBe(false);
    const facts = getActiveItems(internal);
    expect(facts).toHaveLength(1);
    expect(facts[0]?.title).toBe("plugin-backed message");
    expect(facts[0]?.meta.author).toBe("User");
  });

  test("Scenario: Given a focused terminal invalidation When plugin attention drafts flush Then terminal output is committed into attention history without active debt", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal;

    internal.config = {
      terminals: {
        iflow: {
          terminalId: "iflow",
          cwd: "/tmp",
          command: ["bash"],
          commandLabel: "bash",
          gitLog: false,
        },
      },
    };
    internal.terminals.set("iflow", {
      isRunning: () => true,
      getSnapshot: () => ({
        seq: 7,
        cols: 80,
        rows: 24,
        cursor: { x: 0, y: 23 },
        lines: ["echo ready"],
        scrollback: {
          viewportOffset: 0,
          totalLines: 24,
          screenLines: 24,
        },
      }),
      getStatus: () => "IDLE",
      sliceDirty: async () => ({
        ok: true,
        changed: false,
        fromHash: null,
        toHash: null,
        diff: "",
        bytes: 0,
      }),
    });
    internal.focusedTerminalIds = ["iflow"];
    internal.loopPluginRuntime = await internal.createLoopPluginRuntime();
    internal.loopPluginRuntime.invalidate({
      src: createTerminalSrc("iflow", 7),
      reason: "semantic-change",
      versionHint: 7,
    });

    const changed = await internal.flushPluginAttentionDrafts();
    expect(changed).toBe(true);
    const facts = internal.attentionSystem.query({ minScore: 0, text: "Terminal iflow" });
    expect(facts).toHaveLength(1);
    expect(getActiveItems(internal)).toHaveLength(0);
    expect(facts[0]?.commit.meta.author).toBe("terminal:iflow");
    expect(facts[0]?.commit.summary).toBe("Terminal iflow: echo ready");
    expect(facts[0]?.commit.change.type).toBe("update");
    const snapshotChange = facts[0]?.commit.change;
    expect(snapshotChange?.type).toBe("update");
    if (snapshotChange?.type !== "update") {
      throw new Error("expected update terminal change");
    }
    expect(snapshotChange.format).toBe("text/markdown");
    expect(snapshotChange.value).toContain("```yaml");
    expect(snapshotChange.value).toContain("terminalId: iflow");
    expect(snapshotChange.value).toContain("```text");
  });

  test("Scenario: Given a focused terminal snapshot with no semantic tail When plugin attention drafts flush Then the runtime does not create empty terminal attention debt", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal;

    internal.config = {
      terminals: {
        iflow: {
          terminalId: "iflow",
          cwd: "/tmp",
          command: ["bash"],
          commandLabel: "bash",
        },
      },
    };
    internal.terminals.set("iflow", {
      isRunning: () => true,
      getSnapshot: () => ({
        seq: 8,
        cols: 80,
        rows: 24,
        cursor: { x: 0, y: 0 },
        lines: Array.from({ length: 24 }, () => ""),
        scrollback: {
          viewportOffset: 0,
          totalLines: 24,
          screenLines: 24,
        },
      }),
      getStatus: () => "BUSY",
      sliceDirty: async () => ({
        ok: false,
        changed: false,
        fromHash: null,
        toHash: null,
        diff: "",
        bytes: 0,
      }),
    });
    internal.focusedTerminalIds = ["iflow"];
    internal.loopPluginRuntime = await internal.createLoopPluginRuntime();
    internal.loopPluginRuntime.invalidate({
      src: createTerminalSrc("iflow", 8),
      reason: "semantic-change",
      versionHint: 8,
    });

    const changed = await internal.flushPluginAttentionDrafts();
    expect(changed).toBe(false);
    expect(getActiveItems(internal)).toHaveLength(0);
  });

  test("Scenario: Given a focused terminal diff invalidation When plugin attention drafts flush Then the committed attention history keeps patch semantics without active debt", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal;

    internal.config = {
      terminals: {
        iflow: {
          terminalId: "iflow",
          cwd: "/tmp",
          command: ["bash"],
          commandLabel: "bash",
          gitLog: "normal",
        },
      },
    };
    internal.terminals.set("iflow", {
      isRunning: () => true,
      getSnapshot: () => ({
        seq: 12,
        cols: 80,
        rows: 24,
        cursor: { x: 0, y: 23 },
        lines: Array.from({ length: 24 }, (_, index) => `line-${index}`),
        scrollback: {
          viewportOffset: 0,
          totalLines: 24,
          screenLines: 24,
        },
      }),
      getStatus: () => "IDLE",
      sliceDirty: async () => ({
        ok: true,
        changed: true,
        fromHash: "hash-old",
        toHash: "hash-new",
        diff: "@@ -1 +1 @@\n-prompt\n+after",
        bytes: 28,
      }),
    });
    internal.focusedTerminalIds = ["iflow"];
    internal.loopPluginRuntime = await internal.createLoopPluginRuntime();
    internal.loopPluginRuntime.invalidate({
      src: createTerminalSrc("iflow", 12),
      reason: "semantic-change",
      versionHint: 12,
    });

    const changed = await internal.flushPluginAttentionDrafts();
    expect(changed).toBe(true);

    const facts = internal.attentionSystem.query({ minScore: 0, text: "Terminal iflow diff updated" });
    expect(facts).toHaveLength(1);
    expect(getActiveItems(internal)).toHaveLength(0);
    expect(facts[0]?.commit.summary).toBe("Terminal iflow diff updated");
    expect(facts[0]?.commit.change.type).toBe("diff");
    const diffChange = facts[0]?.commit.change;
    expect(diffChange?.type).toBe("diff");
    if (diffChange?.type !== "diff") {
      throw new Error("expected diff terminal change");
    }
    expect(diffChange.value).toContain("```diff");
  });

  test("Scenario: Given a focused terminal invalidation with unchanged semantic content When plugin drafts flush twice Then no duplicate terminal history delta is committed", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal;

    internal.config = {
      terminals: {
        iflow: {
          terminalId: "iflow",
          cwd: "/tmp",
          command: ["bash"],
          commandLabel: "bash",
          gitLog: false,
        },
      },
    };
    internal.terminals.set("iflow", {
      isRunning: () => true,
      getSnapshot: () => ({
        seq: 8,
        cols: 80,
        rows: 24,
        cursor: { x: 0, y: 23 },
        lines: ["echo ready"],
        scrollback: {
          viewportOffset: 0,
          totalLines: 24,
          screenLines: 24,
        },
      }),
      getStatus: () => "IDLE",
      sliceDirty: async () => ({
        ok: true,
        changed: false,
        fromHash: null,
        toHash: null,
        diff: "",
        bytes: 0,
      }),
    });
    internal.focusedTerminalIds = ["iflow"];
    internal.loopPluginRuntime = await internal.createLoopPluginRuntime();

    internal.loopPluginRuntime.invalidate({
      src: createTerminalSrc("iflow", 8),
      reason: "semantic-change",
      versionHint: 8,
    });
    expect(await internal.flushPluginAttentionDrafts()).toBe(true);
    expect(internal.attentionSystem.query({ minScore: 0, text: "Terminal iflow" })).toHaveLength(1);
    expect(getActiveItems(internal)).toHaveLength(0);

    internal.loopPluginRuntime.invalidate({
      src: createTerminalSrc("iflow", 8),
      reason: "semantic-change",
      versionHint: 8,
    });
    expect(await internal.flushPluginAttentionDrafts()).toBe(false);
    expect(internal.attentionSystem.query({ minScore: 0, text: "Terminal iflow" })).toHaveLength(1);
    expect(getActiveItems(internal)).toHaveLength(0);
  });

  test("Scenario: Given repeated focused terminal observations When a newer terminal draft commits Then older terminal history is superseded while active debt stays zero", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal & {
      terminalSemanticFingerprint: Record<string, string | null | undefined>;
      terminalViewFingerprint: Record<string, string | null | undefined>;
    };

    internal.config = {
      terminals: {
        iflow: {
          terminalId: "iflow",
          cwd: "/tmp",
          command: ["bash"],
          commandLabel: "bash",
          gitLog: false,
        },
      },
    };

    let snapshot = {
      seq: 8,
      cols: 80,
      rows: 24,
      cursor: { x: 0, y: 23 },
      lines: ["echo ready"],
      scrollback: {
        viewportOffset: 0,
        totalLines: 24,
        screenLines: 24,
      },
    };

    internal.terminals.set("iflow", {
      isRunning: () => true,
      getSnapshot: () => snapshot,
      getStatus: () => "IDLE",
      sliceDirty: async () => ({
        ok: true,
        changed: false,
        fromHash: null,
        toHash: null,
        diff: "",
        bytes: 0,
      }),
    });
    internal.focusedTerminalIds = ["iflow"];
    internal.loopPluginRuntime = await internal.createLoopPluginRuntime();

    internal.terminalSemanticFingerprint.iflow = "semantic-a";
    internal.terminalViewFingerprint.iflow = "view-a";
    internal.loopPluginRuntime.invalidate({
      src: createTerminalSrc("iflow", 8),
      reason: "semantic-change",
      versionHint: 8,
    });
    expect(await internal.flushPluginAttentionDrafts()).toBe(true);
    expect(getActiveItems(internal)).toHaveLength(0);

    snapshot = {
      ...snapshot,
      seq: 9,
      lines: ["echo changed"],
    };
    internal.terminalSemanticFingerprint.iflow = "semantic-b";
    internal.terminalViewFingerprint.iflow = "view-b";
    internal.loopPluginRuntime.invalidate({
      src: createTerminalSrc("iflow", 9),
      reason: "semantic-change",
      versionHint: 9,
    });

    expect(await internal.flushPluginAttentionDrafts()).toBe(true);

    const allTerminalItems = internal.attentionSystem.query({ minScore: 0, text: "Terminal iflow" });
    expect(allTerminalItems).toHaveLength(2);
    expect(getActiveMatches(internal)).toHaveLength(0);
    expect(allTerminalItems.some((match) => Object.values(match.commit.scores).every((score) => score === 0))).toBe(
      true,
    );
    expect(allTerminalItems.some((match) => match.commit.summary.includes("echo changed"))).toBe(true);
  });

  test("Scenario: Given a terminal source invalidation without readable output When plugin drafts flush Then no attention delta is committed", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal;

    internal.loopPluginRuntime = await internal.createLoopPluginRuntime();
    internal.loopPluginRuntime.invalidate({
      src: createTerminalSrc("missing-terminal", 1),
      reason: "semantic-change",
      versionHint: 1,
    });

    const changed = await internal.flushPluginAttentionDrafts();
    expect(changed).toBe(false);
    expect(getActiveItems(internal)).toHaveLength(0);

    const outputs = await internal.collectLoopInputs();
    expect(outputs).toBeUndefined();
  });

  test("Scenario: Given an explicit terminal read When snapshot is queried Then representation metadata is published in runtime state", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal;

    internal.config = {
      terminals: {
        main: {
          terminalId: "main",
          cwd: "/tmp",
          command: ["bash"],
          commandLabel: "bash",
          gitLog: false,
        },
      },
    };
    internal.terminals.set("main", {
      isRunning: () => true,
      getSnapshot: () => ({
        seq: 3,
        cols: 80,
        rows: 24,
        cursor: { x: 4, y: 1 },
        lines: ["echo ready"],
        scrollback: {
          viewportOffset: 0,
          totalLines: 24,
          screenLines: 24,
        },
      }),
      getStatus: () => "IDLE",
      sliceDirty: async () => ({
        ok: true,
        changed: false,
        fromHash: null,
        toHash: null,
        diff: "",
        bytes: 0,
      }),
    });

    const payload = await internal.readTerminalRepresentation("main", { mode: "snapshot", remark: false });
    const readPayload = payload as {
      kind: string;
      snapshot?: { lines?: string[] };
      recordedActivity?: boolean;
    };
    const terminalActivityView = internal as RuntimeInternal & {
      pageTerminalActivity: (terminalId: string, input?: { limit?: number }) => { items: unknown[] };
    };

    expect(readPayload.kind).toBe("terminal-snapshot");
    expect(readPayload.snapshot?.lines).toEqual(["echo ready"]);
    expect(readPayload.recordedActivity).toBeFalse();
    expect(internal.terminalReads.main?.representation).toBe("snapshot");
    expect(terminalActivityView.pageTerminalActivity("main", { limit: 10 }).items).toEqual([]);
  });

  test("Scenario: Given an explicit runtime terminal read When tooling requests a snapshot Then terminal activity records the read by default", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal;

    internal.config = {
      terminals: {
        main: {
          terminalId: "main",
          cwd: "/tmp",
          command: ["bash"],
          commandLabel: "bash",
          gitLog: false,
        },
      },
    };
    internal.terminals.set("main", {
      isRunning: () => true,
      getSnapshot: () => ({
        seq: 4,
        cols: 80,
        rows: 24,
        cursor: { x: 0, y: 1 },
        lines: ["echo ready", "line 2"],
        scrollback: {
          viewportOffset: 0,
          totalLines: 24,
          screenLines: 24,
        },
      }),
      getStatus: () => "IDLE",
      sliceDirty: async () => ({
        ok: true,
        changed: false,
        fromHash: null,
        toHash: null,
        diff: "",
        bytes: 0,
      }),
    });

    const payload = await runtime.readRuntimeTerminal({
      terminalId: "main",
      mode: "snapshot",
    });
    const readPayload = payload as {
      kind: string;
      snapshot?: { lines?: string[] };
      recordedActivity?: boolean;
    };
    const terminalActivityView = internal as RuntimeInternal & {
      pageTerminalActivity: (terminalId: string, input?: { limit?: number }) => { items: Array<{ kind?: string }> };
    };

    expect(readPayload.kind).toBe("terminal-snapshot");
    expect(readPayload.snapshot?.lines).toEqual(["echo ready", "line 2"]);
    expect(readPayload.recordedActivity).toBeTrue();
    expect(terminalActivityView.pageTerminalActivity("main", { limit: 10 }).items).toHaveLength(1);
    expect(terminalActivityView.pageTerminalActivity("main", { limit: 10 }).items[0]?.kind).toBe("terminal_read");
  });

  test("Scenario: Given one backend terminal truth When runtime derives render diff and observation Then all three paths stay sourced from the same terminal state", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal & {
      buildTerminalSystemIngressEnvelope: (terminalId: string) => Promise<{
        kind: string;
        meta?: { terminalId?: string; kind?: string; fromHash?: string | null; toHash?: string | null };
      } | null>;
      terminalStatusById: Map<
        string,
        {
          processPhase: "not_started" | "running" | "stopped";
          lifecycleTransition: string | null;
          status: "IDLE" | "BUSY";
        }
      >;
      terminalKernelAdapter: {
        markTerminalDirty: (terminalId: string) => void;
      };
    };

    await runtime.start();
    try {
      internal.config = {
        ...(internal.config ?? {}),
        terminals: {
          ...(internal.config?.terminals ?? {}),
          main: {
            terminalId: "main",
            cwd: "/tmp",
            command: ["bash"],
            commandLabel: "bash",
            gitLog: "normal",
          },
        },
      };
      internal.terminals.set("main", {
        isRunning: () => true,
        getSnapshot: () => ({
          seq: 9,
          cols: 80,
          rows: 24,
          cursor: { x: 0, y: 1 },
          lines: ["echo ready", "line 2"],
          scrollback: {
            viewportOffset: 0,
            totalLines: 24,
            screenLines: 24,
          },
        }),
        getStatus: () => "IDLE",
        sliceDirty: async () => ({
          ok: true,
          changed: true,
          fromHash: "hash-8",
          toHash: "hash-9",
          diff: "+line 2",
          bytes: 7,
        }),
      });
      internal.focusedTerminalIds = ["main"];
      internal.terminalStatusById.set("main", {
        processPhase: "running",
        lifecycleTransition: null,
        status: "IDLE",
      });

      const snapshotPayload = await internal.readTerminalRepresentation("main", { mode: "snapshot", remark: false });
      const diffPayload = await internal.readTerminalRepresentation("main", { mode: "auto", remark: false });
      const ingress = await internal.buildTerminalSystemIngressEnvelope("main");
      const beforeVersion = runtime.snapshot().schedulerSignals.terminal.version;
      internal.terminalKernelAdapter.markTerminalDirty("main");
      await Bun.sleep(10);

      expect("ok" in snapshotPayload).toBeFalse();
      if ("ok" in snapshotPayload) {
        return;
      }
      expect(snapshotPayload.kind).toBe("terminal-snapshot");
      if (snapshotPayload.kind !== "terminal-snapshot") {
        return;
      }
      expect(snapshotPayload.snapshot.lines).toEqual(["echo ready", "line 2"]);

      expect("ok" in diffPayload).toBeFalse();
      if ("ok" in diffPayload) {
        return;
      }
      expect(diffPayload.kind).toBe("terminal-diff");
      if (diffPayload.kind !== "terminal-diff") {
        return;
      }
      expect(diffPayload.diff).toBe("+line 2");
      expect(diffPayload.fromHash).toBe("hash-8");
      expect(diffPayload.toHash).toBe("hash-9");
      expect(internal.terminalReads.main?.representation).toBe("diff");

      expect(ingress?.kind).toBe("terminal_diff");
      expect(ingress?.meta?.terminalId).toBe("main");
      expect(ingress?.meta?.kind).toBe("terminal-diff");
      expect(ingress?.meta?.fromHash).toBe("hash-8");
      expect(ingress?.meta?.toHash).toBe("hash-9");

      expect(runtime.snapshot().schedulerSignals.terminal.version).toBe(beforeVersion + 1);
    } finally {
      await runtime.stop();
    }
  });

  test("Scenario: Given source-driven drafts When a cycle policy hook defers Then terminal history still commits while cycle start stays deferred", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal;

    internal.config = {
      terminals: {
        iflow: {
          terminalId: "iflow",
          cwd: "/tmp",
          command: ["bash"],
          commandLabel: "bash",
          gitLog: false,
        },
      },
    };
    internal.terminals.set("iflow", {
      isRunning: () => true,
      getSnapshot: () => ({
        seq: 9,
        cols: 80,
        rows: 24,
        cursor: { x: 0, y: 23 },
        lines: ["echo deferred"],
        scrollback: {
          viewportOffset: 0,
          totalLines: 24,
          screenLines: 24,
        },
      }),
      getStatus: () => "IDLE",
      sliceDirty: async () => ({
        ok: true,
        changed: false,
        fromHash: null,
        toHash: null,
        diff: "",
        bytes: 0,
      }),
    });

    const pluginRuntime = new LoopBusPluginRuntime([
      ...internal.createLoopPlugins(),
      {
        name: "policy-defer",
        cycleShouldStart() {
          return { allow: false, reason: "policy-deferred" };
        },
      },
    ]);
    await pluginRuntime.setup();
    pluginRuntime.invalidate({
      src: createTerminalSrc("iflow", 9),
      reason: "semantic-change",
      versionHint: 9,
    });

    const drafts = await pluginRuntime.readInvalidatedAttentionDrafts();
    expect(drafts).toHaveLength(1);

    await internal.commitAttentionDrafts(drafts);
    const decision = await pluginRuntime.shouldStartCycle(drafts);

    expect(internal.attentionSystem.query({ minScore: 0, text: "Terminal iflow" })).toHaveLength(1);
    expect(getActiveItems(internal)).toHaveLength(0);
    expect(decision).toEqual({ allow: false, reason: "policy-deferred" });
  });

  test("Scenario: Given attention refs and explicit room dispatch When trace lookup runs Then causal spans expose model links without synthetic bridge spans", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal;

    ensureAttentionContext(internal, PRIMARY_CONTEXT_ID);
    const chatCommit = appendAttentionCommit(internal, PRIMARY_CONTEXT_ID, {
      meta: {
        author: "User",
        source: "message",
        src: createMessageSrc(PRIMARY_ROOM_ID, 1),
      },
      scores: { hash_chat_trace: 100 },
      title: "Please ask gaubee about lunch",
    });
    await internal.handleCommittedAttentionCommit(PRIMARY_CONTEXT_ID, chatCommit, { notifyLoop: false });
    const inputs = await internal.collectLoopInputs();
    const attentionInput = inputs?.find((item) => item.source === "attention");
    expect(attentionInput).toBeDefined();
    if (!inputs || !attentionInput) {
      return;
    }

    const contextId = String(attentionInput.meta?.attentionContextId ?? "");
    const commitId = String(attentionInput.meta?.attentionHeadCommitId ?? chatCommit.commitId);
    expect(contextId).toBeTruthy();
    expect(commitId).toBeTruthy();

    await runtime.start();
    await runtime.pause();
    const { cycleId } = await internal.persistCycle({ wakeSource: "user", inputs });
    internal.upsertTraceRow({
      cycleId,
      traceId: `trace-${cycleId}`,
      spanId: `span-${cycleId}-model`,
      parentSpanId: null,
      kind: "model.call",
      name: "call_model",
      status: "running",
      startedAt: 10,
      endedAt: 10,
      refs: [{ kind: "attention.commit", ref: `${contextId}:${commitId}` }],
      links: [],
      events: [],
      attributes: { inputs: 1 },
    });
    await internal.handleModelCall({
      id: "call-1",
      timestamp: 11,
      status: "running",
      provider: "openai",
      model: "gpt-5.4",
      request: { messages: [{ role: "user", content: "Please ask gaubee about lunch" }] },
    });

    const modelCallId = internal.pageModelCalls().items[0]?.id;
    expect(modelCallId).toBeGreaterThan(0);

    const replyCommit = appendAttentionCommit(internal, PRIMARY_CONTEXT_ID, {
      meta: {
        author: "avatar:tester",
        source: "attention",
      },
      scores: { "relay-hash": 0 },
      title: "relay",
      detail: {
        kind: "replace",
        value: "gaubee says fried rice",
        format: "text/plain",
      },
    });

    await internal.handleCommittedAttentionCommit(PRIMARY_CONTEXT_ID, replyCommit, { notifyLoop: true });

    const sourceTraceKinds = internal.listLoopbusTracesByRef(`${contextId}:${commitId}`).map((trace) => trace.kind);
    expect(sourceTraceKinds).toContain("model.call");

    const replyTraceKinds = internal
      .listLoopbusTracesByRef(`${PRIMARY_CONTEXT_ID}:${replyCommit.commitId}`)
      .map((trace) => trace.kind);
    expect(replyTraceKinds).not.toContain("attention.hook");
    expect(replyTraceKinds).toContain("attention.commit");

    const modelTraceKinds = internal.listLoopbusTracesByRef(String(modelCallId)).map((trace) => trace.kind);
    expect(modelTraceKinds).toContain("model.call");

    await runtime.stop();
  });

  test("Scenario: Given timeout stop and abort endings When lifecycle rows persist Then model and trace outcomes stay distinct", async () => {
    const persistOutcome = async (input: {
      finalStatus: "error" | "cancelled";
      outcome: {
        code: "timeout" | "stopped" | "aborted";
        message: string;
      };
    }) => {
      const runtime = createRuntime();
      const internal = runtime as unknown as RuntimeInternal;

      ensureAttentionContext(internal, PRIMARY_CONTEXT_ID);
      const chatCommit = appendAttentionCommit(internal, PRIMARY_CONTEXT_ID, {
        meta: {
          author: "User",
          source: "message",
          src: createMessageSrc(PRIMARY_ROOM_ID, 1),
        },
        scores: { hash_lifecycle: 100 },
        title: "Need a lifecycle outcome test",
      });
      await internal.handleCommittedAttentionCommit(PRIMARY_CONTEXT_ID, chatCommit, { notifyLoop: false });
      const inputs = await internal.collectLoopInputs();
      if (!inputs) {
        throw new Error("expected collected inputs");
      }
      await runtime.start();
      await runtime.pause();
      const { cycleId } = await internal.persistCycle({ wakeSource: "user", inputs });
      const traceId = `trace-${cycleId}`;
      const spanId = `span-${cycleId}-model`;
      internal.upsertTraceRow({
        cycleId,
        traceId,
        spanId,
        parentSpanId: null,
        kind: "model.call",
        name: "call_model",
        status: "running",
        startedAt: 10,
        endedAt: 10,
        refs: [],
        links: [],
        events: [],
        attributes: {},
      });
      await internal.handleModelCall({
        id: `call-${cycleId}`,
        timestamp: 10,
        status: "running",
        provider: "openai",
        model: "gpt-5.4",
        request: { messages: [{ role: "user", content: "Need a lifecycle outcome test" }] },
      });

      const modelCallId = internal.pageModelCalls().items[0]?.id;
      if (!modelCallId) {
        throw new Error("expected persisted model-call row");
      }

      await internal.handleModelCall({
        id: `call-${cycleId}`,
        timestamp: 12,
        status: input.finalStatus,
        completedAt: 12,
        provider: "openai",
        model: "gpt-5.4",
        request: { messages: [{ role: "user", content: "Need a lifecycle outcome test" }] },
        error:
          input.finalStatus === "error"
            ? {
                message: input.outcome.message,
              }
            : undefined,
        outcome: {
          code: input.outcome.code,
          message: input.outcome.message,
        },
      });
      internal.upsertTraceRow({
        cycleId,
        traceId,
        spanId,
        parentSpanId: null,
        kind: "model.call",
        name: "call_model",
        status: input.finalStatus,
        startedAt: 10,
        endedAt: 12,
        refs: [],
        links: [],
        events: [],
        attributes: {},
        outcome: {
          code: input.outcome.code,
          message: input.outcome.message,
        },
      });

      const persistedCall = internal.pageModelCalls().items[0];
      const persistedTrace = internal
        .listLoopbusTracesByRef(String(modelCallId))
        .find((trace) => trace.kind === "model.call");

      await runtime.stop();
      return { persistedCall, persistedTrace };
    };

    const timeout = await persistOutcome({
      finalStatus: "error",
      outcome: {
        code: "timeout",
        message: "model call timed out after 120000ms",
      },
    });
    const stopped = await persistOutcome({
      finalStatus: "cancelled",
      outcome: {
        code: "stopped",
        message: "session.stop",
      },
    });
    const aborted = await persistOutcome({
      finalStatus: "cancelled",
      outcome: {
        code: "aborted",
        message: "session.abort",
      },
    });

    expect(timeout.persistedCall?.status).toBe("error");
    expect(timeout.persistedCall?.outcome?.code).toBe("timeout");
    expect(timeout.persistedTrace?.outcome?.code).toBe("timeout");

    expect(stopped.persistedCall?.status).toBe("cancelled");
    expect(stopped.persistedCall?.outcome?.code).toBe("stopped");
    expect(stopped.persistedTrace?.outcome?.code).toBe("stopped");

    expect(aborted.persistedCall?.status).toBe("cancelled");
    expect(aborted.persistedCall?.outcome?.code).toBe("aborted");
    expect(aborted.persistedTrace?.outcome?.code).toBe("aborted");
  });

  test("Scenario: Given an idle runtime waiting for commits When abort is requested Then the loop wakes and teardown finishes promptly", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal;

    await runtime.start();

    const abortPromise = runtime.abort().then(() => "aborted" as const);
    const winner = await Promise.race([
      abortPromise,
      new Promise<"timeout">((resolve) =>
        setTimeout(() => {
          internal.notifyInput("attention");
          resolve("timeout");
        }, 200),
      ),
    ]);

    expect(winner).toBe("aborted");
    await abortPromise;
    expect(runtime.isStarted()).toBe(false);
  });

  test("Scenario: Given a model-call provider error When the runtime records the failed call Then the loop snapshot retains lastError for route-level notice rendering", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal;

    ensureAttentionContext(internal, PRIMARY_CONTEXT_ID);
    const chatCommit = appendAttentionCommit(internal, PRIMARY_CONTEXT_ID, {
      meta: {
        author: "User",
        source: "message",
        src: createMessageSrc(PRIMARY_ROOM_ID, 1),
      },
      scores: { hash_provider_error: 100 },
      title: "Need provider error handling",
    });
    await internal.handleCommittedAttentionCommit(PRIMARY_CONTEXT_ID, chatCommit, { notifyLoop: false });
    const inputs = await internal.collectLoopInputs();
    if (!inputs) {
      throw new Error("expected collected inputs");
    }

    await runtime.start();
    await runtime.pause();
    const { cycleId } = await internal.persistCycle({ wakeSource: "user", inputs });
    internal.upsertTraceRow({
      cycleId,
      traceId: `trace-${cycleId}`,
      spanId: `span-${cycleId}-model`,
      parentSpanId: null,
      kind: "model.call",
      name: "call_model",
      status: "running",
      startedAt: 10,
      endedAt: 10,
      refs: [],
      links: [],
      events: [],
      attributes: {},
    });
    await internal.handleModelCall({
      id: `call-${cycleId}`,
      timestamp: 10,
      status: "running",
      provider: "openai",
      model: "gpt-5.4",
      request: { messages: [{ role: "user", content: "Need provider error handling" }] },
    });

    const providerError =
      'openai-chat response failed after 1 attempt(s): 402 status code ({"error":{"message":"Insufficient Balance"}})';
    await internal.handleModelCall({
      id: `call-${cycleId}`,
      timestamp: 12,
      status: "error",
      completedAt: 12,
      provider: "openai",
      model: "gpt-5.4",
      request: { messages: [{ role: "user", content: "Need provider error handling" }] },
      error: {
        message: providerError,
      },
      outcome: {
        code: "error",
        message: providerError,
      },
    });

    expect(runtime.snapshot().schedulerState?.lastError).toBe(providerError);
  });

  test("Scenario: Given an attention commit carries user-visible text When the runtime handles it Then the commit stays internal and no room bridge runs", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal;

    await runtime.start();
    const beforeMessages = (internal as unknown as RuntimeMessageEgressInternal).messageSystem.snapshot(
      PRIMARY_ROOM_ID,
      10,
    ).items;
    const commit = appendAttentionCommit(internal, PRIMARY_CONTEXT_ID, {
      meta: {
        author: "avatar:tester",
        source: "attention",
      },
      scores: { "reply-hash": 0 },
      title: "internal planning note",
      detail: {
        kind: "replace",
        value: "delivered reply",
        format: "text/plain",
      },
    });

    await internal.handleCommittedAttentionCommit(PRIMARY_CONTEXT_ID, commit, { notifyLoop: false });

    const snapshot = runtime.snapshot();
    const afterMessages = (internal as unknown as RuntimeMessageEgressInternal).messageSystem.snapshot(
      PRIMARY_ROOM_ID,
      10,
    ).items;
    expect(snapshot.attention?.hooks.at(-1)).toBeUndefined();
    expect(snapshot.chatMessages).toHaveLength(0);
    expect(afterMessages).toHaveLength(beforeMessages.length);

    await runtime.stop();
  });

  test("Scenario: Given a room-bound attention commit with visible summary but no explicit message mutation When the runtime handles it Then Chat stays quiet", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal;

    await runtime.start();
    ensureAttentionContext(internal, PRIMARY_CONTEXT_ID);
    const beforeMessages = internal.messageSystem.snapshot(PRIMARY_ROOM_ID, 10).items;
    const commit = internal.attentionSystem.commit(PRIMARY_CONTEXT_ID, {
      meta: {
        author: "avatar:tester",
        source: "attention",
      },
      scores: { "reply-hash": 1 },
      summary: "this summary must stay inside attention",
      change: {
        type: "update",
        value: "this summary must stay inside attention",
        format: "text/plain",
      },
    }).commit;

    await internal.handleCommittedAttentionCommit(PRIMARY_CONTEXT_ID, commit, { notifyLoop: false });

    const afterMessages = internal.messageSystem.snapshot(PRIMARY_ROOM_ID, 10).items;
    expect(afterMessages).toHaveLength(beforeMessages.length);
    expect(runtime.snapshot().chatMessages).toHaveLength(0);

    await runtime.stop();
  });

  test("Scenario: Given recent room messages reference an older durable room fact When runtime tooling reads the room Then the result carries direct referencedItems sidecar context", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeMessageEgressInternal;

    await runtime.start();
    const prompt = await internal.sendMessageTool({
      chatId: PRIMARY_ROOM_ID,
      content: "Did I already say this once?",
      from: "tester",
    });
    await internal.sendMessageTool({
      chatId: PRIMARY_ROOM_ID,
      ref: prompt.messageId,
      content: "I am replying to that exact question.",
      from: "tester",
    });

    const snapshot = await internal.readMessageChannelForTooling({
      chatId: PRIMARY_ROOM_ID,
      limit: 10,
    });

    expect(snapshot.items.find((item) => item.content === "I am replying to that exact question.")?.ref).toBe(
      prompt.messageId,
    );
    expect(snapshot.referencedItems).toContainEqual(
      expect.objectContaining({
        messageId: prompt.messageId,
        content: "Did I already say this once?",
      }),
    );

    await runtime.stop();
  });

  test("Scenario: Given a clean attention commit When the runtime handles it Then the commit stays internal and Chat stays quiet", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal;

    await runtime.start();
    ensureAttentionContext(internal, PRIMARY_CONTEXT_ID);
    const commit = internal.attentionSystem.commit(PRIMARY_CONTEXT_ID, {
      meta: {
        author: "avatar:tester",
        source: "attention",
      },
      scores: { "reply-clean": 0 },
      summary: "this stays inside attention",
      change: { type: "clean" },
    }).commit;

    const beforeCount = runtime.snapshot().chatMessages.length;
    await internal.handleCommittedAttentionCommit(PRIMARY_CONTEXT_ID, commit, { notifyLoop: false });

    const snapshot = runtime.snapshot();
    expect(snapshot.attention?.hooks.at(-1)).toBeUndefined();
    expect(snapshot.chatMessages).toHaveLength(beforeCount);
    expect(
      (internal as unknown as RuntimeMessageEgressInternal).messageSystem.snapshot(PRIMARY_ROOM_ID, 10).items.at(-1)
        ?.content,
    ).not.toBe("this stays inside attention");

    await runtime.stop();
  });

  test("Scenario: Given a message send dispatch during an active cycle When the assistant replies explicitly Then the room message stays free of cycle residue", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeMessageEgressInternal;

    ensureAttentionContext(internal, PRIMARY_CONTEXT_ID);
    const chatCommit = appendAttentionCommit(internal, PRIMARY_CONTEXT_ID, {
      meta: {
        author: "User",
        source: "message",
        src: createMessageSrc(PRIMARY_ROOM_ID, 1),
      },
      scores: { hash_room_reply: 100 },
      title: "Send the answer through the default chat channel",
    });
    await internal.handleCommittedAttentionCommit(PRIMARY_CONTEXT_ID, chatCommit, { notifyLoop: false });
    const inputs = await internal.collectLoopInputs();
    if (!inputs) {
      throw new Error("expected collected inputs");
    }

    await runtime.start();
    await runtime.pause();
    const { cycleId } = await internal.persistCycle({ wakeSource: "user", inputs });

    await internal.sendMessageTool({
      chatId: PRIMARY_ROOM_ID,
      content: "Delivered through message send",
    });

    const message = internal.messageSystem.snapshot(PRIMARY_ROOM_ID, 10).items.at(-1);
    expect(message?.content).toBe("Delivered through message send");
    expect(message?.ref).toBeUndefined();
    expect(message?.metadata).toEqual({});
    expect(Object.prototype.hasOwnProperty.call(message ?? {}, "rootId")).toBeFalse();

    await runtime.stop();
  });

  test("Scenario: Given a runtime dispatch already sent a visible reply When a later attention commit lands Then the runtime does not create a second room message", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeMessageEgressInternal;

    await runtime.start();
    await runtime.pause();
    const { cycleId } = await internal.persistCycle({
      wakeSource: "user",
      inputs: [
        {
          source: "attention",
          role: "user",
          type: "text",
          name: `Attention-${PRIMARY_CONTEXT_ID}`,
          text: "pending chat attention",
          meta: {
            attentionContextId: PRIMARY_CONTEXT_ID,
            chatId: PRIMARY_ROOM_ID,
          },
        },
      ],
    });

    await internal.sendMessageTool({
      chatId: PRIMARY_ROOM_ID,
      content: "Delivered through message send",
    });

    const duplicateCommit = appendAttentionCommit(internal, PRIMARY_CONTEXT_ID, {
      meta: {
        author: "avatar:tester",
        source: "attention",
      },
      scores: { "reply-hash": 0 },
      title: "duplicate visible dispatch",
      detail: {
        kind: "replace",
        value: "duplicate visible dispatch",
        format: "text/plain",
      },
    });

    const beforeMessages = internal.messageSystem.snapshot(PRIMARY_ROOM_ID, 10).items;
    await internal.handleCommittedAttentionCommit(PRIMARY_CONTEXT_ID, duplicateCommit, { notifyLoop: false });
    const afterMessages = internal.messageSystem.snapshot(PRIMARY_ROOM_ID, 10).items;

    expect(afterMessages).toHaveLength(beforeMessages.length);
    expect(afterMessages.at(-1)?.content).toBe("Delivered through message send");
    expect(runtime.snapshot().attention?.hooks.at(-1)).toBeUndefined();
    expect(afterMessages.at(-1)?.metadata).toEqual({});

    await runtime.stop();
  });

  test("Scenario: Given a clean attention commit When the runtime observes it Then internal summaries do not become visible room messages", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeMessageEgressInternal;

    await runtime.start();
    await runtime.pause();
    ensureAttentionContext(internal, PRIMARY_CONTEXT_ID);

    const beforeMessages = internal.messageSystem.snapshot(PRIMARY_ROOM_ID, 10).items;
    const cleanCommit = internal.attentionSystem.commit(PRIMARY_CONTEXT_ID, {
      meta: {
        author: "avatar:tester",
        source: "attention",
      },
      scores: { "reply-hash": 0 },
      summary: "internal summary should stay internal",
      change: {
        type: "clean",
      },
    }).commit;

    await internal.handleCommittedAttentionCommit(PRIMARY_CONTEXT_ID, cleanCommit, { notifyLoop: false });
    const afterMessages = internal.messageSystem.snapshot(PRIMARY_ROOM_ID, 10).items;

    expect(afterMessages).toHaveLength(beforeMessages.length);
    expect(runtime.snapshot().attention?.hooks.at(-1)).toBeUndefined();

    await runtime.stop();
  });

  test("Scenario: Given a visible assistant reply already exists with no newer user message When message send repeats the same chat content Then the runtime reuses the existing message instead of appending a duplicate", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeMessageEgressInternal;

    await runtime.start();
    const first = await internal.sendMessageTool({
      chatId: PRIMARY_ROOM_ID,
      content: "稍等，我去问一下。",
      from: "tester",
    });
    const second = await internal.sendMessageTool({
      chatId: PRIMARY_ROOM_ID,
      content: "稍等，我去问一下。",
      from: "tester",
    });

    const messages = internal.messageSystem.snapshot(PRIMARY_ROOM_ID, 10).items;
    expect(messages.filter((message) => message.content === "稍等，我去问一下。")).toHaveLength(1);
    expect(second.messageId).toBe(first.messageId);
    expect(second.recentMessages.at(-1)?.messageId).toBe(first.messageId);
    expect(second.recentMessages.at(-1)?.contentPreview).toBe("稍等，我去问一下。");

    await runtime.stop();
  });

  test("Scenario: Given a reused visible assistant reply with a follow-up watch When message send repeats the same chat content Then the runtime refreshes the existing watch without duplicate persistence", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeMessageEgressInternal;

    await runtime.start();
    const first = await internal.sendMessageTool({
      chatId: PRIMARY_ROOM_ID,
      content: "先等等，我确认一下。",
      from: "tester",
      followUpAfterMs: 30_000,
    });
    await Bun.sleep(5);
    const second = await internal.sendMessageTool({
      chatId: PRIMARY_ROOM_ID,
      content: "先等等，我确认一下。",
      from: "tester",
      followUpAfterMs: 30_000,
    });

    const messages = internal.messageSystem.snapshot(PRIMARY_ROOM_ID, 10).items;
    const matchingWatches = runtime
      .inspectAttentionDeliveryState()
      .watches.filter(
        (watch) =>
          watch.target === `room:${PRIMARY_ROOM_ID}` &&
          watch.predicate.kind === "message_latest_visible" &&
          watch.predicate.anchorMessageId === first.messageId,
      );

    expect(messages.filter((message) => message.content === "先等等，我确认一下。")).toHaveLength(1);
    expect(second.messageId).toBe(first.messageId);
    expect(matchingWatches).toHaveLength(1);
    expect(matchingWatches[0]).toEqual(
      expect.objectContaining({
        ownerActionId: second.actionId,
        ownerActionKind: "message_send",
        status: "pending",
        reminderContextId: null,
        reminderCommitId: null,
      }),
    );
    expect(
      matchingWatches[0]?.watchId.startsWith(`watch/message-follow-up/${PRIMARY_ROOM_ID}/${first.messageId}/`),
    ).toBeTrue();

    await runtime.stop();
  });

  test("Scenario: Given a recalled visible assistant reply When message send repeats the same chat content Then the explicit action creates a new visible row and effect", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeMessageEgressInternal;

    await runtime.start();
    const first = await internal.sendMessageTool({
      chatId: PRIMARY_ROOM_ID,
      content: "这条需要重发。",
      from: "tester",
    });
    await runtime.recallRuntimeMessage({
      chatId: PRIMARY_ROOM_ID,
      messageId: first.messageId,
    });
    const second = await internal.sendMessageTool({
      chatId: PRIMARY_ROOM_ID,
      content: "这条需要重发。",
      from: "tester",
    });

    const messages = internal.messageSystem.queryMessages({ chatId: PRIMARY_ROOM_ID, limit: 10 }).items;
    const delivery = runtime.inspectAttentionDeliveryState();

    expect(second.messageId).not.toBe(first.messageId);
    expect(messages.filter((message) => message.recalledAt)).toHaveLength(1);
    expect(messages.filter((message) => !message.recalledAt && message.content === "这条需要重发。")).toHaveLength(1);
    expect(delivery.effects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionId: second.actionId,
          actionKind: "message_send",
          target: `room:${PRIMARY_ROOM_ID}`,
          effectKind: "message_row_created",
          effectRecordId: `${PRIMARY_ROOM_ID}/${second.messageId}`,
        }),
      ]),
    );

    await runtime.stop();
  });

  test("Scenario: Given a sent acknowledgement arms follow-up reminder When the delay expires and no newer room message exists Then the runtime creates attention without auto-sending another room message", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeMessageEgressInternal;

    await runtime.start();
    const first = await internal.sendMessageTool({
      chatId: PRIMARY_ROOM_ID,
      content: "先等等，我确认一下。",
      from: "tester",
      followUpAfterMs: 25,
    });

    await Bun.sleep(40);

    const wake = await internal.waitForAnyInput();
    const batch = await internal.collectLoopInputs();
    const messages = internal.messageSystem.snapshot(PRIMARY_ROOM_ID, 10).items;
    const activeItems = getActiveItems(internal);
    const delivery = runtime.inspectAttentionDeliveryState();

    expect(wake).toBe("attention");
    expect(messages.filter((message) => message.content === "先等等，我确认一下。")).toHaveLength(1);
    expect(messages).toHaveLength(1);
    expect(activeItems.some((item) => item.title.includes("Re-evaluate room follow-up"))).toBeTrue();
    expect(
      activeItems.some((item) => parseMessageAttentionSrc(item.meta.src ?? "")?.messageId === first.messageId),
    ).toBeTrue();
    expect(getBootstrapInput(batch)).toBeDefined();
    expect(delivery.watches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ownerActionId: first.actionId,
          ownerActionKind: "message_send",
          target: `room:${PRIMARY_ROOM_ID}`,
          status: "expired",
          reminderContextId: PRIMARY_CONTEXT_ID,
          predicate: {
            kind: "message_latest_visible",
            chatId: PRIMARY_ROOM_ID,
            anchorMessageId: first.messageId,
          },
        }),
      ]),
    );
    expect(delivery.effects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionId: first.actionId,
          actionKind: "message_send",
        }),
      ]),
    );
    expect(
      delivery.effects.some(
        (effect) =>
          effect.actionId === first.actionId &&
          effect.actionKind === "message_send" &&
          effect.target === `room:${PRIMARY_ROOM_ID}` &&
          effect.effectKind === "message_row_created" &&
          effect.effectRecordId === `${PRIMARY_ROOM_ID}/${first.messageId}` &&
          effect.meta?.chatId === PRIMARY_ROOM_ID &&
          effect.meta?.messageId === first.messageId,
      ),
    ).toBeTrue();

    await runtime.stop();
  });

  test("Scenario: Given a follow-up watch message is recalled before expiry When the delay passes Then the active-latest predicate settles silently without reminder attention", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeMessageEgressInternal;

    await runtime.start();
    const first = await internal.sendMessageTool({
      chatId: PRIMARY_ROOM_ID,
      content: "这条提醒应当被撤回。",
      from: "tester",
      followUpAfterMs: 25,
    });
    await runtime.recallRuntimeMessage({
      chatId: PRIMARY_ROOM_ID,
      messageId: first.messageId,
    });

    await Bun.sleep(40);

    const waitPromise = internal.waitForAnyInput();
    const winner = await Promise.race([waitPromise, Bun.sleep(80).then(() => "timeout" as const)]);
    if (winner === "attention") {
      await internal.collectLoopInputs();
    }
    const activeItems = getActiveItems(internal);
    const delivery = runtime.inspectAttentionDeliveryState();

    expect(winner).toBe("attention");
    expect(activeItems.some((item) => item.title.includes("Re-evaluate room follow-up"))).toBeFalse();
    expect(delivery.watches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ownerActionId: first.actionId,
          target: `room:${PRIMARY_ROOM_ID}`,
          status: "satisfied",
          predicate: {
            kind: "message_latest_visible",
            chatId: PRIMARY_ROOM_ID,
            anchorMessageId: first.messageId,
          },
          reminderContextId: null,
          reminderCommitId: null,
        }),
      ]),
    );

    await runtime.stop();
  });

  test("Scenario: Given a newer visible room message lands before reminder expiry When the original delay passes Then the stale follow-up reminder does not create new attention", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeMessageEgressInternal;

    await runtime.start();
    const first = await internal.sendMessageTool({
      chatId: PRIMARY_ROOM_ID,
      content: "你住哪里？",
      from: "tester",
      followUpAfterMs: 25,
    });
    await internal.sendMessageTool({
      chatId: PRIMARY_ROOM_ID,
      content: "我先按福州给你看。",
      from: "tester",
    });

    await Bun.sleep(40);

    const waitPromise = internal.waitForAnyInput();
    const winner = await Promise.race([waitPromise, Bun.sleep(80).then(() => "timeout" as const)]);
    const messages = internal.messageSystem.snapshot(PRIMARY_ROOM_ID, 10).items;
    const activeItems = getActiveItems(internal);
    const delivery = runtime.inspectAttentionDeliveryState();

    expect(winner).toBe("timeout");
    expect(messages).toHaveLength(2);
    expect(activeItems.some((item) => item.title.includes("Re-evaluate room follow-up"))).toBeFalse();
    expect(delivery.watches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ownerActionId: first.actionId,
          target: `room:${PRIMARY_ROOM_ID}`,
          status: "satisfied",
          predicate: {
            kind: "message_latest_visible",
            chatId: PRIMARY_ROOM_ID,
            anchorMessageId: first.messageId,
          },
          reminderContextId: null,
          reminderCommitId: null,
        }),
      ]),
    );

    internal.notifyInput("attention");
    await waitPromise;

    await runtime.stop();
  });

  test("Scenario: Given explicit room message mutations When delivery diagnostics are inspected Then effect ledger keeps durable action-to-room causality", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeMessageEgressInternal;

    await runtime.start();
    const sent = await internal.sendMessageTool({
      chatId: PRIMARY_ROOM_ID,
      content: "第一版答复",
      from: "tester",
    });
    const edited = await runtime.editRuntimeMessage({
      chatId: PRIMARY_ROOM_ID,
      messageId: sent.messageId,
      content: "更正后的答复",
    });
    const recalled = await runtime.recallRuntimeMessage({
      chatId: PRIMARY_ROOM_ID,
      messageId: sent.messageId,
    });

    const delivery = runtime.inspectAttentionDeliveryState();
    const timeline = runtime.queryAttentionDeliveryTimeline({ limit: 20 });

    expect(delivery.effects.filter((effect) => effect.target === `room:${PRIMARY_ROOM_ID}`)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionId: sent.actionId,
          actionKind: "message_send",
          target: `room:${PRIMARY_ROOM_ID}`,
          effectKind: "message_row_created",
          effectRecordId: `${PRIMARY_ROOM_ID}/${sent.messageId}`,
          meta: expect.objectContaining({
            chatId: PRIMARY_ROOM_ID,
            messageId: sent.messageId,
          }),
        }),
        expect.objectContaining({
          actionKind: "message_edit",
          target: `room:${PRIMARY_ROOM_ID}`,
          effectKind: "message_row_updated",
          effectRecordId: `${PRIMARY_ROOM_ID}/${edited.messageId}`,
          meta: expect.objectContaining({
            chatId: PRIMARY_ROOM_ID,
            messageId: edited.messageId,
          }),
        }),
        expect.objectContaining({
          actionKind: "message_recall",
          target: `room:${PRIMARY_ROOM_ID}`,
          effectKind: "message_row_recalled",
          effectRecordId: `${PRIMARY_ROOM_ID}/${recalled.messageId}`,
          meta: expect.objectContaining({
            chatId: PRIMARY_ROOM_ID,
            messageId: recalled.messageId,
            recalledAt: recalled.recalledAt,
          }),
        }),
      ]),
    );
    expect(timeline.effects).toEqual(delivery.effects);

    await runtime.stop();
  });

  test("Scenario: Given a durable prompt window already exists When the runtime cold starts Then inspectModelDebug restores that exact current window from session.db", async () => {
    const root = mkdtempSync(join(tmpdir(), "agenter-session-runtime-prompt-window-"));
    const sessionRoot = join(root, "session");
    const options = {
      sessionId: "s-prompt-window-restart",
      cwd: root,
      sessionRoot,
      sessionName: "prompt-window-restart",
      storeTarget: "workspace" as const,
      primaryRoomId: PRIMARY_ROOM_ID,
      allocateRoomId: createRuntimeRoomAllocator(),
      terminalSystem: createTerminalSystem(root),
    };
    const firstRuntime = new SessionRuntime(options);

    await firstRuntime.start();
    await firstRuntime.pause();

    const expectedPromptWindow = [
      {
        role: "assistant" as const,
        content: "```yaml+prompt_window_compact\noverview: restored\n```",
      },
      {
        role: "assistant" as const,
        content: "```yaml+attention_items\nactiveContexts: []\n```",
      },
    ];
    const db = new SessionDb(join(sessionRoot, "session.db"));
    try {
      db.savePromptWindow({
        createdAt: 100,
        messages: expectedPromptWindow,
        setCurrent: true,
      });
    } finally {
      db.close();
    }
    await firstRuntime.stop();

    const restarted = new SessionRuntime(options);
    await restarted.start();
    await restarted.pause();

    expect(restarted.inspectModelDebug().promptWindow).toEqual(expectedPromptWindow);

    await restarted.stop();
  });

  test("Scenario: Given a cycle originates from the primary room When message send targets a relay room first Then only the explicit relay-room message is created", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeMessageEgressInternal;
    const relayChannel = await runtime.createMessageChannel({
      kind: "room",
      title: "gaubee",
      focus: false,
    });

    await runtime.start();
    await runtime.pause();
    const { cycleId } = await internal.persistCycle({
      wakeSource: "user",
      inputs: [
        {
          source: "attention",
          role: "user",
          type: "text",
          name: `Attention-${PRIMARY_CONTEXT_ID}`,
          text: "gaubee在吗？问他中午吃什么？",
          meta: {
            attentionContextId: PRIMARY_CONTEXT_ID,
            chatId: PRIMARY_ROOM_ID,
          },
        },
      ],
    });

    const relayDispatch = await internal.sendMessageTool({
      chatId: relayChannel.chatId,
      content: "gaubee，今天中午吃什么？",
    });

    const mainMessages = internal.messageSystem.snapshot(PRIMARY_ROOM_ID, 10).items;
    const relayMessages = internal.messageSystem.snapshot(relayChannel.chatId, 10).items;
    expect(relayDispatch.ok).toBe(true);
    expect(mainMessages).toHaveLength(0);
    expect(relayMessages.at(-1)?.content).toBe("gaubee，今天中午吃什么？");
    expect(relayMessages.at(-1)?.metadata).toEqual({});

    await runtime.stop();
  });

  test("Scenario: Given a cycle originates from the primary room When root workspace bash starts tool work before any visible room reply Then the origin room stays unchanged", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal;

    await runtime.start();
    await runtime.pause();
    const { cycleId } = await internal.persistCycle({
      wakeSource: "user",
      inputs: [
        {
          source: "attention",
          role: "user",
          type: "text",
          name: `Attention-${PRIMARY_CONTEXT_ID}`,
          text: "帮我做一个简单页面。",
          meta: {
            attentionContextId: PRIMARY_CONTEXT_ID,
            chatId: PRIMARY_ROOM_ID,
          },
        },
      ],
    });

    const bash = await internal.execRootWorkspaceBash({
      command: "printf ready",
    });

    const mainMessages = internal.messageSystem.snapshot(PRIMARY_ROOM_ID, 10).items;
    expect(bash.stdout).toBe("ready");
    expect(mainMessages).toHaveLength(0);

    await runtime.stop();
  });

  test("Scenario: Given root workspace bash sends a room reply itself When message send targets the origin room Then runtime does not prepend an extra auto-acknowledgement", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal;

    await runtime.start();
    await runtime.pause();
    await internal.persistCycle({
      wakeSource: "user",
      inputs: [
        {
          source: "attention",
          role: "user",
          type: "text",
          name: `Attention-${PRIMARY_CONTEXT_ID}`,
          text: "先问我住哪里。",
          meta: {
            attentionContextId: PRIMARY_CONTEXT_ID,
            chatId: PRIMARY_ROOM_ID,
          },
        },
      ],
    });

    const bash = await internal.execRootWorkspaceBash({
      command: "message send",
      stdin: JSON.stringify({
        chatId: PRIMARY_ROOM_ID,
        content: "你住哪里？",
      }),
    });

    const mainMessages = internal.messageSystem.snapshot(PRIMARY_ROOM_ID, 10).items;
    expect(bash.exitCode).toBe(0);
    expect(mainMessages).toHaveLength(1);
    expect(mainMessages.at(-1)?.content).toBe("你住哪里？");
    expect(mainMessages.at(-1)?.content).not.toBe("Understood. I'll handle it and report back.");

    await runtime.stop();
  });

  test("Scenario: Given a watched skill file changes before the next round When collectLoopInputs runs Then the runtime flushes one aggregated skill reminder at that collection boundary", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal & {
      ensureRuntimeSkillSystem: () => RuntimeSkillSystem;
      handleRuntimeSkillRefreshResult: (
        result: ReturnType<RuntimeSkillSystem["refresh"]>,
        input: { notifyLoop: boolean },
      ) => Promise<unknown>;
    };
    const rootWorkspacePath = (Reflect.get(runtime, "options") as { rootWorkspacePath: string }).rootWorkspacePath;
    const skillDir = join(rootWorkspacePath, "skills", "live-sync");
    await mkdir(join(skillDir, "references"), { recursive: true });
    await writeFile(
      join(skillDir, "SKILL.md"),
      [
        "---",
        "name: live-sync",
        "description: live runtime skill",
        "---",
        "",
        "# live-sync",
        "",
        "Keep this short.",
        "",
      ].join("\n"),
      "utf8",
    );
    await writeFile(
      join(skillDir, "ccski.config.json"),
      `${JSON.stringify({ files: ["references/*.md"] }, null, 2)}\n`,
      "utf8",
    );
    const referencePath = join(skillDir, "references", "guide.md");
    await writeFile(referencePath, "reference-v1\n", "utf8");

    const skillSystem = internal.ensureRuntimeSkillSystem();
    await internal.handleRuntimeSkillRefreshResult(
      skillSystem.refresh({ publishReminders: false }),
      { notifyLoop: false },
    );
    await internal.collectLoopInputs();

    await writeFile(referencePath, "reference-v2\n", "utf8");
    await new Promise((resolve) => setTimeout(resolve, 120));

    const inputs = await internal.collectLoopInputs();
    const itemsInput = getItemsInput(inputs);
    expect(itemsInput).toBeDefined();
    expect(itemsInput?.text).toContain("Updated runtime skill live-sync");
    expect(itemsInput?.text).toContain("references/guide.md");
  });

  test("Scenario: Given a skill changes while the runtime is stopped When the same session restarts Then only the skill AttentionContext projection is refreshed", async () => {
    const root = mkdtempSync(join(tmpdir(), "agenter-session-runtime-skill-restart-"));
    const sessionRoot = join(root, "session");
    const skillDir = join(root, "skills", "offline-runtime");
    await mkdir(skillDir, { recursive: true });
    await writeFile(
      join(skillDir, "SKILL.md"),
      [
        "---",
        "name: offline-runtime",
        "description: runtime skill baseline",
        "---",
        "",
        "# offline-runtime",
        "",
        "Version one.",
        "",
      ].join("\n"),
      "utf8",
    );
    const createRestartableRuntime = (): SessionRuntime => {
      const runtime = new SessionRuntime({
        sessionId: "s-skill-restart",
        cwd: root,
        sessionRoot,
        sessionName: "skill-restart",
        storeTarget: "workspace",
        primaryRoomId: PRIMARY_ROOM_ID,
        allocateRoomId: createRuntimeRoomAllocator(),
        terminalSystem: createTerminalSystem(root),
        avatarPrincipalId: TEST_AVATAR_PRINCIPAL_ID,
        avatarPrivateKey: TEST_AVATAR_PRIVATE_KEY,
        homeDir: root,
        rootWorkspacePath: root,
        resolveRuntimeTerminalCwd: async (input) => ({
          ok: true,
          cwd: input.cwd ?? root,
        }),
      });
      attachPrimaryRoom(runtime);
      return runtime;
    };

    const firstRuntime = createRestartableRuntime();
    await firstRuntime.start();
    await firstRuntime.pause();
    await firstRuntime.stop();

    await writeFile(
      join(skillDir, "SKILL.md"),
      [
        "---",
        "name: offline-runtime",
        "description: runtime skill updated while stopped",
        "---",
        "",
        "# offline-runtime",
        "",
        "Version two.",
        "",
      ].join("\n"),
      "utf8",
    );

    const restarted = createRestartableRuntime();
    await restarted.start();
    await restarted.pause();
    const inputs = await (restarted as unknown as RuntimeInternal).collectLoopInputs();
    const contextInput = getBootstrapInput(inputs);
    expect(contextInput?.text).toContain("## AttentionContext.background");
    expect(contextInput?.text).toContain("ctx-workspace-runtime");
    expect(contextInput?.text).toContain("offline-runtime");
    expect(getItemsInput(inputs)).toBeUndefined();

    await restarted.stop();
  });

  test("Scenario: Given root bash mutates a runtime skill When the next rounds are collected Then added updated and removed skill reminders all enter attention input", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal & {
      ensureRuntimeSkillSystem: () => RuntimeSkillSystem;
      handleRuntimeSkillRefreshResult: (
        result: ReturnType<RuntimeSkillSystem["refresh"]>,
        input: { notifyLoop: boolean },
      ) => Promise<unknown>;
    };
    const skillSystem = internal.ensureRuntimeSkillSystem();
    await internal.handleRuntimeSkillRefreshResult(
      skillSystem.refresh({ publishReminders: true }),
      { notifyLoop: false },
    );
    const skillContent = (body: string): string =>
      ["---", "name: live-bridge", "description: runtime loop proof", "---", "", "# live-bridge", "", body, ""].join(
        "\n",
      );

    const upsertAdded = await internal.execRootWorkspaceBash({
      command: "skill upsert",
      stdin: JSON.stringify({
        name: "live-bridge",
        content: skillContent("Version one."),
      }),
    });
    expect(upsertAdded.exitCode).toBe(0);
    const addedInputs = await internal.collectLoopInputs();
    expect(getAttentionProtocolKinds(addedInputs)).toContain("items");
    expect(getItemsInput(addedInputs)?.text ?? "").toContain("Added runtime skill live-bridge");

    const upsertUpdated = await internal.execRootWorkspaceBash({
      command: "skill upsert",
      stdin: JSON.stringify({
        name: "live-bridge",
        content: skillContent("Version two."),
      }),
    });
    expect(upsertUpdated.exitCode).toBe(0);
    const updatedInputs = await internal.collectLoopInputs();
    expect(getAttentionProtocolKinds(updatedInputs)).toContain("items");
    expect(getItemsInput(updatedInputs)?.text ?? "").toContain("Updated runtime skill live-bridge");

    const removeResult = await internal.execRootWorkspaceBash({
      command: "skill remove",
      stdin: JSON.stringify({
        name: "live-bridge",
      }),
    });
    expect(removeResult.exitCode).toBe(0);
    const removedInputs = await internal.collectLoopInputs();
    expect(getAttentionProtocolKinds(removedInputs)).toContain("items");
    expect(getItemsInput(removedInputs)?.text ?? "").toContain("Removed runtime skill live-bridge");

    await runtime.stop();
  });

  test("Scenario: Given an attention commit lands after room identity drifts When the runtime handles it Then Chat still stays quiet because commits no longer bridge into rooms", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal;

    await runtime.start();
    const commit = appendAttentionCommit(internal, PRIMARY_CONTEXT_ID, {
      meta: {
        author: "avatar:tester",
        source: "attention",
      },
      scores: { "reply-hash": 0 },
      title: "failed reply",
      detail: {
        kind: "replace",
        value: "failed reply",
        format: "text/plain",
      },
    });

    const beforeCount = runtime.snapshot().chatMessages.length;
    await internal.handleCommittedAttentionCommit(PRIMARY_CONTEXT_ID, commit, { notifyLoop: false });

    const snapshot = runtime.snapshot();
    expect(snapshot.attention?.hooks.at(-1)).toBeUndefined();
    expect(snapshot.chatMessages).toHaveLength(beforeCount);

    await runtime.stop();
  });
});
