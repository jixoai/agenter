import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { MessageControlPlane, MessageRecord } from "@agenter/message-system";

import type { ChatMessage, SessionRuntimeAttentionState } from "../src";
import { excludeActiveContextPrefixes, waitForScopedAttentionSettled } from "./attention-test-primitive";
import type { RealKernelHarness } from "./real-kernel-harness";
import { waitForRealValue } from "./real-kernel-harness";

const DEFAULT_TIMEOUT_MS = 180_000;
const chatScenarioAttentionScope = excludeActiveContextPrefixes("ctx-task-source-");
const SOURCE_FILE_NAME = "brief.txt";
const TARGET_FILE_NAME = "result.txt";
const SOURCE_MARKER = "SOURCE-MARKER: ALPHA";
const TARGET_CONTENT = "TARGET-RESULT: ALPHA";
const SUCCESS_REPLY = "MULTI-WORKSPACE-OK";

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

const waitForAssistantMessage = async (
  harness: RealKernelHarness,
  input: {
    label: string;
    predicate: (message: ChatMessage) => boolean;
    timeoutMs?: number;
  },
): Promise<ChatMessage> =>
  await waitForRealValue(
    () => listRoomTruthMessages(harness).filter((message) => message.role === "assistant" && input.predicate(message)).at(-1) ?? null,
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
      const calls = (await harness.kernel.inspectModelDebug(harness.session.id)).recentModelCalls;
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

const extractRootBashCommands = (calls: Awaited<ReturnType<typeof waitForModelCallsAfter>>): string[] =>
  calls.flatMap((call) => {
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
  });

const extractWorkspaceBashCalls = (
  calls: Awaited<ReturnType<typeof waitForModelCallsAfter>>,
): Array<{ workspaceId: number; workspaceAlias: string | null; command: string }> =>
  calls.flatMap((call) => {
    const response = call.response;
    if (!response || typeof response !== "object" || !("toolTrace" in response) || !Array.isArray(response.toolTrace)) {
      return [];
    }
    return response.toolTrace.flatMap((entry) => {
      if (
        !entry ||
        typeof entry !== "object" ||
        entry.tool !== "workspace_bash" ||
        !("input" in entry) ||
        !entry.input ||
        typeof entry.input !== "object" ||
        typeof entry.input.workspaceId !== "number" ||
        typeof entry.input.command !== "string"
      ) {
        return [];
      }
      return [
        {
          workspaceId: entry.input.workspaceId,
          workspaceAlias: typeof entry.input.workspaceAlias === "string" ? entry.input.workspaceAlias : null,
          command: entry.input.command,
        },
      ];
    });
  });

const buildDiagnosticError = async (
  harness: RealKernelHarness,
  input: {
    label: string;
    error: unknown;
    targetWorkspacePath: string;
  },
): Promise<Error> => {
  const cause = input.error instanceof Error ? input.error : new Error(String(input.error));
  return new Error(
    [
      `${input.label} failed: ${cause.message}`,
      "diagnostics:",
      JSON.stringify(
        {
          harness: await harness.collectDiagnostics({ label: input.label }),
          targetFile:
            await readFile(join(input.targetWorkspacePath, TARGET_FILE_NAME), "utf8").catch(() => null),
        },
        null,
        2,
      ),
    ].join("\n"),
    { cause },
  );
};

export interface RealMultiWorkspaceScenarioResult {
  reply: ChatMessage;
  settledAttention: SessionRuntimeAttentionState;
  sourceWorkspaceId: number;
  targetWorkspaceId: number;
  targetWorkspacePath: string;
  targetContent: string;
  rootBashCommands: string[];
  workspaceBashCalls: Array<{ workspaceId: number; workspaceAlias: string | null; command: string }>;
}

export const runRealMultiWorkspaceScenario = async (
  harness: RealKernelHarness,
): Promise<RealMultiWorkspaceScenarioResult> => {
  const primaryRoomId = getPrimaryRoomId(harness);
  const sourceWorkspacePath = harness.workspacePath;
  const targetWorkspacePath = join(harness.rootDir, "target-workspace");
  await mkdir(targetWorkspacePath, { recursive: true });
  await writeFile(join(sourceWorkspacePath, SOURCE_FILE_NAME), `${SOURCE_MARKER}\n`, "utf8");
  await writeFile(join(targetWorkspacePath, ".keep"), "target\n", "utf8");
  harness.kernel.grantRuntimeWorkspace({
    runtimeId: harness.session.id,
    workspacePath: targetWorkspacePath,
    grants: [{ pattern: "/", mode: "rw" }],
  });
  const mounts = harness.kernel
    .listRuntimeWorkspaceMounts(harness.session.id)
    .filter((mount) => mount.kind === "workspace");
  const sourceMount = mounts.find((mount) => mount.workspacePath === sourceWorkspacePath);
  const targetMount = mounts.find((mount) => mount.workspacePath === targetWorkspacePath);
  if (!sourceMount || !targetMount) {
    throw new Error("expected both source and target workspace mounts");
  }

  const startAt = Date.now();
  const prompt = [
    `目标房间 chatId: ${primaryRoomId}`,
    "这是一个 multi-workspace 验证任务。",
    "必须先通过 root_bash 执行 `skill info agenter-runtime`。",
    "然后必须调用 workspace_list 看清当前挂载的两个 project workspace。",
    `源 workspace 里有 ${SOURCE_FILE_NAME}，其中包含唯一事实：${SOURCE_MARKER}`,
    `你必须只用 workspace_bash 在另一个 workspace 里写入 ${TARGET_FILE_NAME}，内容必须精确等于：${TARGET_CONTENT}`,
    "不要用 root_bash 直接读写任何 mounted workspace 文件。",
    `完成后只向 ${primaryRoomId} 发送一条用户可见消息，内容必须精确等于：${SUCCESS_REPLY}`,
    "完成后把相关 attention score 收敛到 0。",
  ].join("\n");

  try {
    const sent = await harness.kernel.sendChat(harness.session.id, prompt);
    if (!sent.ok) {
      throw new Error(`failed to send multi-workspace prompt: ${sent.reason ?? "unknown"}`);
    }

    const reply = await waitForAssistantMessage(harness, {
      label: "multi-workspace reply",
      predicate: (message) => message.chatId === primaryRoomId && message.content.trim() === SUCCESS_REPLY,
    });
    const targetContent = await waitForRealValue(
      async () => {
        try {
          const content = await readFile(join(targetWorkspacePath, TARGET_FILE_NAME), "utf8");
          return content.trim() === TARGET_CONTENT ? content.trim() : null;
        } catch {
          return null;
        }
      },
      {
        label: "target workspace result.txt",
        timeoutMs: DEFAULT_TIMEOUT_MS,
      },
    );
    const settledAttention = await waitForAttentionSettled(harness);
    const modelCalls = await waitForModelCallsAfter(harness, {
      afterTimestamp: startAt,
      label: "multi-workspace model calls",
    });

    return {
      reply,
      settledAttention,
      sourceWorkspaceId: sourceMount.runtimeWorkspaceId,
      targetWorkspaceId: targetMount.runtimeWorkspaceId,
      targetWorkspacePath,
      targetContent,
      rootBashCommands: extractRootBashCommands(modelCalls),
      workspaceBashCalls: extractWorkspaceBashCalls(modelCalls),
    };
  } catch (error) {
    throw await buildDiagnosticError(harness, {
      label: "real-multi-workspace-scenario",
      error,
      targetWorkspacePath,
    });
  }
};
