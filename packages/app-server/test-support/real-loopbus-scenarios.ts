import type { MessageControlPlaneEntry } from "@agenter/message-system";

import type { ChatCycle, ChatMessage, SessionRuntimeAttentionState, SessionRuntimeSnapshot } from "../src";
import type { RealKernelHarness } from "./real-kernel-harness";
import { waitForRealValue } from "./real-kernel-harness";

const DEFAULT_TIMEOUT_MS = 120_000;

const getRuntimeSnapshot = (harness: RealKernelHarness): SessionRuntimeSnapshot | null =>
  harness.kernel.getSnapshot().runtimes[harness.session.id] ?? null;

const getAssistantMessages = (
  runtime: SessionRuntimeSnapshot,
  predicate: (message: ChatMessage) => boolean,
): ChatMessage[] =>
  runtime.chatMessages.filter((message) => message.role === "assistant" && predicate(message));

const getUserMessages = (runtime: SessionRuntimeSnapshot, predicate: (message: ChatMessage) => boolean): ChatMessage[] =>
  runtime.chatMessages.filter((message) => message.role === "user" && predicate(message));

const countAssistantMessages = (runtime: SessionRuntimeSnapshot, chatId: string): number =>
  runtime.chatMessages.filter((message) => message.role === "assistant" && message.chatId === chatId).length;

const waitForAssistantMessage = async (
  harness: RealKernelHarness,
  input: {
    label: string;
    predicate: (message: ChatMessage) => boolean;
    timeoutMs?: number;
  },
): Promise<ChatMessage> =>
  await waitForRealValue(
    () => {
      const runtime = getRuntimeSnapshot(harness);
      if (!runtime) {
        return null;
      }
      return getAssistantMessages(runtime, input.predicate).at(-1) ?? null;
    },
    {
      label: input.label,
      timeoutMs: input.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    },
  );

const waitForAttentionSettled = async (harness: RealKernelHarness, timeoutMs = DEFAULT_TIMEOUT_MS) =>
  await waitForRealValue(
    async () => {
      const attention = await harness.kernel.inspectAttentionState(harness.session.id);
      return attention.active.length === 0 ? attention : null;
    },
    {
      label: "attention convergence",
      timeoutMs,
    },
  );

const waitForCompactCycle = async (
  harness: RealKernelHarness,
  input: {
    afterCycleId: number;
    timeoutMs?: number;
  },
): Promise<ChatCycle> =>
  await waitForRealValue(
    () => {
      const cycles = harness.kernel.listChatCycles(harness.session.id, 40);
      return (
        cycles.find(
          (cycle) =>
            cycle.kind === "compact" && cycle.compactTrigger === "manual" && cycle.cycleId > input.afterCycleId,
        ) ?? null
      );
    },
    {
      label: "manual compact cycle",
      timeoutMs: input.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    },
  );

const waitForPromptWindowCompactApplied = async (
  harness: RealKernelHarness,
  timeoutMs = DEFAULT_TIMEOUT_MS,
) =>
  await waitForRealValue(
    async () => {
      const debug = await harness.kernel.inspectModelDebug(harness.session.id);
      return JSON.stringify(debug.promptWindow).includes("prompt_window_compact") ? debug.promptWindow : null;
    },
    {
      label: "prompt-window compact applied",
      timeoutMs,
    },
  );

const listRecentModelCalls = async (harness: RealKernelHarness) => {
  const debug = await harness.kernel.inspectModelDebug(harness.session.id);
  return debug.recentModelCalls.map((call) => ({
    id: call.id,
    cycleId: call.cycleId,
    status: call.status,
    outcome: call.outcome?.code ?? null,
  }));
};

const waitForLatestModelCallCompletion = async (
  harness: RealKernelHarness,
  timeoutMs = DEFAULT_TIMEOUT_MS,
) =>
  await waitForRealValue(
    async () => {
      const calls = await listRecentModelCalls(harness);
      const latest = calls.at(-1) ?? null;
      if (!latest || latest.status === "running") {
        return null;
      }
      return calls;
    },
    {
      label: "latest model call completion",
      timeoutMs,
    },
  );

export interface RealSimpleReplyScenarioResult {
  reply: ChatMessage;
  settledAttention: SessionRuntimeAttentionState;
  recentModelCalls: Array<{
    id: number;
    cycleId: number;
    status: "running" | "done" | "error" | "cancelled";
    outcome: string | null;
  }>;
}

export const runRealSimpleReplyScenario = async (
  harness: RealKernelHarness,
): Promise<RealSimpleReplyScenarioResult> => {
  const prompt = [
    "请完成一个最小的 attention-first 闭环。",
    "只向 chat-main 发送一条用户可见消息，内容必须精确等于：REAL-AI-OK。",
    "完成后把相关 attention score 收敛到 0。",
  ].join("\n");
  const sent = await harness.kernel.sendChat(harness.session.id, prompt);
  if (!sent.ok) {
    throw new Error(`failed to send simple real-ai prompt: ${sent.reason ?? "unknown"}`);
  }

  const reply = await waitForAssistantMessage(harness, {
    label: "simple reply on chat-main",
    predicate: (message) => message.chatId === "chat-main" && message.content.trim() === "REAL-AI-OK",
  });
  const settledAttention = await waitForAttentionSettled(harness);
  const recentModelCalls = await waitForLatestModelCallCompletion(harness);
  return {
    reply,
    settledAttention,
    recentModelCalls,
  };
};

export interface RealLunchRelayScenarioResult {
  relayChannel: MessageControlPlaneEntry;
  relayPromptMessage: ChatMessage;
  relayParticipantReply: ChatMessage;
  activeAfterRelay: SessionRuntimeAttentionState;
  finalReply: ChatMessage;
  settledAttention: SessionRuntimeAttentionState;
  recentModelCalls: Array<{
    id: number;
    cycleId: number;
    status: "running" | "done" | "error" | "cancelled";
    outcome: string | null;
  }>;
}

export const runRealLunchRelayScenario = async (
  harness: RealKernelHarness,
): Promise<RealLunchRelayScenarioResult> => {
  const relayChannel = harness.kernel.createMessageChannel({
    sessionId: harness.session.id,
    kind: "direct",
    title: "gaubee",
    participants: [
      { id: `avatar:${harness.session.avatar}`, label: harness.session.avatar, role: "avatar" },
      { id: "user:gaubee", label: "gaubee", role: "user" },
    ],
    focus: false,
  });

  const startAt = Date.now();
  const sent = await harness.kernel.sendChat(harness.session.id, "gaubee在吗？问他中午吃什么？");
  if (!sent.ok) {
    throw new Error(`failed to send lunch relay prompt: ${sent.reason ?? "unknown"}`);
  }

  const relayPromptMessage = await waitForAssistantMessage(harness, {
    label: "relay prompt to secondary chat",
    predicate: (message) => message.chatId === relayChannel.chatId && message.timestamp >= startAt,
  });

  const activeAfterRelay = await waitForRealValue(
    async () => {
      const attention = await harness.kernel.inspectAttentionState(harness.session.id);
      return attention.active.length > 0 ? attention : null;
    },
    {
      label: "unsettled attention after relay dispatch",
      timeoutMs: DEFAULT_TIMEOUT_MS,
    },
  );

  const replySent = await harness.kernel.sendMessageChannel({
    sessionId: harness.session.id,
    chatId: relayChannel.chatId,
    accessToken: relayChannel.accessToken,
    text: "中午吃蛋炒饭。",
  });
  if (!replySent.ok) {
    throw new Error(`failed to send gaubee reply: ${replySent.reason ?? "unknown"}`);
  }

  const relayParticipantReply = await waitForRealValue(
    () => {
      const runtime = getRuntimeSnapshot(harness);
      if (!runtime) {
        return null;
      }
      return getUserMessages(
        runtime,
        (message) => message.chatId === relayChannel.chatId && message.content.trim() === "中午吃蛋炒饭。",
      ).at(-1) ?? null;
    },
    {
      label: "user reply on secondary chat",
      timeoutMs: DEFAULT_TIMEOUT_MS,
    },
  );

  const finalReply = await waitForAssistantMessage(harness, {
    label: "final reply on chat-main",
    predicate: (message) => message.chatId === "chat-main" && message.timestamp > relayParticipantReply.timestamp && message.content.includes("蛋炒饭"),
  });
  const settledAttention = await waitForAttentionSettled(harness);
  const recentModelCalls = await waitForLatestModelCallCompletion(harness);

  return {
    relayChannel,
    relayPromptMessage,
    relayParticipantReply,
    activeAfterRelay,
    finalReply,
    settledAttention,
    recentModelCalls,
  };
};

export interface RealCompactFollowUpScenarioResult {
  compactCycle: ChatCycle;
  followUpReply: ChatMessage;
  relayMessageCountBefore: number;
  relayMessageCountAfter: number;
  settledAttention: SessionRuntimeAttentionState;
  recentModelCalls: Array<{
    id: number;
    cycleId: number;
    status: "running" | "done" | "error" | "cancelled";
    outcome: string | null;
  }>;
}

export const runRealCompactFollowUpScenario = async (
  harness: RealKernelHarness,
  input: {
    relayChannel: MessageControlPlaneEntry;
    afterReplyTimestamp: number;
  },
): Promise<RealCompactFollowUpScenarioResult> => {
  const cyclesBefore = harness.kernel.listChatCycles(harness.session.id, 40);
  const lastCycleId = cyclesBefore.at(-1)?.cycleId ?? 0;
  const runtimeBefore = getRuntimeSnapshot(harness);
  const relayMessageCountBefore = runtimeBefore ? countAssistantMessages(runtimeBefore, input.relayChannel.chatId) : 0;

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
      message.chatId === "chat-main" &&
      message.timestamp > input.afterReplyTimestamp &&
      message.content.includes("蛋炒饭"),
  });

  const runtimeAfter = getRuntimeSnapshot(harness);
  const relayMessageCountAfter = runtimeAfter ? countAssistantMessages(runtimeAfter, input.relayChannel.chatId) : 0;
  const settledAttention = await waitForAttentionSettled(harness);
  const recentModelCalls = await waitForLatestModelCallCompletion(harness);

  return {
    compactCycle,
    followUpReply,
    relayMessageCountBefore,
    relayMessageCountAfter,
    settledAttention,
    recentModelCalls,
  };
};
