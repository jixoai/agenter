import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { MessageControlPlane, MessageRecord } from "@agenter/message-system";

import type { SessionRuntimeAttentionState } from "../src";
import { excludeActiveContextPrefixes, waitForScopedAttentionSettled } from "./attention-test-primitive";
import type { RealKernelHarness, RealKernelHarnessDiagnostics } from "./real-kernel-harness";
import { REAL_MODEL_PROJECT_ROOT, waitForRealValue } from "./real-kernel-harness";

const DEFAULT_TIMEOUT_MS = 240_000;
const MESSAGE_LIMIT = 64;
const FOLLOW_UP_AFTER_MS = 2_000;
const MIN_REMINDER_DELAY_MS = 1_500;
const FIRST_REPLY = "你住哪里？";
const SECOND_REPLY = "我先按福州给你查。";
const chatScenarioAttentionScope = excludeActiveContextPrefixes("ctx-task-source-");

export interface RoomMessageEvidence {
  rowId: number;
  messageId: number;
  chatId: string;
  from: string;
  senderActorId?: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  visibleAt?: number;
  recalledAt?: number;
  recalledByActorId?: string;
}

export interface RootWorkspaceBashRunEvidence {
  command: string;
  stdin: string;
  stdout: string;
}

export interface RealMessageFollowUpScenarioResult {
  primaryRoomId: string;
  prompt: string;
  firstReply: string;
  secondReply: string;
  followUpAfterMs: number;
  minReminderDelayMs: number;
  firstMessage: RoomMessageEvidence;
  secondMessage: RoomMessageEvidence;
  assistantMessages: RoomMessageEvidence[];
  primaryRoomMessages: RoomMessageEvidence[];
  settledAttention: SessionRuntimeAttentionState;
  recentModelCalls: RealKernelHarnessDiagnostics["recentModelCalls"];
  rootWorkspaceBashRuns: RootWorkspaceBashRunEvidence[];
  rootWorkspaceMessageSendRequests: unknown[];
}

const getPrimaryRoomId = (harness: RealKernelHarness): string => {
  if (!harness.session.primaryRoomId) {
    throw new Error(`missing primaryRoomId for session ${harness.session.id}`);
  }
  return harness.session.primaryRoomId;
};

const getMessageControlPlane = (harness: RealKernelHarness): MessageControlPlane =>
  Reflect.get(harness.kernel, "messageControlPlane") as MessageControlPlane;

const toRoomMessageEvidence = (message: MessageRecord): RoomMessageEvidence => ({
  rowId: message.rowId,
  messageId: message.messageId,
  chatId: message.chatId,
  from: message.from,
  senderActorId: message.senderActorId,
  content: message.content,
  createdAt: message.createdAt,
  updatedAt: message.updatedAt,
  visibleAt: message.visibleAt,
  recalledAt: message.recalledAt,
  recalledByActorId: message.recalledByActorId,
});

const compareRoomMessages = (left: RoomMessageEvidence, right: RoomMessageEvidence): number => {
  if (left.createdAt !== right.createdAt) {
    return left.createdAt - right.createdAt;
  }
  if (left.rowId !== right.rowId) {
    return left.rowId - right.rowId;
  }
  return left.messageId - right.messageId;
};

const listPrimaryRoomMessages = (
  harness: RealKernelHarness,
  input: {
    chatId: string;
    createdAfterOrAt?: number;
  },
): RoomMessageEvidence[] =>
  getMessageControlPlane(harness)
    .snapshot(input.chatId, MESSAGE_LIMIT)
    .items.map(toRoomMessageEvidence)
    .filter((message) => (input.createdAfterOrAt === undefined ? true : message.createdAt >= input.createdAfterOrAt))
    .sort(compareRoomMessages);

const listAssistantMessages = (
  harness: RealKernelHarness,
  input: {
    chatId: string;
    createdAfterOrAt?: number;
  },
): RoomMessageEvidence[] =>
  listPrimaryRoomMessages(harness, input).filter((message) => message.from === harness.session.avatar);

const waitForAssistantMessage = async (
  harness: RealKernelHarness,
  input: {
    chatId: string;
    createdAfterOrAt: number;
    exactContent: string;
    label: string;
    timeoutMs?: number;
  },
): Promise<RoomMessageEvidence> =>
  await waitForRealValue(
    () =>
      listAssistantMessages(harness, {
        chatId: input.chatId,
        createdAfterOrAt: input.createdAfterOrAt,
      }).find((message) => message.content.trim() === input.exactContent) ?? null,
    {
      label: input.label,
      timeoutMs: input.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    },
  );

const waitForAttentionSettled = async (
  harness: RealKernelHarness,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<SessionRuntimeAttentionState> =>
  await waitForScopedAttentionSettled(
    async () => await harness.kernel.inspectAttentionState(harness.session.id),
    waitForRealValue,
    chatScenarioAttentionScope,
    timeoutMs,
  );

const waitForCompletedDiagnostics = async (
  harness: RealKernelHarness,
  startAt: number,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<RealKernelHarnessDiagnostics> =>
  await waitForRealValue(
    async () => {
      const diagnostics = await harness.collectDiagnostics({
        label: "real-message-follow-up",
        messageLimit: MESSAGE_LIMIT,
      });
      const relevantCalls = diagnostics.recentModelCalls.filter((call) => call.createdAt >= startAt);
      return relevantCalls.length > 0 && relevantCalls.every((call) => call.status !== "running") ? diagnostics : null;
    },
    {
      label: "follow-up diagnostics",
      timeoutMs,
    },
  );

const extractRootWorkspaceBashRuns = (
  recentModelCalls: RealKernelHarnessDiagnostics["recentModelCalls"],
): RootWorkspaceBashRunEvidence[] =>
  recentModelCalls.flatMap((call) =>
    call.toolTrace.flatMap((entry) => {
      if (
        entry.tool !== "root_bash" ||
        !entry.input ||
        typeof entry.input !== "object" ||
        typeof (entry.input as { command?: unknown }).command !== "string"
      ) {
        return [];
      }
      const output = entry.output;
      return [
        {
          command: (entry.input as { command: string }).command,
          stdin: typeof (entry.input as { stdin?: unknown }).stdin === "string" ? (entry.input as { stdin: string }).stdin : "",
          stdout:
            output && typeof output === "object" && typeof (output as { stdout?: unknown }).stdout === "string"
              ? (output as { stdout: string }).stdout
              : "",
        },
      ];
    }),
  );

const extractMessageSendRequests = (runs: RootWorkspaceBashRunEvidence[]): unknown[] =>
  runs
    .filter((run) => run.command === "message send" || run.command.startsWith("message send "))
    .flatMap((run) => {
      if (run.stdin.length > 0) {
        try {
          const request = JSON.parse(run.stdin);
          return request && typeof request === "object" ? [request] : [];
        } catch {
          return [];
        }
      }
      if (run.command === "message send" || run.command === "message send --help") {
        return [];
      }
      const rawArg = run.command.slice("message send ".length).trim();
      try {
        const shellArg = JSON.parse(rawArg);
        if (typeof shellArg !== "string") {
          return [];
        }
        const request = JSON.parse(shellArg);
        return request && typeof request === "object" ? [request] : [];
      } catch {
        return [];
      }
    });

const createEvidenceFile = async (prefix: string, payload: unknown): Promise<string> => {
  const evidenceDir = join(REAL_MODEL_PROJECT_ROOT, ".chat");
  await mkdir(evidenceDir, { recursive: true });
  const path = join(evidenceDir, `${prefix}-${Date.now()}.json`);
  await writeFile(path, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return path;
};

export const runRealMessageFollowUpScenario = async (
  harness: RealKernelHarness,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<RealMessageFollowUpScenarioResult> => {
  const primaryRoomId = getPrimaryRoomId(harness);
  const prompt = [
    "你正在参与一个真实 follow-up reminder 走查。",
    `你只能在房间 ${primaryRoomId} 与用户沟通。`,
    "不要发送任何额外的房间可见消息。",
    "不要先列房间，也不要先打开 skill 文件。",
    "第 1 步：必须通过 root_bash 发送第一条房间消息。",
    "使用 root_bash 的 `command=message send`，并把标准 object JSON 放在 stdin。",
    `第一条消息的 payload 必须精确等于：{"chatId":"${primaryRoomId}","content":"${FIRST_REPLY}","followUpAfterMs":${FOLLOW_UP_AFTER_MS}}`,
    "第 2 步：发送完第一条消息后，不要立刻发送第二条消息，也不要自动结束任务。",
    "等待 follow-up reminder 让你重新决策。",
    "第 3 步：当 reminder 到来后，再次通过 root_bash 的 `message send` 向同一房间发送第二条精确消息。",
    `第二条消息的 payload 必须精确等于：{"chatId":"${primaryRoomId}","content":"${SECOND_REPLY}"}`,
    "第 4 步：第二条消息发出后，把 attention 收敛到 0。",
    "最终房间里只允许出现你发出的这两条可见消息，内容必须一字不差。",
  ].join("\n");

  const startAt = Date.now();
  const sent = await harness.kernel.sendChat(harness.session.id, prompt);
  if (!sent.ok) {
    throw new Error(`failed to send follow-up scenario prompt: ${sent.reason ?? "unknown"}`);
  }

  const firstMessage = await waitForAssistantMessage(harness, {
    chatId: primaryRoomId,
    createdAfterOrAt: startAt,
    exactContent: FIRST_REPLY,
    label: "first follow-up reminder message",
    timeoutMs,
  });
  const secondMessage = await waitForAssistantMessage(harness, {
    chatId: primaryRoomId,
    createdAfterOrAt: firstMessage.createdAt,
    exactContent: SECOND_REPLY,
    label: "second follow-up reminder message",
    timeoutMs,
  });
  const settledAttention = await waitForAttentionSettled(harness, timeoutMs);
  const diagnostics = await waitForCompletedDiagnostics(harness, startAt, timeoutMs);
  const relevantCalls = diagnostics.recentModelCalls.filter((call) => call.createdAt >= startAt);
  const primaryRoomMessages = listPrimaryRoomMessages(harness, {
    chatId: primaryRoomId,
    createdAfterOrAt: startAt,
  });
  const assistantMessages = primaryRoomMessages.filter(
    (message) => message.from === harness.session.avatar && typeof message.recalledAt !== "number",
  );
  const rootWorkspaceBashRuns = extractRootWorkspaceBashRuns(relevantCalls);
  const rootWorkspaceMessageSendRequests = extractMessageSendRequests(rootWorkspaceBashRuns);

  return {
    primaryRoomId,
    prompt,
    firstReply: FIRST_REPLY,
    secondReply: SECOND_REPLY,
    followUpAfterMs: FOLLOW_UP_AFTER_MS,
    minReminderDelayMs: MIN_REMINDER_DELAY_MS,
    firstMessage,
    secondMessage,
    assistantMessages,
    primaryRoomMessages,
    settledAttention,
    recentModelCalls: relevantCalls,
    rootWorkspaceBashRuns,
    rootWorkspaceMessageSendRequests,
  };
};

export const writeRealMessageFollowUpEvidence = async (
  result: RealMessageFollowUpScenarioResult,
): Promise<string> => await createEvidenceFile("real-message-follow-up", result);

export const writeRealMessageFollowUpFailureEvidence = async (
  harness: RealKernelHarness,
  error: unknown,
): Promise<string> => {
  const primaryRoomId = harness.session.primaryRoomId;
  const primaryRoomMessages = primaryRoomId
    ? listPrimaryRoomMessages(harness, {
        chatId: primaryRoomId,
      })
    : [];
  const diagnostics = await harness.collectDiagnostics({
    label: "real-message-follow-up-failure",
    messageLimit: MESSAGE_LIMIT,
  });
  return await createEvidenceFile("real-message-follow-up-failure", {
    primaryRoomId,
    error:
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
          }
        : {
            message: String(error),
          },
    primaryRoomMessages,
    recentModelCalls: diagnostics.recentModelCalls,
    rootWorkspaceBashRuns: extractRootWorkspaceBashRuns(diagnostics.recentModelCalls),
  });
};
