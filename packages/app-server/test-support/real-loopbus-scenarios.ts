import type { MessageControlPlane, MessageControlPlaneEntry, MessageRecord } from "@agenter/message-system";

import type { ChatCycle, ChatMessage, SessionRuntimeAttentionState } from "../src";
import { excludeActiveContextPrefixes, waitForScopedAttentionSettled } from "./attention-test-primitive";
import type { RealKernelHarness } from "./real-kernel-harness";
import { waitForRealValue } from "./real-kernel-harness";

const DEFAULT_TIMEOUT_MS = 120_000;
const chatScenarioAttentionScope = excludeActiveContextPrefixes("ctx-task-source-");
const getPrimaryRoomId = (harness: RealKernelHarness): string => {
  if (!harness.session.primaryRoomId) {
    throw new Error(`missing primaryRoomId for session ${harness.session.id}`);
  }
  return harness.session.primaryRoomId;
};
const getMessageControlPlane = (harness: RealKernelHarness): MessageControlPlane =>
  Reflect.get(harness.kernel, "messageControlPlane") as MessageControlPlane;

const toChatMessage = (harness: RealKernelHarness, message: MessageRecord): ChatMessage => ({
  id: message.messageId,
  chatId: message.chatId,
  role: message.from === harness.session.avatar ? "assistant" : "user",
  content: message.content,
  timestamp: message.createdAt,
  updatedAt: message.updatedAt,
  visibleAt: message.visibleAt,
  attentionState: message.attentionState,
  attentionLoadedAt: message.attentionLoadedAt,
  editable: message.editable,
});

const listRoomTruthMessages = (harness: RealKernelHarness): ChatMessage[] =>
  harness.kernel
    .listMessageChannels(harness.session.id)
    .flatMap((channel) => getMessageControlPlane(harness).snapshot(channel.chatId, 50).items.map((item) => toChatMessage(harness, item)))
    .sort((left, right) => left.timestamp - right.timestamp);

const getAssistantMessages = (
  messages: ChatMessage[],
  predicate: (message: ChatMessage) => boolean,
): ChatMessage[] =>
  messages.filter((message) => message.role === "assistant" && predicate(message));

const getUserMessages = (messages: ChatMessage[], predicate: (message: ChatMessage) => boolean): ChatMessage[] =>
  messages.filter((message) => message.role === "user" && predicate(message));

const countAssistantMessages = (messages: ChatMessage[], chatId: string): number =>
  messages.filter((message) => message.role === "assistant" && message.chatId === chatId).length;

const waitForNextAssistantMessageInChat = async (
  harness: RealKernelHarness,
  input: {
    chatId: string;
    afterCount: number;
    label: string;
    timeoutMs?: number;
  },
): Promise<ChatMessage> =>
  await waitForRealValue(
    () => {
      const messages = getAssistantMessages(listRoomTruthMessages(harness), (message) => message.chatId === input.chatId);
      return messages.length > input.afterCount ? (messages[input.afterCount] ?? null) : null;
    },
    {
      label: input.label,
      timeoutMs: input.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    },
  );

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
      return getAssistantMessages(listRoomTruthMessages(harness), input.predicate).at(-1) ?? null;
    },
    {
      label: input.label,
      timeoutMs: input.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    },
  );

const waitForAttentionSettled = async (harness: RealKernelHarness, timeoutMs = DEFAULT_TIMEOUT_MS) =>
  await waitForScopedAttentionSettled(
    async () => await harness.kernel.inspectAttentionState(harness.session.id),
    waitForRealValue,
    chatScenarioAttentionScope,
    timeoutMs,
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
            cycle.kind === "compact" &&
            cycle.compactTrigger === "manual" &&
            cycle.status === "done" &&
            typeof cycle.cycleId === "number" &&
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

const listRecentModelCallRecords = async (harness: RealKernelHarness) =>
  (await harness.kernel.inspectModelDebug(harness.session.id)).recentModelCalls;

const waitForModelCallsAfter = async (
  harness: RealKernelHarness,
  input: {
    afterTimestamp: number;
    label: string;
    timeoutMs?: number;
  },
) =>
  await waitForRealValue(
    async () => {
      const calls = await listRecentModelCallRecords(harness);
      const relevant = calls.filter((call) => call.createdAt >= input.afterTimestamp);
      const latest = relevant.at(-1) ?? null;
      if (!latest || latest.status === "running") {
        return null;
      }
      return relevant;
    },
    {
      label: input.label,
      timeoutMs: input.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    },
  );

const extractToolTraceTools = (call: { response?: unknown }): string[] => {
  const response = call.response;
  if (!response || typeof response !== "object" || !("toolTrace" in response) || !Array.isArray(response.toolTrace)) {
    return [];
  }
  return response.toolTrace.flatMap((entry) =>
    typeof entry === "object" && entry !== null && "tool" in entry && typeof entry.tool === "string" ? [entry.tool] : [],
  );
};

const extractModelDecision = (call: { response?: unknown }): Record<string, unknown> | null => {
  const response = call.response;
  if (!response || typeof response !== "object" || !("decision" in response)) {
    return null;
  }
  const decision = response.decision;
  return decision && typeof decision === "object" ? (decision as Record<string, unknown>) : null;
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
  const primaryRoomId = getPrimaryRoomId(harness);
  const prompt = [
    "请完成一个最小的 attention-first 闭环。",
    `只向 ${primaryRoomId} 发送一条用户可见消息，内容必须精确等于：REAL-AI-OK。`,
    "完成后把相关 attention score 收敛到 0。",
  ].join("\n");
  const sent = await harness.kernel.sendChat(harness.session.id, prompt);
  if (!sent.ok) {
    throw new Error(`failed to send simple real-ai prompt: ${sent.reason ?? "unknown"}`);
  }

  const reply = await waitForAssistantMessage(harness, {
    label: "simple reply on primary room",
    predicate: (message) => message.chatId === primaryRoomId && message.content.trim() === "REAL-AI-OK",
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
  originAcknowledgement: ChatMessage;
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
  const primaryRoomId = getPrimaryRoomId(harness);
  const roomMessagesBefore = listRoomTruthMessages(harness);
  const originAssistantCountBefore = countAssistantMessages(roomMessagesBefore, primaryRoomId);
  const relayChannel = await harness.kernel.createMessageChannel({
    sessionId: harness.session.id,
    kind: "room",
    title: "gaubee",
    participants: [
      { id: `session:${harness.session.avatar}`, label: harness.session.avatar },
      { id: "auth:gaubee", label: "gaubee" },
    ],
    focus: false,
  });
  const relayAssistantCountBefore = countAssistantMessages(roomMessagesBefore, relayChannel.chatId);

  const sent = await harness.kernel.sendChat(harness.session.id, "gaubee在吗？问他中午吃什么？");
  if (!sent.ok) {
    throw new Error(`failed to send lunch relay prompt: ${sent.reason ?? "unknown"}`);
  }

  const originAcknowledgement = await waitForNextAssistantMessageInChat(harness, {
    chatId: primaryRoomId,
    afterCount: originAssistantCountBefore,
    label: "origin acknowledgement on primary room",
  });

  const relayPromptMessage = await waitForNextAssistantMessageInChat(harness, {
    chatId: relayChannel.chatId,
    afterCount: relayAssistantCountBefore,
    label: "relay prompt to secondary chat",
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
      return getUserMessages(
        listRoomTruthMessages(harness),
        (message) => message.chatId === relayChannel.chatId && message.content.trim() === "中午吃蛋炒饭。",
      ).at(-1) ?? null;
    },
    {
      label: "user reply on secondary chat",
      timeoutMs: DEFAULT_TIMEOUT_MS,
    },
  );

  const finalReply = await waitForAssistantMessage(harness, {
    label: "final reply on primary room",
    predicate: (message) =>
      message.chatId === primaryRoomId &&
      message.timestamp > relayParticipantReply.timestamp &&
      message.content.includes("蛋炒饭"),
  });
  const settledAttention = await waitForAttentionSettled(harness);
  const recentModelCalls = await waitForLatestModelCallCompletion(harness);

  return {
    originAcknowledgement,
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
  const primaryRoomId = getPrimaryRoomId(harness);
  const cyclesBefore = harness.kernel.listChatCycles(harness.session.id, 40);
  const lastCycleId = cyclesBefore.at(-1)?.cycleId ?? 0;
  const relayMessageCountBefore = countAssistantMessages(listRoomTruthMessages(harness), input.relayChannel.chatId);

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
      message.timestamp > input.afterReplyTimestamp &&
      message.content.includes("蛋炒饭"),
  });

  const relayMessageCountAfter = countAssistantMessages(listRoomTruthMessages(harness), input.relayChannel.chatId);
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

export interface RealWeatherTerminalScenarioResult {
  acknowledgement: ChatMessage;
  reply: ChatMessage;
  settledAttention: SessionRuntimeAttentionState;
  recentModelCalls: Array<{
    id: number;
    cycleId: number;
    status: "running" | "done" | "error" | "cancelled";
    outcome: string | null;
  }>;
  toolTraceTools: string[];
}

export const runRealWeatherThroughTerminalScenario = async (
  harness: RealKernelHarness,
): Promise<RealWeatherTerminalScenarioResult> => {
  const primaryRoomId = getPrimaryRoomId(harness);
  const originAssistantCountBefore = countAssistantMessages(listRoomTruthMessages(harness), primaryRoomId);
  const startAt = Date.now();
  const prompt = [
    "用户问：厦门天气如何？天气预报未来 15 天天气。",
    `先在 ${primaryRoomId} 发一条简短确认消息，再使用 terminal 工具联网查询，禁止凭记忆回答。`,
    `最终在 ${primaryRoomId} 再发送一条以 WEATHER-RESULT: 开头的简短中文消息。`,
    "完成后把 attention 收敛到 0。",
  ].join("\n");
  const sent = await harness.kernel.sendChat(harness.session.id, prompt);
  if (!sent.ok) {
    throw new Error(`failed to send weather prompt: ${sent.reason ?? "unknown"}`);
  }

  const acknowledgement = await waitForNextAssistantMessageInChat(harness, {
    chatId: primaryRoomId,
    afterCount: originAssistantCountBefore,
    label: "weather acknowledgement on primary room",
    timeoutMs: 180_000,
  });

  const reply = await waitForAssistantMessage(harness, {
    label: "weather result on primary room",
    predicate: (message) =>
      message.chatId === primaryRoomId &&
      message.timestamp > acknowledgement.timestamp &&
      message.content.trim().startsWith("WEATHER-RESULT:"),
    timeoutMs: 180_000,
  });

  const modelCallRecords = await waitForModelCallsAfter(harness, {
    afterTimestamp: startAt,
    label: "weather model call completion",
    timeoutMs: 180_000,
  });
  const settledAttention = await waitForAttentionSettled(harness, 180_000);

  return {
    acknowledgement,
    reply,
    settledAttention,
    recentModelCalls: modelCallRecords.map((call) => ({
      id: call.id,
      cycleId: call.cycleId,
      status: call.status,
      outcome: call.outcome?.code ?? null,
    })),
    toolTraceTools: modelCallRecords.flatMap(extractToolTraceTools),
  };
};

export interface RealInterleavedCanInputScenarioResult {
  acknowledgement: ChatMessage;
  followUpPrompt: string;
  finalReply: ChatMessage;
  yieldedCall: {
    id: number;
    cycleId: number;
    interleavedInputCount: number;
  };
  interleavedRequestCall: {
    id: number;
    cycleId: number;
    requestText: string;
  };
  recentModelCalls: Array<{
    id: number;
    cycleId: number;
    status: "running" | "done" | "error" | "cancelled";
    outcome: string | null;
  }>;
}

export const runRealInterleavedCanInputScenario = async (
  harness: RealKernelHarness,
): Promise<RealInterleavedCanInputScenarioResult> => {
  const primaryRoomId = getPrimaryRoomId(harness);
  const originAssistantCountBefore = countAssistantMessages(listRoomTruthMessages(harness), primaryRoomId);
  const startAt = Date.now();
  const initialPrompt = [
    "我们正在验证你是否能在工具阶段接收新的输入。",
    `1. 先立刻在 ${primaryRoomId} 回复一条只包含 INTERLEAVED-ACK 的消息。`,
    "2. 然后必须使用 terminal 工具执行这个命令：bash -lc 'sleep 5; echo TOOL-PHASE-DONE'。",
    "3. 在终端命令运行期间，我可能会再发一条以“补充要求:”开头的新消息。你必须在最终结果里处理这条补充要求。",
    `4. 最终只在 ${primaryRoomId} 回复一条以 INTERLEAVED-RESULT: 开头的中文消息，并且必须包含 TOOL-PHASE-DONE 与补充要求里的关键短语。`,
    "5. 禁止跳过 terminal，禁止凭空回答，完成后收敛 attention。",
  ].join("\n");

  const sent = await harness.kernel.sendChat(harness.session.id, initialPrompt);
  if (!sent.ok) {
    throw new Error(`failed to send interleaved prompt: ${sent.reason ?? "unknown"}`);
  }

  const acknowledgement = await waitForNextAssistantMessageInChat(harness, {
    chatId: primaryRoomId,
    afterCount: originAssistantCountBefore,
    label: "interleaved acknowledgement on primary room",
    timeoutMs: 180_000,
  });

  const followUpPrompt = "补充要求: 最终消息必须包含 SECOND-CLAUSE";
  const followUpSent = await harness.kernel.sendChat(harness.session.id, followUpPrompt);
  if (!followUpSent.ok) {
    throw new Error(`failed to send interleaved follow-up: ${followUpSent.reason ?? "unknown"}`);
  }
  const followUpSentAt = Date.now();

  const finalReply = await waitForAssistantMessage(harness, {
    label: "interleaved final reply on primary room",
    predicate: (message) =>
      message.chatId === primaryRoomId &&
      message.timestamp > acknowledgement.timestamp &&
      message.content.includes("INTERLEAVED-RESULT:") &&
      message.content.includes("TOOL-PHASE-DONE") &&
      message.content.includes("SECOND-CLAUSE"),
    timeoutMs: 180_000,
  });

  const callInspection = await waitForRealValue(
    async () => {
      const calls = await listRecentModelCallRecords(harness);
      const relevant = calls.filter((call) => call.createdAt >= startAt && call.status !== "running");
      const yieldedCall = relevant.find((call) => {
        const decision = extractModelDecision(call);
        return (
          decision?.kind === "model" &&
          decision.yieldedAfterToolPhase === true &&
          typeof decision.interleavedInputCount === "number" &&
          Number(decision.interleavedInputCount) > 0
        );
      });
      if (!yieldedCall) {
        return null;
      }
      const interleavedRequestCall = relevant.find((call) => {
        const requestText = JSON.stringify(call.request);
        return (
          call.cycleId === yieldedCall.cycleId &&
          call.createdAt >= followUpSentAt &&
          requestText.includes("SECOND-CLAUSE")
        );
      });
      if (!interleavedRequestCall) {
        return null;
      }
      return {
        relevant,
        yieldedCall,
        interleavedRequestCall,
      };
    },
    {
      label: "interleaved model call inspection",
      timeoutMs: 180_000,
    },
  );

  return {
    acknowledgement,
    followUpPrompt,
    finalReply,
    yieldedCall: {
      id: callInspection.yieldedCall.id,
      cycleId: callInspection.yieldedCall.cycleId,
      interleavedInputCount: Number(extractModelDecision(callInspection.yieldedCall)?.interleavedInputCount ?? 0),
    },
    interleavedRequestCall: {
      id: callInspection.interleavedRequestCall.id,
      cycleId: callInspection.interleavedRequestCall.cycleId,
      requestText: JSON.stringify(callInspection.interleavedRequestCall.request),
    },
    recentModelCalls: callInspection.relevant.map((call) => ({
      id: call.id,
      cycleId: call.cycleId,
      status: call.status,
      outcome: call.outcome?.code ?? null,
    })),
  };
};

export interface RealJudgeRelayScenarioResult {
  relayChannel: MessageControlPlaneEntry;
  relayPromptMessage: ChatMessage;
  activeAfterRelay: SessionRuntimeAttentionState;
  recentModelCalls: Array<{
    id: number;
    cycleId: number;
    status: "running" | "done" | "error" | "cancelled";
    outcome: string | null;
  }>;
  toolTraceTools: string[];
}

export const runRealJudgeRelayScenario = async (
  harness: RealKernelHarness,
): Promise<RealJudgeRelayScenarioResult> => {
  const primaryRoomId = getPrimaryRoomId(harness);
  const relayChannel = await harness.kernel.createMessageChannel({
    sessionId: harness.session.id,
    kind: "room",
    title: "kzf",
    participants: [
      { id: `session:${harness.session.avatar}`, label: harness.session.avatar },
      { id: "auth:kzf", label: "kzf" },
    ],
    focus: false,
  });

  const startAt = Date.now();
  const prompt = [
    "和 kzf 玩个剪刀石头布，你做裁判，我出布。",
    "请先联系 kzf 获取他的出招，不要代替 kzf 出招，也不要把我的整句话原样转发。",
    `等 kzf 回复后，只把比赛结果发回 ${primaryRoomId}，并收敛 attention。`,
  ].join("\n");
  const sent = await harness.kernel.sendChat(harness.session.id, prompt);
  if (!sent.ok) {
    throw new Error(`failed to send judge relay prompt: ${sent.reason ?? "unknown"}`);
  }

  const relayPromptMessage = await waitForAssistantMessage(harness, {
    label: "judge relay prompt",
    predicate: (message) => message.chatId === relayChannel.chatId && message.timestamp >= startAt,
    timeoutMs: 180_000,
  });
  const activeAfterRelay = await waitForRealValue(
    async () => {
      const attention = await harness.kernel.inspectAttentionState(harness.session.id);
      return attention.active.length > 0 ? attention : null;
    },
    {
      label: "judge relay attention waiting state",
      timeoutMs: 180_000,
    },
  );

  const modelCallRecords = await waitForModelCallsAfter(harness, {
    afterTimestamp: startAt,
    label: "judge relay model call completion",
    timeoutMs: 180_000,
  });

  return {
    relayChannel,
    relayPromptMessage,
    activeAfterRelay,
    recentModelCalls: modelCallRecords.map((call) => ({
      id: call.id,
      cycleId: call.cycleId,
      status: call.status,
      outcome: call.outcome?.code ?? null,
    })),
    toolTraceTools: modelCallRecords.flatMap(extractToolTraceTools),
  };
};
