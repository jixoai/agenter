import type { MessageControlPlane, MessageControlPlaneEntry, MessageRecord } from "@agenter/message-system";

import type { ChatCycle, ChatMessage, SessionRuntimeAttentionState } from "../src";
import { excludeActiveContextPrefixes, waitForScopedAttentionSettled } from "./attention-test-primitive";
import type { MockKernelHarness } from "./mock-kernel-harness";
import { waitForMockValue } from "./mock-kernel-harness";
import { MOCK_FINAL_ANSWER, MOCK_GAUBEE_REPLY, MOCK_RELAY_PROMPT } from "./mock-model-server";

const DEFAULT_TIMEOUT_MS = 30_000;
const chatScenarioAttentionScope = excludeActiveContextPrefixes("ctx-task-source-");
const getPrimaryRoomId = (harness: MockKernelHarness): string => {
  if (!harness.session.primaryRoomId) {
    throw new Error(`missing primaryRoomId for session ${harness.session.id}`);
  }
  return harness.session.primaryRoomId;
};
const getMessageControlPlane = (harness: MockKernelHarness): MessageControlPlane =>
  Reflect.get(harness.kernel, "messageControlPlane") as MessageControlPlane;

const toChatMessage = (harness: MockKernelHarness, message: MessageRecord): ChatMessage => ({
  id: String(message.messageId),
  chatId: message.chatId,
  role: message.from === harness.session.avatar ? "assistant" : "user",
  content: message.content,
  timestamp: message.createdAt,
  updatedAt: message.updatedAt,
  visibleAt: message.visibleAt,
});

const listRoomTruthMessages = (harness: MockKernelHarness): ChatMessage[] =>
  harness.kernel
    .listMessageChannels(harness.session.id)
    .flatMap((channel) => getMessageControlPlane(harness).snapshot(channel.chatId, 50).items.map((item) => toChatMessage(harness, item)))
    .sort((left, right) => left.timestamp - right.timestamp);

const getAssistantMessages = (
  messages: ChatMessage[],
  predicate: (message: ChatMessage) => boolean,
): ChatMessage[] => messages.filter((message) => message.role === "assistant" && predicate(message));

const getUserMessages = (
  messages: ChatMessage[],
  predicate: (message: ChatMessage) => boolean,
): ChatMessage[] => messages.filter((message) => message.role === "user" && predicate(message));

export const waitForAssistantMessage = async (
  harness: MockKernelHarness,
  input: {
    label: string;
    predicate: (message: ChatMessage) => boolean;
    timeoutMs?: number;
  },
): Promise<ChatMessage> =>
  await waitForMockValue(
    () => {
      return getAssistantMessages(listRoomTruthMessages(harness), input.predicate).at(-1) ?? null;
    },
    {
      label: input.label,
      timeoutMs: input.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    },
  );

export const waitForUserMessage = async (
  harness: MockKernelHarness,
  input: {
    label: string;
    predicate: (message: ChatMessage) => boolean;
    timeoutMs?: number;
  },
): Promise<ChatMessage> =>
  await waitForMockValue(
    () => {
      return getUserMessages(listRoomTruthMessages(harness), input.predicate).at(-1) ?? null;
    },
    {
      label: input.label,
      timeoutMs: input.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    },
  );

export const waitForAttentionSettled = async (
  harness: MockKernelHarness,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<SessionRuntimeAttentionState> =>
  await waitForScopedAttentionSettled(
    async () => await harness.kernel.inspectAttentionState(harness.session.id),
    waitForMockValue,
    chatScenarioAttentionScope,
    timeoutMs,
  );

export const waitForCompactCycle = async (
  harness: MockKernelHarness,
  input: {
    afterCycleId: number;
    timeoutMs?: number;
  },
): Promise<ChatCycle> =>
  await waitForMockValue(
    () => {
      const cycles = harness.kernel.listChatCycles(harness.session.id, 40);
      return (
        cycles.find(
          (cycle) =>
            cycle.kind === "compact" &&
            cycle.compactTrigger === "manual" &&
            cycle.status === "done" &&
            cycle.cycleId !== null &&
            cycle.cycleId > input.afterCycleId,
        ) ?? null
      );
    },
    {
      label: "manual compact cycle",
      timeoutMs: input.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    },
  );

const waitForPromptWindowCompactApplied = async (
  harness: MockKernelHarness,
  timeoutMs = DEFAULT_TIMEOUT_MS,
) =>
  await waitForMockValue(
    async () => {
      const debug = await harness.kernel.inspectModelDebug(harness.session.id);
      return JSON.stringify(debug.promptWindow).includes("prompt_window_compact") ? debug.promptWindow : null;
    },
    {
      label: "prompt-window compact applied",
      timeoutMs,
    },
  );

const listRecentModelCalls = async (harness: MockKernelHarness) => {
  const debug = await harness.kernel.inspectModelDebug(harness.session.id);
  return debug.recentModelCalls;
};

const countRelayPrompts = (harness: MockKernelHarness, chatId: string): number => {
  return getAssistantMessages(listRoomTruthMessages(harness), (message) => message.chatId === chatId && message.content.trim() === MOCK_RELAY_PROMPT).length;
};

export interface TwoRoomRelayScenarioResult {
  relayChannel: MessageControlPlaneEntry;
  relayPromptMessage: ChatMessage;
  relayParticipantReply: ChatMessage;
  finalReply: ChatMessage;
  settledAttention: SessionRuntimeAttentionState;
  recentModelCalls: Awaited<ReturnType<typeof listRecentModelCalls>>;
}

export const createGaubeeRoom = async (harness: MockKernelHarness): Promise<MessageControlPlaneEntry> =>
  await harness.kernel.createMessageChannel({
    sessionId: harness.session.id,
    kind: "room",
    title: "gaubee",
    participants: [
      { id: "session:relay-bot", label: "relay-bot" },
      { id: "auth:gaubee", label: "gaubee" },
    ],
    focus: false,
  });

export const runTwoRoomRelayScenario = async (
  harness: MockKernelHarness,
  relayChannel?: MessageControlPlaneEntry,
): Promise<TwoRoomRelayScenarioResult> => {
  const primaryRoomId = getPrimaryRoomId(harness);
  const resolvedRelayChannel = relayChannel ?? (await createGaubeeRoom(harness));
  const sent = await harness.kernel.sendChat(harness.session.id, "gaubee在吗？问他中午吃什么？");
  if (!sent.ok) {
    throw new Error(`failed to send relay prompt: ${sent.reason ?? "unknown"}`);
  }

  const relayPromptMessage = await waitForAssistantMessage(harness, {
    label: "relay prompt to gaubee room",
    predicate: (message) => message.chatId === resolvedRelayChannel.chatId && message.content.trim() === MOCK_RELAY_PROMPT,
  });

  const replySent = await harness.kernel.sendMessageChannel({
    sessionId: harness.session.id,
    chatId: resolvedRelayChannel.chatId,
    accessToken: resolvedRelayChannel.accessToken,
    text: MOCK_GAUBEE_REPLY,
  });
  if (!replySent.ok) {
    throw new Error(`failed to send gaubee reply: ${replySent.reason ?? "unknown"}`);
  }

  const relayParticipantReply = await waitForUserMessage(harness, {
    label: "gaubee reply on secondary room",
    predicate: (message) => message.chatId === resolvedRelayChannel.chatId && message.content.trim() === MOCK_GAUBEE_REPLY,
  });

  const finalReply = await waitForAssistantMessage(harness, {
    label: "final reply on main room",
    predicate: (message) => message.chatId === primaryRoomId && message.content.trim() === MOCK_FINAL_ANSWER,
  });

  const settledAttention = await waitForAttentionSettled(harness);
  const recentModelCalls = await listRecentModelCalls(harness);

  return {
    relayChannel: resolvedRelayChannel,
    relayPromptMessage,
    relayParticipantReply,
    finalReply,
    settledAttention,
    recentModelCalls,
  };
};

export interface CompactFollowUpScenarioResult {
  compactCycle: ChatCycle;
  followUpReply: ChatMessage;
  relayPromptCountBefore: number;
  relayPromptCountAfter: number;
  settledAttention: SessionRuntimeAttentionState;
}

export const runCompactFollowUpScenario = async (
  harness: MockKernelHarness,
  input: {
    relayChannel: MessageControlPlaneEntry;
    afterReplyTimestamp: number;
  },
): Promise<CompactFollowUpScenarioResult> => {
  const primaryRoomId = getPrimaryRoomId(harness);
  const cyclesBefore = harness.kernel.listChatCycles(harness.session.id, 40);
  const lastCycleId = cyclesBefore.at(-1)?.cycleId ?? 0;
  const relayPromptCountBefore = countRelayPrompts(harness, input.relayChannel.chatId);

  const compactSent = await harness.kernel.sendChat(harness.session.id, "/compact");
  if (!compactSent.ok) {
    throw new Error(`failed to request compact: ${compactSent.reason ?? "unknown"}`);
  }

  const compactCycle = await waitForCompactCycle(harness, { afterCycleId: lastCycleId });
  await waitForPromptWindowCompactApplied(harness);

  const followUpSent = await harness.kernel.sendChat(harness.session.id, "中午吃什么");
  if (!followUpSent.ok) {
    throw new Error(`failed to send follow-up question: ${followUpSent.reason ?? "unknown"}`);
  }

  const followUpReply = await waitForAssistantMessage(harness, {
    label: "post-compact follow-up answer",
    predicate: (message) =>
      message.chatId === primaryRoomId &&
      message.content.trim() === MOCK_FINAL_ANSWER &&
      message.timestamp > input.afterReplyTimestamp,
  });

  const relayPromptCountAfter = countRelayPrompts(harness, input.relayChannel.chatId);
  const settledAttention = await waitForAttentionSettled(harness);

  return {
    compactCycle,
    followUpReply,
    relayPromptCountBefore,
    relayPromptCountAfter,
    settledAttention,
  };
};

export interface SettledFollowUpScenarioResult {
  followUpReply: ChatMessage;
  relayPromptCountBefore: number;
  relayPromptCountAfter: number;
  settledAttention: SessionRuntimeAttentionState;
}

export const runSettledFollowUpScenario = async (
  harness: MockKernelHarness,
  input: {
    relayChannel: MessageControlPlaneEntry;
    afterReplyTimestamp: number;
  },
): Promise<SettledFollowUpScenarioResult> => {
  const primaryRoomId = getPrimaryRoomId(harness);
  const relayPromptCountBefore = countRelayPrompts(harness, input.relayChannel.chatId);

  await waitForMockValue(
    () => {
      const runtime = harness.kernel.getSnapshot().runtimes[harness.session.id];
      return runtime?.schedulerPhase === "waiting_commits" && runtime.stage === "idle" ? runtime : null;
    },
    {
      label: "settled runtime idle",
      timeoutMs: DEFAULT_TIMEOUT_MS,
    },
  );

  const followUpSent = await harness.kernel.sendChat(harness.session.id, "中午吃什么");
  if (!followUpSent.ok) {
    throw new Error(`failed to send settled follow-up: ${followUpSent.reason ?? "unknown"}`);
  }

  const followUpReply = await waitForAssistantMessage(harness, {
    label: "settled follow-up answer",
    predicate: (message) =>
      message.chatId === primaryRoomId &&
      message.content.trim() === MOCK_FINAL_ANSWER &&
      message.timestamp > input.afterReplyTimestamp,
  });

  const relayPromptCountAfter = countRelayPrompts(harness, input.relayChannel.chatId);
  const settledAttention = await waitForAttentionSettled(harness);

  return {
    followUpReply,
    relayPromptCountBefore,
    relayPromptCountAfter,
    settledAttention,
  };
};
