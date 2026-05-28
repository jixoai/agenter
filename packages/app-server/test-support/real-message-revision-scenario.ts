import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { MessageControlPlane, MessageRecord } from "@agenter/message-system";

import type { SessionRuntimeAttentionState } from "../src";
import { excludeActiveContextPrefixes, waitForScopedAttentionSettled } from "./attention-test-primitive";
import type { RealKernelHarness, RealKernelHarnessDiagnostics } from "./real-kernel-harness";
import { REAL_MODEL_PROJECT_ROOT, waitForRealValue } from "./real-kernel-harness";

const DEFAULT_TIMEOUT_MS = 240_000;
const MESSAGE_LIMIT = 64;
const chatScenarioAttentionScope = excludeActiveContextPrefixes("ctx-task-source-");

export type ObservedMessageRevisionPattern =
  | "send+edit"
  | "send+recall+send"
  | "send+send"
  | "send+single"
  | "unknown";

export interface RoomMessageEvidence {
  rowId: number;
  messageId: number;
  chatId: string;
  from: string;
  senderContactId?: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  visibleAt?: number;
  recalledAt?: number;
  recalledByContactId?: string;
}

export interface RealMessageRevisionScenarioResult {
  scenario: "edit" | "recall";
  primaryRoomId: string;
  packageName: string;
  prompt: string;
  draftText: string;
  expectedVersion: string;
  expectedFinalText: string;
  observedPattern: ObservedMessageRevisionPattern;
  finalMessage: RoomMessageEvidence;
  revisedMessage: RoomMessageEvidence | null;
  recalledMessage: RoomMessageEvidence | null;
  acknowledgementMessages: RoomMessageEvidence[];
  primaryRoomMessages: RoomMessageEvidence[];
  assistantMessages: RoomMessageEvidence[];
  settledAttention: SessionRuntimeAttentionState;
  recentModelCalls: RealKernelHarnessDiagnostics["recentModelCalls"];
  rootWorkspaceBashCommands: string[];
  directMessageMutationTools: string[];
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
  senderContactId: message.senderContactId,
  content: message.content,
  createdAt: message.createdAt,
  updatedAt: message.updatedAt,
  visibleAt: message.visibleAt,
  recalledAt: message.recalledAt,
  recalledByContactId: message.recalledByContactId,
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
  input: {
    scenario: "edit" | "recall";
    startAt: number;
    timeoutMs?: number;
  },
): Promise<RealKernelHarnessDiagnostics> =>
  await waitForRealValue(
    async () => {
      const diagnostics = await harness.collectDiagnostics({
        label: `real-message-revision-${input.scenario}`,
        messageLimit: MESSAGE_LIMIT,
      });
      const relevantCalls = diagnostics.recentModelCalls.filter((call) => call.createdAt >= input.startAt);
      return relevantCalls.length > 0 && relevantCalls.every((call) => call.status !== "running") ? diagnostics : null;
    },
    {
      label: `${input.scenario} diagnostics`,
      timeoutMs: input.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    },
  );

const extractRootWorkspaceBashCommands = (
  recentModelCalls: RealKernelHarnessDiagnostics["recentModelCalls"],
): string[] =>
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
      return [(entry.input as { command: string }).command];
    }),
  );

const extractDirectMessageMutationTools = (
  recentModelCalls: RealKernelHarnessDiagnostics["recentModelCalls"],
): string[] =>
  recentModelCalls.flatMap((call) =>
    call.toolTrace
      .map((entry) => entry.tool)
      .filter((tool) => tool === "message edit" || tool === "message recall" || tool === "message send"),
  );

const classifyObservedPattern = (input: {
  assistantMessages: RoomMessageEvidence[];
  expectedFinalText: string;
  rootWorkspaceBashCommands: string[];
  directMessageMutationTools: string[];
}): ObservedMessageRevisionPattern => {
  const { assistantMessages, expectedFinalText, rootWorkspaceBashCommands, directMessageMutationTools } = input;
  const usedRecall =
    rootWorkspaceBashCommands.some((command) => command.includes("message recall")) ||
    directMessageMutationTools.includes("message recall");
  const usedEdit =
    rootWorkspaceBashCommands.some((command) => command.includes("message edit")) ||
    directMessageMutationTools.includes("message edit");
  const revisedMessage = assistantMessages.find(
    (message) => message.content.trim() === expectedFinalText && message.updatedAt > message.createdAt,
  );
  const recalledMessage = assistantMessages.find((message) => typeof message.recalledAt === "number");

  if (assistantMessages.length === 0) {
    return "unknown";
  }
  if (usedEdit && revisedMessage) {
    return "send+edit";
  }
  if (usedRecall && recalledMessage) {
    return assistantMessages.some((message) => message.messageId !== recalledMessage.messageId) ? "send+recall+send" : "unknown";
  }
  if (assistantMessages.some((message) => message.content.trim() === expectedFinalText) && assistantMessages.length >= 2) {
    return "send+send";
  }
  return assistantMessages.length === 1 ? "send+single" : "unknown";
};

const fetchNpmLatestVersion = async (packageName: string): Promise<string> => {
  const response = await fetch(`https://registry.npmjs.org/${packageName}/latest`, {
    headers: {
      accept: "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(`failed to fetch npm latest metadata for ${packageName}: ${response.status} ${response.statusText}`);
  }
  const payload = (await response.json()) as { version?: unknown };
  if (typeof payload.version !== "string" || payload.version.trim().length === 0) {
    throw new Error(`npm latest metadata for ${packageName} did not expose a version string`);
  }
  return payload.version.trim();
};

const createScenarioResult = async (
  harness: RealKernelHarness,
  input: {
    scenario: "edit" | "recall";
    startAt: number;
    packageName: string;
    prompt: string;
    draftText: string;
    expectedVersion: string;
    expectedFinalText: string;
    timeoutMs?: number;
  },
): Promise<RealMessageRevisionScenarioResult> => {
  const primaryRoomId = getPrimaryRoomId(harness);
  const finalMessage = await waitForAssistantMessage(harness, {
    chatId: primaryRoomId,
    createdAfterOrAt: input.startAt,
    exactContent: input.expectedFinalText,
    label: `${input.scenario} final message`,
    timeoutMs: input.timeoutMs,
  });
  const settledAttention = await waitForAttentionSettled(harness, input.timeoutMs);
  const diagnostics = await waitForCompletedDiagnostics(harness, {
    scenario: input.scenario,
    startAt: input.startAt,
    timeoutMs: input.timeoutMs,
  });
  const relevantCalls = diagnostics.recentModelCalls.filter((call) => call.createdAt >= input.startAt);
  const primaryRoomMessages = listPrimaryRoomMessages(harness, {
    chatId: primaryRoomId,
    createdAfterOrAt: input.startAt,
  });
  const assistantMessages = primaryRoomMessages.filter((message) => message.from === harness.session.avatar);
  const rootWorkspaceBashCommands = extractRootWorkspaceBashCommands(relevantCalls);
  const directMessageMutationTools = extractDirectMessageMutationTools(relevantCalls);
  const revisedMessage =
    assistantMessages.find((message) => message.content.trim() === input.expectedFinalText && message.updatedAt > message.createdAt) ??
    null;
  const recalledMessage = assistantMessages.find((message) => typeof message.recalledAt === "number") ?? null;
  const acknowledgementMessages = assistantMessages.filter(
    (message) =>
      message.messageId !== finalMessage.messageId &&
      message.messageId !== revisedMessage?.messageId &&
      message.messageId !== recalledMessage?.messageId,
  );

  return {
    scenario: input.scenario,
    primaryRoomId,
    packageName: input.packageName,
    prompt: input.prompt,
    draftText: input.draftText,
    expectedVersion: input.expectedVersion,
    expectedFinalText: input.expectedFinalText,
    observedPattern: classifyObservedPattern({
      assistantMessages,
      expectedFinalText: input.expectedFinalText,
      rootWorkspaceBashCommands,
      directMessageMutationTools,
    }),
    finalMessage,
    revisedMessage,
    recalledMessage,
    acknowledgementMessages,
    primaryRoomMessages,
    assistantMessages,
    settledAttention,
    recentModelCalls: relevantCalls,
    rootWorkspaceBashCommands,
    directMessageMutationTools,
  };
};

export const runRealDraftEditScenario = async (
  harness: RealKernelHarness,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<RealMessageRevisionScenarioResult> => {
  const primaryRoomId = getPrimaryRoomId(harness);
  const packageName = "ccski";
  const expectedVersion = await fetchNpmLatestVersion(packageName);
  const draftText = `草稿：我先猜 ${packageName} latest 是 0.0.0，正在核实。`;
  const expectedFinalText = `已核实：${packageName} latest 是 ${expectedVersion}。`;
  const prompt = [
    "你正在参与一个真实房间修正测试。",
    `你只能在房间 ${primaryRoomId} 与用户沟通。`,
    "不要解释内部过程，也不要发送多余的状态消息。",
    `第 1 步：立刻在房间里发送这条精确草稿消息：${draftText}`,
    `第 2 步：通过 shell 或其它客观方式核实 npm 上 ${packageName} 的 latest 版本号。`,
    `第 3 步：那条草稿仍然应该保留为同一条房间事实，所以把那条已发出的房间消息修正为这条精确最终消息：${expectedFinalText}`,
    "最终房间里只应该留下你的一条可见答案，不要再追加第二条最终答案。",
    "完成后把相关 attention 收敛到 0。",
  ].join("\n");
  const startAt = Date.now();
  const sent = await harness.kernel.sendChat(harness.session.id, prompt);
  if (!sent.ok) {
    throw new Error(`failed to send edit scenario prompt: ${sent.reason ?? "unknown"}`);
  }
  return await createScenarioResult(harness, {
    scenario: "edit",
    startAt,
    packageName,
    prompt,
    draftText,
    expectedVersion,
    expectedFinalText,
    timeoutMs,
  });
};

export const runRealDraftRecallScenario = async (
  harness: RealKernelHarness,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<RealMessageRevisionScenarioResult> => {
  const primaryRoomId = getPrimaryRoomId(harness);
  const packageName = "ccski";
  const expectedVersion = await fetchNpmLatestVersion(packageName);
  const draftText = `占位：我先查 ${packageName} latest，稍后给最终结果。`;
  const expectedFinalText = `已核实：${packageName} latest 是 ${expectedVersion}。`;
  const prompt = [
    "你正在参与一个真实房间撤回测试。",
    `你只能在房间 ${primaryRoomId} 与用户沟通。`,
    "不要解释内部过程，也不要发送多余的状态消息。",
    `第 1 步：立刻在房间里发送这条精确占位消息：${draftText}`,
    `第 2 步：通过 shell 或其它客观方式核实 npm 上 ${packageName} 的 latest 版本号。`,
    `第 3 步：那条占位消息不应该继续留在房间里。先把它从房间里撤掉，再发送这条精确最终消息：${expectedFinalText}`,
    "最终房间里应该能看出旧草稿已经被撤掉，最终答案则是一条新的消息。",
    "完成后把相关 attention 收敛到 0。",
  ].join("\n");
  const startAt = Date.now();
  const sent = await harness.kernel.sendChat(harness.session.id, prompt);
  if (!sent.ok) {
    throw new Error(`failed to send recall scenario prompt: ${sent.reason ?? "unknown"}`);
  }
  return await createScenarioResult(harness, {
    scenario: "recall",
    startAt,
    packageName,
    prompt,
    draftText,
    expectedVersion,
    expectedFinalText,
    timeoutMs,
  });
};

const createEvidenceFile = async (prefix: string, payload: unknown): Promise<string> => {
  const evidenceDir = join(REAL_MODEL_PROJECT_ROOT, ".chat");
  await mkdir(evidenceDir, { recursive: true });
  const path = join(evidenceDir, `${prefix}-${Date.now()}.json`);
  await writeFile(path, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return path;
};

export const writeRealMessageRevisionEvidence = async (
  result: RealMessageRevisionScenarioResult,
): Promise<string> => await createEvidenceFile(`real-message-revision-${result.scenario}`, result);

export const writeRealMessageRevisionFailureEvidence = async (
  harness: RealKernelHarness,
  input: {
    scenario: "edit" | "recall";
    error: unknown;
  },
): Promise<string> => {
  const primaryRoomId = harness.session.primaryRoomId;
  const primaryRoomMessages = primaryRoomId
    ? listPrimaryRoomMessages(harness, {
        chatId: primaryRoomId,
      })
    : [];
  const assistantMessages = primaryRoomMessages.filter((message) => message.from === harness.session.avatar);
  const diagnostics = await harness.collectDiagnostics({
    label: `real-message-revision-${input.scenario}-failure`,
    messageLimit: MESSAGE_LIMIT,
  });
  return await createEvidenceFile(`real-message-revision-${input.scenario}-failure`, {
    scenario: input.scenario,
    primaryRoomId,
    observedPattern: classifyObservedPattern({
      assistantMessages,
      expectedFinalText: "",
      rootWorkspaceBashCommands: extractRootWorkspaceBashCommands(diagnostics.recentModelCalls),
      directMessageMutationTools: extractDirectMessageMutationTools(diagnostics.recentModelCalls),
    }),
    error:
      input.error instanceof Error
        ? {
            name: input.error.name,
            message: input.error.message,
            stack: input.error.stack,
          }
        : {
            message: String(input.error),
          },
    primaryRoomMessages,
    recentModelCalls: diagnostics.recentModelCalls,
  });
};
