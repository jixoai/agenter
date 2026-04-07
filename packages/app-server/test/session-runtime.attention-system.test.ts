import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  AttentionSystem,
  type AttentionActiveContextMatch,
  type AttentionCommit,
  type AttentionCommitChange,
} from "@agenter/attention-system";
import { MessageControlPlane } from "@agenter/message-system";
import { SessionDb } from "@agenter/session-system";
import { TerminalControlPlane, type TerminalActorId } from "@agenter/terminal-system";
import type { LoopBusInput } from "../src/loop-bus";
import { LoopBusPluginRuntime, type AttentionDraft, type LoopBusPlugin } from "../src/loopbus-plugin-runtime";
import { SessionRuntime } from "../src/session-runtime";

interface RuntimeInternal {
  agent: { requestCompact: (reason?: string) => void } | null;
  attentionSystem: AttentionSystem;
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
  collectInterleavedAgentInputs: () => Promise<LoopBusInput[] | undefined>;
  collectAttentionInputs: () => LoopBusInput[] | undefined;
  waitForAnyInput: () => Promise<"user" | "terminal" | "task" | "attention">;
  notifyInput: (kind: "user" | "terminal" | "task" | "attention") => void;
  loopPluginRuntime: LoopBusPluginRuntime | null;
  createLoopPluginRuntime: () => Promise<LoopBusPluginRuntime>;
  createLoopPlugins: () => LoopBusPlugin[];
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
  ) => Promise<{ kind: string; representation: string } | { ok: false; reason: string }>;
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
      };
      getStatus: () => "IDLE" | "BUSY";
      sliceDirty: (input: { remark?: boolean; wait?: boolean }) => Promise<{
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
  resolveCycleReplyChatId: (inputs: LoopBusInput[]) => string | null;
}

interface RuntimeMessageEgressInternal extends RuntimeInternal {
  agent: {
    requestCompact: (reason?: string) => void;
  } | null;
  messageSystem: {
    snapshot: (
      chatId: string,
      limit?: number,
    ) => {
      items: Array<{
        content: string;
        rootId?: string;
        metadata?: Record<string, unknown>;
      }>;
    };
  };
  sendMessageTool: (input: {
    chatId: string;
    content: string;
    rootId?: string;
    from?: string;
    to?: string;
  }) => Promise<{ ok: boolean; messageId: string }>;
}

const createPrincipalId = (value: number): `0x${string}` => `0x${value.toString(16).padStart(40, "0")}`;
let nextRoomPrincipalSeed = 2;
const createRuntimeRoomAllocator = () => async (): Promise<string> => createPrincipalId(nextRoomPrincipalSeed++);

const PRIMARY_ROOM_ID = createPrincipalId(1);
const PRIMARY_CONTEXT_ID = `ctx-${PRIMARY_ROOM_ID}`;

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
    meta: Record<string, unknown>;
    scores: Record<string, number>;
    title: string;
    detail?: { kind: "replace" | "patch"; value: string; format?: string };
    preserveContext?: boolean;
  },
): AttentionCommit =>
  internal.attentionSystem.commit(contextId, {
    meta: input.meta,
    scores: input.scores,
    summary: input.title,
    change: buildCommitChange(internal, contextId, input),
  }).commit;

const createTerminalSystem = (root: string): TerminalControlPlane =>
  new TerminalControlPlane({
    dbPath: join(root, "terminal.db"),
    outputRoot: join(root, "terminals"),
  });

const createRuntime = (): SessionRuntime => {
  const root = mkdtempSync(join(tmpdir(), "agenter-session-runtime-"));
  return new SessionRuntime({
    sessionId: `s-${Date.now()}`,
    cwd: root,
    sessionRoot: join(root, "session"),
    sessionName: "test",
    storeTarget: "workspace",
    primaryRoomId: PRIMARY_ROOM_ID,
    allocateRoomId: createRuntimeRoomAllocator(),
    terminalSystem: createTerminalSystem(root),
  });
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
  });

describe("Feature: session runtime attention-system loop inputs", () => {
  test("Scenario: Given plugin-backed user chat When collectLoopInputs runs Then the batch is attention-native without raw chat duplication", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal;
    internal.loopPluginRuntime = await internal.createLoopPluginRuntime();

    runtime.pushUserChat("Please continue the task");

    const firstRound = await internal.collectLoopInputs();
    expect(firstRound?.some((item) => item.source === "chat" && item.text === "Please continue the task")).toBe(false);
    const attentionInput = firstRound?.find((item) => item.source === "attention");
    expect(attentionInput).toBeDefined();
    if (!attentionInput) {
      return;
    }

    expect(attentionInput.text).toContain("contextId:");
    expect(attentionInput.text).toContain("Please continue the task");
    expect(attentionInput.meta?.attentionContextId).toBe(PRIMARY_CONTEXT_ID);
    expect(attentionInput.meta?.chatId).toBe(PRIMARY_ROOM_ID);
    expect(attentionInput.meta?.chatFocused).toBe(true);
    expect(typeof attentionInput.meta?.attentionHeadCommitId).toBe("string");
    expect(internal.resolveCycleReplyChatId([attentionInput])).toBe(PRIMARY_ROOM_ID);

    const secondRound = await internal.collectLoopInputs();
    expect(secondRound).toBeUndefined();
  });

  test("Scenario: Given plugin-backed user chat arrives during a model tool phase When interleaved agent inputs are collected Then only attention-native payload is returned for the next model request", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal;
    internal.loopPluginRuntime = await internal.createLoopPluginRuntime();

    runtime.pushUserChat("再补充一个条件");

    const interleaved = await internal.collectInterleavedAgentInputs();
    expect(interleaved?.some((item) => item.source === "chat")).toBe(false);
    const attentionInput = interleaved?.find((item) => item.source === "attention");
    expect(attentionInput).toBeDefined();
    if (!attentionInput) {
      return;
    }

    expect(attentionInput.meta?.attentionContextId).toBe(PRIMARY_CONTEXT_ID);
    expect(attentionInput.meta?.chatId).toBe(PRIMARY_ROOM_ID);
    expect(attentionInput.text).toContain("再补充一个条件");

    const nextRound = await internal.collectInterleavedAgentInputs();
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

    const secondRound = await internal.collectLoopInputs();
    expect(secondRound).toBeDefined();
    expect(secondRound?.some((item) => item.source === "task")).toBe(false);
    expect(secondRound?.every((item) => item.source === "attention")).toBe(true);

    const activeTaskItems = getActiveItems(internal).filter((item) => item.meta.source === "task");
    expect(activeTaskItems.length).toBeGreaterThan(0);
    expect(activeTaskItems.some((item) => item.title.includes("Task trigger time"))).toBe(true);
    expect(activeTaskItems.some((item) => item.title.includes("Task heartbeat"))).toBe(true);
    expect(activeTaskItems.some((item) => item.detail?.value.includes("task-triggered"))).toBe(true);
  });

  test("Scenario: Given a non-default chat channel When plugin-backed attention is collected Then replies still route back to that originating channel", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal;
    internal.loopPluginRuntime = await internal.createLoopPluginRuntime();

    const channel = await runtime.createMessageChannel({
      kind: "room",
      title: "Room 2",
      focus: false,
    });

    runtime.sendMessageChannel({
      chatId: channel.chatId,
      accessToken: channel.accessToken,
      text: "[lunch-relay] ask gaubee lunch",
    });

    const firstRound = await internal.collectLoopInputs();
    const attentionInput = firstRound?.find((item) => item.source === "attention");
    expect(attentionInput).toBeDefined();
    if (!attentionInput) {
      return;
    }

    expect(attentionInput.meta?.attentionContextId).toBe(`ctx-${channel.chatId}`);
    expect(attentionInput.meta?.chatId).toBe(channel.chatId);
    expect(attentionInput.meta?.chatFocused).toBe(false);
    expect(internal.resolveCycleReplyChatId([attentionInput])).toBe(channel.chatId);
  });

  test("Scenario: Given room lifecycle mutations When runtime changes the room Then structural room events become active attention debt", async () => {
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

    const activeRoomItems = getActiveItems(internal).filter((item) => item.meta.channelId === room.chatId);
    expect(activeRoomItems.map((item) => item.title)).toContain(`Created room ${room.chatId}`);
    expect(activeRoomItems.map((item) => item.title)).toContain(`Updated chat channel ${room.chatId}`);
    expect(activeRoomItems.map((item) => item.title)).toContain(`Archived chat channel ${room.chatId}`);
    expect(
      internal.attentionSystem.listActiveContexts().some((match) => match.contextId === `ctx-${room.chatId}`),
    ).toBeTrue();
  });

  test("Scenario: Given a shared room bus When another actor is not granted or focused for a room Then queued room messages do not enter that runtime", async () => {
    const root = mkdtempSync(join(tmpdir(), "agenter-shared-room-runtime-"));
    const messageSystem = new MessageControlPlane({
      dbPath: join(root, "message.db"),
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
      expect(janeInputs?.some((input) => input.meta?.chatId === room.chatId)).toBeTrue();
      expect(jjInputs).toBeUndefined();
    } finally {
      messageSystem.close();
    }
  });

  test("Scenario: Given terminal focus changes When runtime replaces the focused terminal Then focus and unfocus facts are recorded without becoming active debt", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal;

    await runtime.start();
    try {
      const created1 = await runtime.createRuntimeTerminal({
        terminalId: "iflow-1",
        processKind: "shell",
        focus: true,
      });
      const created2 = await runtime.createRuntimeTerminal({
        terminalId: "iflow-2",
        processKind: "shell",
        focus: false,
      });

      expect(created1.ok).toBeTrue();
      expect(created2.ok).toBeTrue();

      const focusResult = runtime.focusRuntimeTerminals({
        op: "replace",
        terminalIds: ["iflow-2"],
      });
      expect(focusResult.ok).toBeTrue();

      const firstSnapshot = getAttentionContextSnapshot(internal, "ctx-terminal-iflow-1");
      const secondSnapshot = getAttentionContextSnapshot(internal, "ctx-terminal-iflow-2");
      expect(firstSnapshot?.commits.some((commit) => commit.meta.lifecycleEvent === "terminal_unfocus")).toBeTrue();
      expect(secondSnapshot?.commits.some((commit) => commit.meta.lifecycleEvent === "terminal_focus")).toBeTrue();

      const activeTerminalItems = getActiveItems(internal).filter((item) => item.meta.systemId === "terminal");
      expect(activeTerminalItems.some((item) => item.title === "Focused terminal iflow-2")).toBeFalse();
      expect(activeTerminalItems.some((item) => item.title === "Unfocused terminal iflow-1")).toBeFalse();
      expect(activeTerminalItems.some((item) => item.title === "Created terminal iflow-1")).toBeTrue();
      expect(activeTerminalItems.some((item) => item.title === "Created terminal iflow-2")).toBeTrue();
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
        terminalControlPlane.listForActor("session:observer", { touchPresence: false }).find((item) => item.terminalId === "shared-focus")
          ?.focused,
      ).toBeTrue();
    } finally {
      await runtime.stop();
    }
  });

  test("Scenario: Given terminal control-plane config changes When runtime updates config Then the change becomes active attention in the control-plane context", async () => {
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
      expect(controlPlaneContext?.commits.at(-1)?.meta.lifecycleEvent).toBe("terminal_config_update");
      expect(
        internal.attentionSystem.listActiveContexts().some((match) => match.contextId === "ctx-terminal-control-plane"),
      ).toBeTrue();
    } finally {
      await runtime.stop();
    }
  });

  test("Scenario: Given chat attention arrives while another context is already dirty When collectLoopInputs runs Then only the newest dirty context is sent to the model in that round", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal;
    internal.loopPluginRuntime = await internal.createLoopPluginRuntime();

    internal.attentionSystem.createContext({ contextId: "ctx-terminal-iflow", owner: "avatar:tester" });
    const terminalCommit = appendAttentionCommit(internal, "ctx-terminal-iflow", {
      meta: {
        author: "terminal:iflow",
        source: "terminal",
        systemId: "terminal",
        subjectId: "iflow",
      },
      scores: { hash_terminal: 100 },
      title: "Terminal iflow is waiting for auth",
    });
    await internal.handleCommittedAttentionCommit("ctx-terminal-iflow", terminalCommit, { notifyLoop: false });

    runtime.pushUserChat("Reply with exactly FOCUS-CHAT-FIRST");

    const firstRound = await internal.collectLoopInputs();
    expect(firstRound?.map((item) => item.meta?.attentionProtocolKind)).toEqual(["context", "items"]);
    expect([...new Set(firstRound?.map((item) => item.meta?.attentionContextId) ?? [])]).toEqual([PRIMARY_CONTEXT_ID]);

    const secondRound = await internal.collectLoopInputs();
    expect(secondRound?.map((item) => item.meta?.attentionProtocolKind)).toEqual(["context", "items"]);
    expect([...new Set(secondRound?.map((item) => item.meta?.attentionContextId) ?? [])]).toEqual([
      "ctx-terminal-iflow",
    ]);
  });

  test("Scenario: Given an attention round makes no progress When the final model call is recorded Then the affected context enters backoff before the next retry", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal;

    internal.attentionSystem.createContext({ contextId: PRIMARY_CONTEXT_ID, owner: "avatar:tester" });
    const chatCommit = appendAttentionCommit(internal, PRIMARY_CONTEXT_ID, {
      meta: {
        author: "User",
        source: "message",
        systemId: "message",
        subjectId: PRIMARY_ROOM_ID,
        chatId: PRIMARY_ROOM_ID,
        channelId: PRIMARY_ROOM_ID,
      },
      scores: { hash_chat: 100 },
      title: "Reply with exactly REAL-AI-OK",
    });
    await internal.handleCommittedAttentionCommit(PRIMARY_CONTEXT_ID, chatCommit, { notifyLoop: false });

    try {
      const firstRound = await internal.collectLoopInputs();
      const attentionInput = firstRound?.find((item) => item.meta?.attentionProtocolKind === "items");
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

  test("Scenario: Given compact command When pushUserChat('/compact') Then compact is requested and attention records stay untouched", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal;

    runtime.pushUserChat("/compact");

    expect((internal as RuntimeInternal & { hasPendingCompactCycle: () => boolean }).hasPendingCompactCycle()).toBe(
      true,
    );
    expect(getActiveItems(internal)).toHaveLength(0);

    const outputs = await internal.collectLoopInputs();
    expect(outputs).toHaveLength(1);
    expect(outputs?.[0]?.source).toBe("chat");
    expect(outputs?.[0]?.text).toBe("/compact");
    expect(outputs?.[0]?.meta?.cycleKind).toBe("compact");
    expect(outputs?.[0]?.meta?.compactTrigger).toBe("manual");
    expect(outputs?.[0]?.meta?.exclusiveCycle).toBe(true);
  });

  test("Scenario: Given a fresh user message While the previous cycle is still running Then attention remains invisible until the next collect batch", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal;
    internal.loopPluginRuntime = await internal.createLoopPluginRuntime();

    runtime.pushUserChat("What time is it?");

    expect(getActiveItems(internal)).toHaveLength(0);

    const firstRound = await internal.collectLoopInputs();
    expect(firstRound?.some((item) => item.source === "attention" && item.text.includes("What time is it?"))).toBe(
      true,
    );
    expect(getActiveItems(internal)).toHaveLength(1);
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

  test("Scenario: Given legacy terminal attention metadata When the runtime serializes attention for the model Then giant fingerprint blobs are compacted into short hash previews", async () => {
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
        terminalId: "iflow",
        representation: "diff",
        semanticHash: hugeFingerprint,
        viewHash: hugeFingerprint,
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
    const attentionInput = batch?.find((entry) => entry.source === "attention");
    expect(attentionInput).toBeDefined();
    if (!attentionInput) {
      return;
    }

    expect(attentionInput.text).toContain("sha256:");
    expect(attentionInput.text).not.toContain("richLines");
    expect(attentionInput.text.length).toBeLessThan(4_000);
  });

  test("Scenario: Given a resolved-only attention item When querying without minScore override Then score-zero rows stay filtered out", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal;

    internal.attentionSystem.createContext({ contextId: PRIMARY_CONTEXT_ID, owner: "avatar:tester" });
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

    internal.attentionSystem.createContext({ contextId: PRIMARY_CONTEXT_ID, owner: "avatar:tester" });
    appendAttentionCommit(internal, PRIMARY_CONTEXT_ID, {
      meta: {
        author: "User",
        source: "message",
        systemId: "message",
        subjectId: "msg-1",
        channelId: PRIMARY_ROOM_ID,
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
    const attentionInput = firstBatch?.find((item) => item.meta?.attentionProtocolKind === "items");
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
    expect(migrated.version).toBe(4);
    expect(migrated.contexts[0]?.commits[0]?.summary).toBe("legacy attention");
  });

  test("Scenario: Given a plugin runtime-backed user message When attention drafts flush Then the message is committed before cycle gating", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal;

    internal.loopPluginRuntime = await internal.createLoopPluginRuntime();
    runtime.pushUserChat("plugin-backed message");

    const changed = await internal.flushPluginAttentionDrafts();
    expect(changed).toBe(true);
    const facts = getActiveItems(internal);
    expect(facts).toHaveLength(1);
    expect(facts[0]?.title).toBe("plugin-backed message");
    expect(facts[0]?.meta.author).toBe("User");
  });

  test("Scenario: Given a focused terminal invalidation When plugin attention drafts flush Then terminal output is committed into attention", async () => {
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
    internal.terminalDirtyState.iflow = true;
    internal.terminalLatestSeq.iflow = 7;
    internal.loopPluginRuntime = await internal.createLoopPluginRuntime();
    internal.loopPluginRuntime.invalidate({
      systemId: "terminal",
      subjectId: "iflow",
      reason: "semantic-change",
      versionHint: 7,
    });

    const changed = await internal.flushPluginAttentionDrafts();
    expect(changed).toBe(true);
    const facts = getActiveItems(internal);
    expect(facts).toHaveLength(1);
    expect(facts[0]?.meta.author).toBe("terminal:iflow");
    expect(facts[0]?.title).toBe("Terminal iflow: echo ready");
    expect(facts[0]?.detail?.kind).toBe("replace");
    expect(facts[0]?.detail?.format).toBe("text/markdown");
    expect(facts[0]?.detail?.value).toContain("```yaml");
    expect(facts[0]?.detail?.value).toContain("terminalId: iflow");
    expect(facts[0]?.detail?.value).toContain("```text");
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
    internal.terminalDirtyState.iflow = true;
    internal.terminalLatestSeq.iflow = 8;
    internal.loopPluginRuntime = await internal.createLoopPluginRuntime();
    internal.loopPluginRuntime.invalidate({
      systemId: "terminal",
      subjectId: "iflow",
      reason: "semantic-change",
      versionHint: 8,
    });

    const changed = await internal.flushPluginAttentionDrafts();
    expect(changed).toBe(false);
    expect(getActiveItems(internal)).toHaveLength(0);
  });

  test("Scenario: Given a focused terminal diff invalidation When plugin attention drafts flush Then the committed attention item keeps patch semantics for the context log", async () => {
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
    internal.terminalDirtyState.iflow = true;
    internal.terminalLatestSeq.iflow = 12;
    internal.loopPluginRuntime = await internal.createLoopPluginRuntime();
    internal.loopPluginRuntime.invalidate({
      systemId: "terminal",
      subjectId: "iflow",
      reason: "semantic-change",
      versionHint: 12,
    });

    const changed = await internal.flushPluginAttentionDrafts();
    expect(changed).toBe(true);

    const facts = getActiveItems(internal);
    expect(facts).toHaveLength(1);
    expect(facts[0]?.title).toBe("Terminal iflow diff updated");
    expect(facts[0]?.detail?.kind).toBe("patch");
    expect(facts[0]?.detail?.value).toContain("```diff");
  });

  test("Scenario: Given a focused terminal invalidation with unchanged semantic content When plugin drafts flush twice Then no duplicate attention delta is committed", async () => {
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
    internal.terminalDirtyState.iflow = true;
    internal.terminalLatestSeq.iflow = 8;
    internal.loopPluginRuntime = await internal.createLoopPluginRuntime();

    internal.loopPluginRuntime.invalidate({
      systemId: "terminal",
      subjectId: "iflow",
      reason: "semantic-change",
      versionHint: 8,
    });
    expect(await internal.flushPluginAttentionDrafts()).toBe(true);
    expect(getActiveItems(internal)).toHaveLength(1);

    internal.terminalDirtyState.iflow = true;
    internal.loopPluginRuntime.invalidate({
      systemId: "terminal",
      subjectId: "iflow",
      reason: "semantic-change",
      versionHint: 8,
    });
    expect(await internal.flushPluginAttentionDrafts()).toBe(false);
    expect(getActiveItems(internal)).toHaveLength(1);
  });

  test("Scenario: Given repeated focused terminal observations When a newer terminal draft commits Then older terminal debt is superseded", async () => {
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
    internal.terminalDirtyState.iflow = true;
    internal.terminalLatestSeq.iflow = 8;
    internal.loopPluginRuntime = await internal.createLoopPluginRuntime();

    internal.terminalSemanticFingerprint.iflow = "semantic-a";
    internal.terminalViewFingerprint.iflow = "view-a";
    internal.loopPluginRuntime.invalidate({
      systemId: "terminal",
      subjectId: "iflow",
      reason: "semantic-change",
      versionHint: 8,
    });
    expect(await internal.flushPluginAttentionDrafts()).toBe(true);
    expect(getActiveItems(internal)).toHaveLength(1);

    snapshot = {
      ...snapshot,
      seq: 9,
      lines: ["echo changed"],
    };
    internal.terminalDirtyState.iflow = true;
    internal.terminalLatestSeq.iflow = 9;
    internal.terminalSemanticFingerprint.iflow = "semantic-b";
    internal.terminalViewFingerprint.iflow = "view-b";
    internal.loopPluginRuntime.invalidate({
      systemId: "terminal",
      subjectId: "iflow",
      reason: "semantic-change",
      versionHint: 9,
    });

    expect(await internal.flushPluginAttentionDrafts()).toBe(true);

    const allTerminalItems = internal.attentionSystem.query({ minScore: 0, text: "Terminal iflow" });
    expect(allTerminalItems).toHaveLength(3);
    expect(getActiveMatches(internal)).toHaveLength(1);
    expect(allTerminalItems.some((match) => Object.values(match.commit.scores).every((score) => score === 0))).toBe(
      true,
    );
    expect(
      allTerminalItems.some(
        (match) =>
          match.commit.summary.includes("echo changed") &&
          Object.values(match.commit.scores).some((score) => score >= 1),
      ),
    ).toBe(true);
  });

  test("Scenario: Given a terminal source invalidation without readable output When plugin drafts flush Then no attention delta is committed", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal;

    internal.loopPluginRuntime = await internal.createLoopPluginRuntime();
    internal.loopPluginRuntime.invalidate({
      systemId: "terminal",
      subjectId: "missing-terminal",
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
    expect("kind" in payload && payload.kind).toBe("terminal-snapshot");
    expect(internal.terminalReads.main?.representation).toBe("snapshot");
  });

  test("Scenario: Given source-driven drafts When a cycle policy hook defers Then attention commits but cycle start stays deferred", async () => {
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
      systemId: "terminal",
      subjectId: "iflow",
      reason: "semantic-change",
      versionHint: 9,
    });

    const drafts = await pluginRuntime.readInvalidatedAttentionDrafts();
    expect(drafts).toHaveLength(1);

    await internal.commitAttentionDrafts(drafts);
    const decision = await pluginRuntime.shouldStartCycle(drafts);

    expect(getActiveItems(internal)).toHaveLength(1);
    expect(decision).toEqual({ allow: false, reason: "policy-deferred" });
  });

  test("Scenario: Given attention refs and message egress When trace lookup runs Then causal spans expose model and dispatch links", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal;

    internal.attentionSystem.createContext({ contextId: PRIMARY_CONTEXT_ID, owner: "avatar:tester" });
    const chatCommit = appendAttentionCommit(internal, PRIMARY_CONTEXT_ID, {
      meta: {
        author: "User",
        source: "message",
        systemId: "message",
        subjectId: PRIMARY_ROOM_ID,
        chatId: PRIMARY_ROOM_ID,
        channelId: PRIMARY_ROOM_ID,
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
        replyTarget: {
          systemId: "message",
          subjectId: PRIMARY_ROOM_ID,
          channelId: PRIMARY_ROOM_ID,
          from: "tester",
          to: "User",
        },
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
    expect(replyTraceKinds).toContain("attention.hook");

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

      internal.attentionSystem.createContext({ contextId: PRIMARY_CONTEXT_ID, owner: "avatar:tester" });
      const chatCommit = appendAttentionCommit(internal, PRIMARY_CONTEXT_ID, {
        meta: {
          author: "User",
          source: "message",
          systemId: "message",
          subjectId: PRIMARY_ROOM_ID,
          chatId: PRIMARY_ROOM_ID,
          channelId: PRIMARY_ROOM_ID,
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

    internal.attentionSystem.createContext({ contextId: PRIMARY_CONTEXT_ID, owner: "avatar:tester" });
    const chatCommit = appendAttentionCommit(internal, PRIMARY_CONTEXT_ID, {
      meta: {
        author: "User",
        source: "message",
        systemId: "message",
        subjectId: PRIMARY_ROOM_ID,
        chatId: PRIMARY_ROOM_ID,
        channelId: PRIMARY_ROOM_ID,
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

  test("Scenario: Given a reply-targeted attention item When message egress succeeds Then runtime attention state records a delivered channel dispatch using the commit body instead of the internal summary", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal;

    await runtime.start();
    const commit = appendAttentionCommit(internal, PRIMARY_CONTEXT_ID, {
      meta: {
        author: "avatar:tester",
        source: "attention",
        replyTarget: {
          systemId: "message",
          subjectId: PRIMARY_ROOM_ID,
          channelId: PRIMARY_ROOM_ID,
          from: "tester",
          to: "User",
        },
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
    expect(snapshot.attention?.hooks.at(-1)?.status).toBe("delivered");
    expect(snapshot.attention?.hooks.at(-1)?.systemId).toBe("message");
    expect(snapshot.chatMessages.at(-1)?.content).toBe("delivered reply");
    expect(
      (internal as unknown as RuntimeMessageEgressInternal).messageSystem.snapshot(PRIMARY_ROOM_ID, 10).items.at(-1)
        ?.content,
    ).toBe("delivered reply");

    await runtime.stop();
  });

  test("Scenario: Given a message_send tool dispatch during an active cycle When chat-channel egress persists the assistant reply Then the transport snapshot keeps cycle metadata for Devtools navigation", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeMessageEgressInternal;

    internal.attentionSystem.createContext({ contextId: PRIMARY_CONTEXT_ID, owner: "avatar:tester" });
    const chatCommit = appendAttentionCommit(internal, PRIMARY_CONTEXT_ID, {
      meta: {
        author: "User",
        source: "message",
        systemId: "message",
        subjectId: PRIMARY_ROOM_ID,
        chatId: PRIMARY_ROOM_ID,
        channelId: PRIMARY_ROOM_ID,
      },
      scores: { hash_message_send: 100 },
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
      content: "Delivered through message_send",
    });

    const message = internal.messageSystem.snapshot(PRIMARY_ROOM_ID, 10).items.at(-1);
    expect(message?.content).toBe("Delivered through message_send");
    expect(message?.rootId).toBe(String(cycleId));
    expect(message?.metadata).toMatchObject({
      channel: "to_user",
      source: "message_send",
      cycleId,
    });

    await runtime.stop();
  });

  test("Scenario: Given a message_send dispatch already sent a visible reply When a later replyTarget commit targets the same chat and cycle Then the runtime suppresses the duplicate bridge message", async () => {
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
      content: "Delivered through message_send",
    });

    const duplicateCommit = appendAttentionCommit(internal, PRIMARY_CONTEXT_ID, {
      meta: {
        author: "avatar:tester",
        source: "attention",
        replyTarget: {
          systemId: "message",
          subjectId: PRIMARY_ROOM_ID,
          channelId: PRIMARY_ROOM_ID,
          from: "tester",
          to: "User",
        },
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
    expect(afterMessages.at(-1)?.content).toBe("Delivered through message_send");
    expect(runtime.snapshot().attention?.hooks.at(-1)?.status).toBe("ignored");
    expect(runtime.snapshot().attention?.hooks.at(-1)?.output).toMatchObject({
      reason: "duplicate-visible-dispatch",
      attentionContextId: PRIMARY_CONTEXT_ID,
      attentionCommitId: duplicateCommit.commitId,
    });
    expect(afterMessages.at(-1)?.metadata).toMatchObject({
      source: "message_send",
      cycleId,
    });

    await runtime.stop();
  });

  test("Scenario: Given a visible assistant reply already exists with no newer user message When message_send repeats the same chat content Then the runtime reuses the existing message instead of appending a duplicate", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeMessageEgressInternal;

    await runtime.start();
    const first = await internal.sendMessageTool({
      chatId: PRIMARY_ROOM_ID,
      content: "稍等，我去问一下。",
      from: "tester",
      to: "User",
    });
    const second = await internal.sendMessageTool({
      chatId: PRIMARY_ROOM_ID,
      content: "稍等，我去问一下。",
      from: "tester",
      to: "User",
    });

    const messages = internal.messageSystem.snapshot(PRIMARY_ROOM_ID, 10).items;
    expect(messages.filter((message) => message.content === "稍等，我去问一下。")).toHaveLength(1);
    expect(second.messageId).toBe(first.messageId);

    await runtime.stop();
  });

  test("Scenario: Given room-backed chat blocks only store refs When the runtime restarts Then chat history is rebuilt from room truth instead of stale session copies", async () => {
    const root = mkdtempSync(join(tmpdir(), "agenter-session-runtime-restart-"));
    const sessionRoot = join(root, "session");
    const options = {
      sessionId: "s-room-restart",
      cwd: root,
      sessionRoot,
      sessionName: "room-restart",
      storeTarget: "workspace" as const,
      primaryRoomId: PRIMARY_ROOM_ID,
      allocateRoomId: createRuntimeRoomAllocator(),
      terminalSystem: createTerminalSystem(root),
    };
    const runtime = new SessionRuntime(options);

    await runtime.start();
    await runtime.pause();
    runtime.pushUserChat("restore from room truth");

    const db = new SessionDb(join(sessionRoot, "session.db"));
    try {
      const block = db.listBlocksAfter(0, 20).find((item) => item.projection?.source === "room-message-ref");
      if (!block?.messageId || !block.projection) {
        throw new Error("expected persisted room-backed block");
      }
      expect(block.content).toBe("");
      expect(block.attachments).toEqual([]);
      db.upsertMessageBlock({
        cycleId: block.cycleId,
        createdAt: block.createdAt,
        updatedAt: block.updatedAt + 1,
        messageId: block.messageId,
        projection: block.projection,
        visibleAt: block.visibleAt,
        attentionState: block.attentionState,
        attentionLoadedAt: block.attentionLoadedAt,
        role: block.role,
        channel: block.channel,
        chatId: block.chatId,
        format: block.format,
        content: "stale local copy",
        tool: block.tool,
      });
    } finally {
      db.close();
    }
    await runtime.stop();

    const restarted = new SessionRuntime(options);
    await restarted.start();
    await restarted.pause();

    const restored = restarted.snapshot().chatMessages;
    expect(restored.some((item) => item.content === "restore from room truth")).toBeTrue();
    expect(restored.some((item) => item.content === "stale local copy")).toBeFalse();

    await restarted.stop();
  });

  test("Scenario: Given a cycle originates from the primary room When message_send targets a relay room first Then runtime auto-acknowledges the origin room before relay dispatch", async () => {
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
    expect(mainMessages).toHaveLength(1);
    expect(mainMessages.at(-1)?.content).toBe("Understood. I'll handle it and report back.");
    expect(mainMessages.at(-1)?.metadata).toMatchObject({
      source: "message_send",
      cycleId,
      autoOriginAck: true,
      relayTargetChatId: relayChannel.chatId,
    });
    expect(relayMessages.at(-1)?.content).toBe("gaubee，今天中午吃什么？");
    expect(relayMessages.at(-1)?.metadata).toMatchObject({
      source: "message_send",
      cycleId,
    });

    await runtime.stop();
  });

  test("Scenario: Given a reply-targeted attention item When message egress fails Then the failure stays in attention state and Chat stays quiet", async () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternal;

    await runtime.start();
    const commit = appendAttentionCommit(internal, PRIMARY_CONTEXT_ID, {
      meta: {
        author: "avatar:tester",
        source: "attention",
        replyTarget: {
          systemId: "message",
          subjectId: "chat-missing",
          channelId: "chat-missing",
          from: "tester",
          to: "User",
        },
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
    expect(snapshot.attention?.hooks.at(-1)?.status).toBe("failed");
    expect(snapshot.attention?.hooks.at(-1)?.target).toEqual({
      chatId: "chat-missing",
    });
    expect(snapshot.chatMessages).toHaveLength(beforeCount);

    await runtime.stop();
  });
});
