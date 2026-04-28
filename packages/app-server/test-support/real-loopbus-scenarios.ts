import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type { MessageControlPlane, MessageControlPlaneEntry, MessageRecord } from "@agenter/message-system";

import type { ChatCycle, ChatMessage, SessionRuntimeAttentionState } from "../src";
import { excludeActiveContextPrefixes, waitForScopedAttentionSettled } from "./attention-test-primitive";
import type { RealKernelHarness } from "./real-kernel-harness";
import { waitForRealValue } from "./real-kernel-harness";
import { readModelOutcomeCode } from "./real-room-terminal-delivery-scenario";

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
  id: String(message.messageId),
  chatId: message.chatId,
  role: message.from === harness.session.avatar ? "assistant" : "user",
  content: message.content,
  timestamp: message.createdAt,
  updatedAt: message.updatedAt,
  visibleAt: message.visibleAt,
});

const listRoomTruthMessages = (harness: RealKernelHarness): ChatMessage[] =>
  harness.kernel
    .listMessageChannels(harness.session.id)
    .flatMap((channel) =>
      getMessageControlPlane(harness)
        .snapshot(channel.chatId, 50)
        .items.map((item) => toChatMessage(harness, item)),
    )
    .sort((left, right) => left.timestamp - right.timestamp);

const getAssistantMessages = (messages: ChatMessage[], predicate: (message: ChatMessage) => boolean): ChatMessage[] =>
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
      const messages = getAssistantMessages(
        listRoomTruthMessages(harness),
        (message) => message.chatId === input.chatId,
      );
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

const waitForPromptWindowCompactApplied = async (harness: RealKernelHarness, timeoutMs = DEFAULT_TIMEOUT_MS) =>
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
    outcome: readModelOutcomeCode(call),
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

const waitForCompletedModelCallsObservedAfter = async (
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
      return relevant.some((call) => call.status !== "running") ? relevant : null;
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
    typeof entry === "object" && entry !== null && "tool" in entry && typeof entry.tool === "string"
      ? [entry.tool]
      : [],
  );
};

const extractRootWorkspaceBashCommands = (call: { response?: unknown }): string[] => {
  const response = call.response;
  if (!response || typeof response !== "object" || !("toolTrace" in response) || !Array.isArray(response.toolTrace)) {
    return [];
  }
  return response.toolTrace.flatMap((entry) => {
    if (
      !entry ||
      typeof entry !== "object" ||
      entry.tool !== "root_bash" ||
      !("input" in entry) ||
      !entry.input ||
      typeof entry.input !== "object" ||
      typeof entry.input.command !== "string"
    ) {
      return [];
    }
    return [entry.input.command];
  });
};

const extractModelDecision = (call: { response?: unknown }): Record<string, unknown> | null => {
  const response = call.response;
  if (!response || typeof response !== "object" || !("decision" in response)) {
    return null;
  }
  const decision = response.decision;
  return decision && typeof decision === "object" ? (decision as Record<string, unknown>) : null;
};

const waitForLatestModelCallCompletion = async (harness: RealKernelHarness, timeoutMs = DEFAULT_TIMEOUT_MS) =>
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

const fetchNpmLatestVersion = async (packageName: string): Promise<string> => {
  const response = await fetch(`https://registry.npmjs.org/${packageName}/latest`, {
    headers: {
      accept: "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(
      `failed to fetch npm latest metadata for ${packageName}: ${response.status} ${response.statusText}`,
    );
  }
  const payload = (await response.json()) as { version?: unknown };
  if (typeof payload.version !== "string" || payload.version.trim().length === 0) {
    throw new Error(`npm latest metadata missing version for ${packageName}`);
  }
  return payload.version.trim();
};

const buildRealScenarioDiagnosticError = async (
  harness: RealKernelHarness,
  input: {
    label: string;
    error: unknown;
    extra?: Record<string, unknown>;
  },
): Promise<Error> => {
  const cause = input.error instanceof Error ? input.error : new Error(String(input.error));
  const diagnostics = await harness.collectDiagnostics({
    label: input.label,
  });
  return new Error(
    [
      `${input.label} failed: ${cause.message}`,
      "diagnostics:",
      JSON.stringify(
        {
          ...diagnostics,
          ...(input.extra ? { extra: input.extra } : {}),
        },
        null,
        2,
      ),
    ].join("\n"),
    { cause },
  );
};

export interface RealSimpleReplyScenarioResult {
  reply: ChatMessage;
  settledAttention: SessionRuntimeAttentionState;
  recentModelCalls: Array<{
    id: number;
    cycleId: number | null;
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

export interface RealCliCompactScenarioResult {
  reply: ChatMessage;
  settledAttention: SessionRuntimeAttentionState;
  recentModelCalls: Array<{
    id: number;
    cycleId: number | null;
    status: "running" | "done" | "error" | "cancelled";
    outcome: string | null;
  }>;
  toolTraceTools: string[];
  rootWorkspaceBashCommands: string[];
}

export const runRealCliCompactScenario = async (harness: RealKernelHarness): Promise<RealCliCompactScenarioResult> => {
  const timeoutMs = 180_000;
  const primaryRoomId = getPrimaryRoomId(harness);
  const startAt = Date.now();

  try {
    const prompt = [
      "请完成一个最小的 CLI compact 验证。",
      `目标房间 chatId: ${primaryRoomId}`,
      "必须先通过 root_bash 执行一次 `message send --help`。",
      "然后必须通过 root_bash 使用 `message send --compact` 向目标房间发送一条用户可见消息。",
      "最终发送的消息内容必须精确等于：COMPACT-OK",
      "不要使用普通 object JSON message send，也不要发送额外的最终结果文本。",
      "完成后把相关 attention score 收敛到 0。",
    ].join("\n");
    const sent = await harness.kernel.sendChat(harness.session.id, prompt);
    if (!sent.ok) {
      throw new Error(`failed to send compact prompt: ${sent.reason ?? "unknown"}`);
    }

    const reply = await waitForAssistantMessage(harness, {
      label: "compact cli reply on primary room",
      predicate: (message) => message.chatId === primaryRoomId && message.content.trim() === "COMPACT-OK",
      timeoutMs,
    });
    const settledAttention = await waitForAttentionSettled(harness, timeoutMs);
    const modelCallRecords = await waitForModelCallsAfter(harness, {
      afterTimestamp: startAt,
      label: "compact cli model call completion",
      timeoutMs,
    });

    return {
      reply,
      settledAttention,
      recentModelCalls: modelCallRecords.map((call) => ({
        id: call.id,
        cycleId: call.cycleId,
        status: call.status,
        outcome: readModelOutcomeCode(call),
      })),
      toolTraceTools: modelCallRecords.flatMap(extractToolTraceTools),
      rootWorkspaceBashCommands: modelCallRecords.flatMap(extractRootWorkspaceBashCommands),
    };
  } catch (error) {
    throw await buildRealScenarioDiagnosticError(harness, {
      label: "real-cli-compact-scenario",
      error,
      extra: {
        primaryRoomId,
      },
    });
  }
};

export interface RealTerminalSkillLearningScenarioResult {
  reply: ChatMessage;
  proofText: string;
  settledAttention: SessionRuntimeAttentionState;
  recentModelCalls: Array<{
    id: number;
    cycleId: number | null;
    status: "running" | "done" | "error" | "cancelled";
    outcome: string | null;
  }>;
  toolTraceTools: string[];
  rootWorkspaceBashCommands: string[];
}

export interface RealTerminalAwaitScenarioResult {
  reply: ChatMessage;
  settledAttention: SessionRuntimeAttentionState;
  recentModelCalls: Array<{
    id: number;
    cycleId: number | null;
    status: "running" | "done" | "error" | "cancelled";
    outcome: string | null;
  }>;
  toolTraceTools: string[];
  rootWorkspaceBashCommands: string[];
}

export const runRealTerminalSkillLearningScenario = async (
  harness: RealKernelHarness,
): Promise<RealTerminalSkillLearningScenarioResult> => {
  const timeoutMs = 300_000;
  const primaryRoomId = getPrimaryRoomId(harness);
  const proofFileName = "terminal-skill-proof.txt";
  const expectedToken = "TERMINAL-SKILL-OK";
  const startAt = Date.now();

  try {
    const prompt = [
      "这是一个 terminal skill 学习验收。",
      `目标房间 chatId: ${primaryRoomId}`,
      "不要发送中间确认，也不要发送额外总结。",
      "必须先通过 root_bash 执行 `skill info agenter-terminal`。",
      "如果还需要补充细节，可以继续从这个 skill 的真实路径读取 terminal lifecycle reference，或者查看 terminal 命令的 --help。",
      "然后你必须自己推导并完成以下步骤：",
      "1. 使用 terminalId `skill-terminal` 创建或恢复一个 terminal。",
      "2. 至少执行一次 `terminal list` 检查 lifecycle。",
      "3. 显式执行一次 `terminal stop`，再显式执行一次 `terminal bootstrap`。",
      `4. 只通过 terminal CLI 在当前 granted workspace 写入文件 ${proofFileName}，文件内容必须精确等于 ${expectedToken}。`,
      `5. 通过 root_bash 执行 \`cat ${proofFileName}\` 验证文件内容。`,
      `6. 只向 ${primaryRoomId} 发送一条最终用户可见消息，内容必须精确等于：${expectedToken}`,
      "7. 完成后把 attention 收敛到 0。",
      "禁止使用 root_bash 或 workspace_bash 直接写 proof 文件。",
    ].join("\n");
    const sent = await harness.kernel.sendChat(harness.session.id, prompt);
    if (!sent.ok) {
      throw new Error(`failed to send terminal skill prompt: ${sent.reason ?? "unknown"}`);
    }

    const reply = await waitForAssistantMessage(harness, {
      label: "terminal skill final reply on primary room",
      predicate: (message) => message.chatId === primaryRoomId && message.content.trim() === expectedToken,
      timeoutMs,
    });

    const proofText = await waitForRealValue(
      async () => {
        try {
          const content = await readFile(join(harness.workspacePath, proofFileName), "utf8");
          const trimmed = content.trim();
          return trimmed === expectedToken ? trimmed : null;
        } catch {
          return null;
        }
      },
      {
        label: "terminal skill proof file",
        timeoutMs,
      },
    );

    const settledAttention = await waitForAttentionSettled(harness, timeoutMs);
    const modelCallRecords = await waitForModelCallsAfter(harness, {
      afterTimestamp: startAt,
      label: "terminal skill model call completion",
      timeoutMs,
    });

    return {
      reply,
      proofText,
      settledAttention,
      recentModelCalls: modelCallRecords.map((call) => ({
        id: call.id,
        cycleId: call.cycleId,
        status: call.status,
        outcome: readModelOutcomeCode(call),
      })),
      toolTraceTools: modelCallRecords.flatMap(extractToolTraceTools),
      rootWorkspaceBashCommands: modelCallRecords.flatMap(extractRootWorkspaceBashCommands),
    };
  } catch (error) {
    throw await buildRealScenarioDiagnosticError(harness, {
      label: "real-terminal-skill-learning-scenario",
      error,
      extra: {
        primaryRoomId,
        proofFileName,
        expectedToken,
      },
    });
  }
};

export const runRealTerminalAwaitScenario = async (
  harness: RealKernelHarness,
): Promise<RealTerminalAwaitScenarioResult> => {
  const timeoutMs = 300_000;
  const primaryRoomId = getPrimaryRoomId(harness);
  const expectedToken = "AWAIT-READY";
  const startAt = Date.now();

  try {
    const prompt = [
      "这是一个 terminal skill 真实行为验收。",
      `目标房间 chatId: ${primaryRoomId}`,
      "不要发送中间确认，也不要发送额外总结。",
      "必须先通过 root_bash 执行 `skill info agenter-terminal`。",
      "然后使用 terminalId `await-terminal` 创建或恢复一个 terminal。",
      "通过 terminal CLI 在这个 terminal 内启动一个会先停顿片刻、随后输出 AWAIT-READY 的命令。",
      `等你从 terminal 证据里确认已经看到 ${expectedToken} 之后，向 ${primaryRoomId} 发送一条最终用户可见消息，内容必须精确等于：${expectedToken}`,
      "完成后把 attention 收敛到 0。",
    ].join("\n");
    const sent = await harness.kernel.sendChat(harness.session.id, prompt);
    if (!sent.ok) {
      throw new Error(`failed to send terminal await prompt: ${sent.reason ?? "unknown"}`);
    }

    const reply = await waitForAssistantMessage(harness, {
      label: "terminal await final reply on primary room",
      predicate: (message) => message.chatId === primaryRoomId && message.content.trim() === expectedToken,
      timeoutMs,
    });

    const settledAttention = await waitForAttentionSettled(harness, timeoutMs);
    const modelCallRecords = await waitForModelCallsAfter(harness, {
      afterTimestamp: startAt,
      label: "terminal await model call completion",
      timeoutMs,
    });

    return {
      reply,
      settledAttention,
      recentModelCalls: modelCallRecords.map((call) => ({
        id: call.id,
        cycleId: call.cycleId,
        status: call.status,
        outcome: readModelOutcomeCode(call),
      })),
      toolTraceTools: modelCallRecords.flatMap(extractToolTraceTools),
      rootWorkspaceBashCommands: modelCallRecords.flatMap(extractRootWorkspaceBashCommands),
    };
  } catch (error) {
    throw await buildRealScenarioDiagnosticError(harness, {
      label: "real-terminal-await-scenario",
      error,
      extra: {
        primaryRoomId,
        expectedToken,
      },
    });
  }
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
    cycleId: number | null;
    status: "running" | "done" | "error" | "cancelled";
    outcome: string | null;
  }>;
}

export const runRealLunchRelayScenario = async (harness: RealKernelHarness): Promise<RealLunchRelayScenarioResult> => {
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
      return (
        getUserMessages(
          listRoomTruthMessages(harness),
          (message) => message.chatId === relayChannel.chatId && message.content.trim() === "中午吃蛋炒饭。",
        ).at(-1) ?? null
      );
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
    cycleId: number | null;
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
    timeoutMs: 180_000,
  });

  const relayMessageCountAfter = countAssistantMessages(listRoomTruthMessages(harness), input.relayChannel.chatId);
  const settledAttention = await waitForAttentionSettled(harness, 180_000);
  const recentModelCalls = await waitForLatestModelCallCompletion(harness, 180_000);

  return {
    compactCycle,
    followUpReply,
    relayMessageCountBefore,
    relayMessageCountAfter,
    settledAttention,
    recentModelCalls,
  };
};

export interface RealExternalFactShellScenarioResult {
  packageName: string;
  expectedVersion: string;
  acknowledgement: ChatMessage;
  reply: ChatMessage;
  settledAttention: SessionRuntimeAttentionState;
  recentModelCalls: Array<{
    id: number;
    cycleId: number | null;
    status: "running" | "done" | "error" | "cancelled";
    outcome: string | null;
  }>;
  toolTraceTools: string[];
}

export const runRealExternalFactThroughShellScenario = async (
  harness: RealKernelHarness,
): Promise<RealExternalFactShellScenarioResult> => {
  const timeoutMs = 420_000;
  const primaryRoomId = getPrimaryRoomId(harness);
  const originAssistantCountBefore = countAssistantMessages(listRoomTruthMessages(harness), primaryRoomId);
  const packageName = "ccski";
  const expectedVersion = await fetchNpmLatestVersion(packageName);

  try {
    const startAt = Date.now();
    const prompt = [
      `用户问：请联网确认 npm 上 ${packageName} 的 latest 版本号是多少。`,
      `先在 ${primaryRoomId} 发一条简短确认消息，表示你会查证后再回复。`,
      "必须通过可观察的 shell 或其它客观工具查证，禁止凭记忆猜测。",
      `最终在 ${primaryRoomId} 再发送一条简短中文结果消息，明确写出 ${packageName} 的 latest 版本号。`,
      "完成后把 attention 收敛到 0。",
    ].join("\n");
    const sent = await harness.kernel.sendChat(harness.session.id, prompt);
    if (!sent.ok) {
      throw new Error(`failed to send external fact prompt: ${sent.reason ?? "unknown"}`);
    }

    const acknowledgement = await waitForNextAssistantMessageInChat(harness, {
      chatId: primaryRoomId,
      afterCount: originAssistantCountBefore,
      label: "external fact acknowledgement on primary room",
      timeoutMs,
    });

    const reply = await waitForAssistantMessage(harness, {
      label: "external fact result on primary room",
      predicate: (message) =>
        message.chatId === primaryRoomId &&
        message.timestamp > acknowledgement.timestamp &&
        message.content.includes(expectedVersion),
      timeoutMs,
    });

    const modelCallRecords = await waitForModelCallsAfter(harness, {
      afterTimestamp: startAt,
      label: "external fact model call completion",
      timeoutMs,
    });
    const settledAttention = await waitForAttentionSettled(harness, timeoutMs);

    return {
      packageName,
      expectedVersion,
      acknowledgement,
      reply,
      settledAttention,
      recentModelCalls: modelCallRecords.map((call) => ({
        id: call.id,
        cycleId: call.cycleId,
        status: call.status,
        outcome: readModelOutcomeCode(call),
      })),
      toolTraceTools: modelCallRecords.flatMap(extractToolTraceTools),
    };
  } catch (error) {
    throw await buildRealScenarioDiagnosticError(harness, {
      label: "real-external-fact-shell-scenario",
      error,
      extra: {
        packageName,
        expectedVersion,
      },
    });
  }
};

export const runRealWeatherThroughTerminalScenario = runRealExternalFactThroughShellScenario;

export interface RealInterleavedCanInputScenarioResult {
  acknowledgement: ChatMessage;
  followUpPrompt: string;
  finalReply: ChatMessage;
  recentModelCalls: Array<{
    id: number;
    cycleId: number | null;
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
    `1. 先立刻在 ${primaryRoomId} 回复一条简短确认消息，表示你会继续执行并稍后回报。`,
    "2. 然后必须使用 root_bash 执行这个命令：bash -lc 'sleep 5; echo TOOL-PHASE-DONE'。",
    "3. 在终端命令运行期间，我可能会再发一条以“补充要求:”开头的新消息。你必须在最终结果里处理这条补充要求。",
    `4. 最终只在 ${primaryRoomId} 回复一条中文结果消息，并且必须包含 TOOL-PHASE-DONE 与补充要求里的关键短语。`,
    "5. 禁止跳过 shell 执行，禁止凭空回答，完成后收敛 attention。",
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
      message.content.includes("TOOL-PHASE-DONE") &&
      message.content.includes("SECOND-CLAUSE"),
    timeoutMs: 180_000,
  });

  const recentModelCallsRaw = await waitForModelCallsAfter(harness, {
    afterTimestamp: startAt,
    label: "interleaved model call completion",
    timeoutMs: 180_000,
  });

  return {
    acknowledgement,
    followUpPrompt,
    finalReply,
    recentModelCalls: recentModelCallsRaw.map((call) => ({
      id: call.id,
      cycleId: call.cycleId,
      status: call.status,
      outcome: readModelOutcomeCode(call),
    })),
  };
};

export interface RealJudgeRelayScenarioResult {
  relayChannel: MessageControlPlaneEntry;
  relayPromptMessage: ChatMessage;
  activeAfterRelay: SessionRuntimeAttentionState;
  recentModelCalls: Array<{
    id: number;
    cycleId: number | null;
    status: "running" | "done" | "error" | "cancelled";
    outcome: string | null;
  }>;
  toolTraceTools: string[];
}

export const runRealJudgeRelayScenario = async (harness: RealKernelHarness): Promise<RealJudgeRelayScenarioResult> => {
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

  const modelCallRecords = await waitForCompletedModelCallsObservedAfter(harness, {
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
      outcome: readModelOutcomeCode(call),
    })),
    toolTraceTools: modelCallRecords.flatMap(extractToolTraceTools),
  };
};
