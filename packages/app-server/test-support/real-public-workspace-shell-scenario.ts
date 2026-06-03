import type { ChatMessage, SessionRuntimeAttentionState } from "../src";
import type { RealKernelHarness } from "./real-kernel-harness";
import {
  getRoomId,
  listRoomTruthMessages,
  readModelOutcomeCode,
  waitForAssistantMessage,
  waitForAttentionSettled,
  waitForModelCallsAfter,
} from "./real-room-terminal-delivery-scenario";

const PUBLIC_HOME = "/tmp/public-workspace-home";
const PUBLIC_PATH = "/tmp/public-workspace-path";
const PUBLIC_DONE_TOKEN = "PUBLIC-WORKSPACE-OK";
const DEFAULT_TIMEOUT_MS = 240_000;

type ModelCallRecord = Awaited<
  ReturnType<RealKernelHarness["kernel"]["inspectModelDebug"]>
>["recentModelCalls"][number];

interface ProjectedToolTraceEntry {
  tool: string;
  workspaceId: number | null;
  workspaceAlias: string | null;
  command: string | null;
  stdout: string | null;
  stderr: string | null;
  error: string | null;
}

export interface RealPublicWorkspaceShellScenarioResult {
  finalReply: ChatMessage;
  settledAttention: SessionRuntimeAttentionState;
  workspaceId: number;
  workspacePath: string;
  workspaceValues: Record<string, string>;
  toolTraceTools: string[];
  rootBashCommands: string[];
  workspaceBashCommands: Array<{ workspaceId: number; workspaceAlias: string | null; command: string }>;
  recentModelCalls: Array<{
    id: number;
    cycleId: number | null;
    status: "running" | "done" | "error" | "cancelled";
    outcome: string | null;
  }>;
  toolTrace: ProjectedToolTraceEntry[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readStringField = (value: unknown, key: string): string | null => {
  if (!isRecord(value)) {
    return null;
  }
  const field = value[key];
  return typeof field === "string" ? field : null;
};

const readNumberField = (value: unknown, key: string): number | null => {
  if (!isRecord(value)) {
    return null;
  }
  const field = value[key];
  return typeof field === "number" ? field : null;
};

const collectMarkedValues = (text: string): Record<string, string> => {
  const values: Record<string, string> = {};
  for (const match of text.matchAll(/__AGT_([A-Z_]+)__=([^\r\n]*)/gu)) {
    values[match[1]] = (match[2] ?? "").trimEnd();
  }
  return values;
};

const buildEnvDumpCommand = (): string =>
  [
    "marker_prefix=__AGT",
    `printf '%s_HOME__=%s\\n' "$marker_prefix" "$HOME"`,
    `printf '%s_ROOT__=%s\\n' "$marker_prefix" "\${AGENTER_ROOT_WORKSPACE-}"`,
    `printf '%s_HOME_DIR__=%s\\n' "$marker_prefix" "\${AGENTER_HOME_DIR-}"`,
    `printf '%s_PRIVATE__=%s\\n' "$marker_prefix" "\${AGENTER_AVATAR_PRIVATE_KEY-}"`,
    `printf '%s_PATH__=%s\\n' "$marker_prefix" "$PATH"`,
    `printf '%s_DONE__=1\\n' "$marker_prefix"`,
  ].join("; ");

const assertNoInterimAssistantMessages = (
  harness: RealKernelHarness,
  input: { startedAt: number; finalToken: string },
): void => {
  const assistantMessages = listRoomTruthMessages(harness).filter(
    (message) => message.role === "assistant" && message.timestamp >= input.startedAt,
  );
  const nonFinalMessages = assistantMessages.filter((message) => message.content.trim() !== input.finalToken);
  if (nonFinalMessages.length > 0) {
    throw new Error(
      `unexpected interim assistant room messages: ${nonFinalMessages.map((message) => JSON.stringify(message.content.trim())).join(", ")}`,
    );
  }
};

const projectToolTraceEntries = (calls: readonly ModelCallRecord[]): ProjectedToolTraceEntry[] =>
  calls.flatMap((call) => {
    const response = call.response;
    if (!isRecord(response) || !Array.isArray(response.toolTrace)) {
      return [];
    }
    return response.toolTrace.flatMap((entry) => {
      if (!isRecord(entry)) {
        return [];
      }
      const tool = readStringField(entry, "tool");
      if (!tool) {
        return [];
      }
      const input = isRecord(entry.input) ? entry.input : null;
      const output = isRecord(entry.output) ? entry.output : null;
      return [
        {
          tool,
          workspaceId: readNumberField(input, "workspaceId"),
          workspaceAlias: readStringField(input, "workspaceAlias"),
          command: readStringField(input, "command"),
          stdout: readStringField(output, "stdout"),
          stderr: readStringField(output, "stderr"),
          error: readStringField(entry, "error"),
        },
      ];
    });
  });

const buildScenarioPrompt = (input: { roomId: string; envDumpCommand: string }): string =>
  [
    "请执行一次最小 public-workspace shell 审计，只验证事实，不要猜测。",
    `当前房间 chatId: ${input.roomId}`,
    "除了最终 required token 以外，不允许发送任何 assistant room 消息。",
    `最终只在 ${input.roomId} 发送一条用户可见消息，内容必须精确等于：${PUBLIC_DONE_TOKEN}。`,
    "你现在的直接工具是 workspace_list、root_bash、workspace_bash。",
    "必须先调用 workspace_list，看清当前 mounted public-workspace。",
    "然后必须只对那个 mounted public-workspace 调用 workspace_bash。",
    "不要用 root_bash 执行 env dump，也不要在 terminal 里做这个检查。",
    `workspace_bash 的 env 必须精确传入 HOME=${PUBLIC_HOME} 和 PATH=${PUBLIC_PATH}。`,
    "workspace_bash 的 command 必须精确执行下面这条 env dump 命令：",
    input.envDumpCommand,
    "完成后发送最终消息，然后收敛 attention。",
  ].join("\n");

const buildScenarioError = async (
  harness: RealKernelHarness,
  input: {
    error: unknown;
    startAt: number;
    toolTrace: ProjectedToolTraceEntry[];
  },
): Promise<Error> => {
  const cause = input.error instanceof Error ? input.error : new Error(String(input.error));
  const diagnostics = await harness.collectDiagnostics({
    label: "real-public-workspace-shell",
  });
  return new Error(
    [
      `real public-workspace shell scenario failed: ${cause.message}`,
      "diagnostics:",
      JSON.stringify(
        {
          ...diagnostics,
          startedAt: input.startAt,
          toolTrace: input.toolTrace,
        },
        null,
        2,
      ),
    ].join("\n"),
    { cause },
  );
};

export const runRealPublicWorkspaceShellScenario = async (
  harness: RealKernelHarness,
): Promise<RealPublicWorkspaceShellScenarioResult> => {
  const roomId = getRoomId(harness);
  const envDumpCommand = buildEnvDumpCommand();
  const workspaceMount = harness.kernel
    .listRuntimeWorkspaceMounts(harness.session.id)
    .find((entry) => entry.workspacePath === harness.workspacePath && entry.kind === "workspace");
  if (!workspaceMount) {
    throw new Error(`missing public-workspace mount for ${harness.session.id}`);
  }
  const startAt = Date.now();
  let projectedTrace: ProjectedToolTraceEntry[] = [];

  try {
    const sent = await harness.kernel.pushUserRoomMessage({
      sessionId: harness.session.id,
      chatId: roomId,
      text: buildScenarioPrompt({
        roomId,
        envDumpCommand,
      }),
    });
    if (!sent.ok) {
      throw new Error(`failed to send public-workspace prompt: ${sent.reason ?? "unknown"}`);
    }

    const finalReply = await waitForAssistantMessage(harness, {
      label: "public-workspace final reply",
      predicate: (message) => message.chatId === roomId && message.content.trim() === PUBLIC_DONE_TOKEN,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });
    assertNoInterimAssistantMessages(harness, {
      startedAt: startAt,
      finalToken: PUBLIC_DONE_TOKEN,
    });
    const settledAttention = await waitForAttentionSettled(harness, DEFAULT_TIMEOUT_MS);
    const modelCallRecords = await waitForModelCallsAfter(harness, {
      afterTimestamp: startAt,
      label: "public-workspace model calls",
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });
    projectedTrace = projectToolTraceEntries(modelCallRecords);

    const workspaceEntry =
      projectedTrace
        .filter(
          (entry) =>
            entry.tool === "workspace_bash" &&
            entry.workspaceId === workspaceMount.runtimeWorkspaceId &&
            (entry.stdout ?? "").includes("__AGT_DONE__=1"),
        )
        .at(-1) ?? null;
    if (!workspaceEntry) {
      throw new Error("missing workspace_bash env dump output");
    }

    return {
      finalReply,
      settledAttention,
      workspaceId: workspaceMount.runtimeWorkspaceId,
      workspacePath: workspaceMount.workspacePath,
      workspaceValues: collectMarkedValues(workspaceEntry.stdout ?? ""),
      toolTraceTools: projectedTrace.map((entry) => entry.tool),
      rootBashCommands: projectedTrace
        .filter((entry) => entry.tool === "root_bash" && entry.command !== null)
        .map((entry) => entry.command ?? ""),
      workspaceBashCommands: projectedTrace.flatMap((entry) =>
        entry.tool === "workspace_bash" && entry.workspaceId !== null && entry.command !== null
          ? [
              {
                workspaceId: entry.workspaceId,
                workspaceAlias: entry.workspaceAlias,
                command: entry.command,
              },
            ]
          : [],
      ),
      recentModelCalls: modelCallRecords.map((call) => ({
        id: call.id,
        cycleId: call.cycleId,
        status: call.status,
        outcome: readModelOutcomeCode(call),
      })),
      toolTrace: projectedTrace,
    };
  } catch (error) {
    throw await buildScenarioError(harness, {
      error,
      startAt,
      toolTrace: projectedTrace,
    });
  }
};
