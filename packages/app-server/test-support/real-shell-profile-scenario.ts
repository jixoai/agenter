import type { ChatMessage, SessionRuntimeAttentionState } from "../src";
import { resolveRuntimeShellBinDir } from "../src/runtime-shell-bin";
import type { RealKernelHarness } from "./real-kernel-harness";
import {
  getPrimaryRoomId,
  listRoomTruthMessages,
  readModelOutcomeCode,
  waitForAssistantMessage,
  waitForAttentionSettled,
  waitForModelCallsAfter,
} from "./real-room-terminal-delivery-scenario";

const PROFILE_DONE_TOKEN = "PROFILE-CHECK-DONE";
const DEFAULT_TIMEOUT_MS = 240_000;

type ModelCallRecord = Awaited<
  ReturnType<RealKernelHarness["kernel"]["inspectModelDebug"]>
>["recentModelCalls"][number];

interface ProjectedToolTraceEntry {
  tool: string;
  command: string | null;
  stdin: string | null;
  stdout: string | null;
  stderr: string | null;
  error: string | null;
}

export interface RealShellProfileScenarioResult {
  finalReply: ChatMessage;
  settledAttention: SessionRuntimeAttentionState;
  rootWorkspacePath: string;
  runtimeBinDir: string;
  terminalId: string;
  terminalCreateCwd: string;
  rootShellValues: Record<string, string>;
  terminalValues: Record<string, string>;
  toolTraceTools: string[];
  rootBashCommands: string[];
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

const parseJsonValue = (value: string | null): unknown => {
  if (!value) {
    return null;
  }
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
};

const collectMarkedValues = (text: string): Record<string, string> => {
  const values: Record<string, string> = {};
  for (const match of text.matchAll(/__AGT_([A-Z_]+)__=([^\r\n]*)/gu)) {
    values[match[1]] = (match[2] ?? "").trimEnd();
  }
  return values;
};

const collectRichRowText = (rows: unknown): string =>
  Array.isArray(rows)
    ? rows
        .map((row) => {
          if (!isRecord(row) || !Array.isArray(row.spans)) {
            return "";
          }
          return row.spans.map((span) => (isRecord(span) && typeof span.text === "string" ? span.text : "")).join("");
        })
        .join("\n")
    : "";

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

const getRuntimeRootWorkspacePath = (harness: RealKernelHarness): string => {
  const mount = harness.kernel
    .listRuntimeWorkspaceMounts(harness.session.id)
    .find((entry) => entry.kind === "avatar-root");
  if (!mount) {
    throw new Error(`missing avatar-root mount for ${harness.session.id}`);
  }
  return mount.workspacePath;
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
          command: readStringField(input, "command"),
          stdin: readStringField(input, "stdin"),
          stdout: readStringField(output, "stdout"),
          stderr: readStringField(output, "stderr"),
          error: readStringField(entry, "error"),
        },
      ];
    });
  });

const extractTerminalReadContent = (stdout: string | null): string => {
  const fallback = stdout ?? "";
  const payload = parseJsonValue(stdout);
  if (!isRecord(payload)) {
    return fallback;
  }
  const result = isRecord(payload.result) ? payload.result : null;
  if (!result) {
    return fallback;
  }
  if (result.kind === "terminal-diff") {
    const diff = typeof result.diff === "string" ? result.diff : "";
    return diff.includes("__AGT_") ? diff : fallback;
  }
  if (result.kind === "terminal-snapshot") {
    const snapshot = isRecord(result.snapshot) ? result.snapshot : null;
    if (snapshot && Array.isArray(snapshot.lines)) {
      const lines = snapshot.lines.filter((line): line is string => typeof line === "string").join("\n");
      if (lines.includes("__AGT_")) {
        return lines;
      }
    }
    const richLines = snapshot ? collectRichRowText(snapshot.richLines) : "";
    if (richLines.includes("__AGT_")) {
      return richLines;
    }
    const rows = snapshot ? collectRichRowText(snapshot.rows) : "";
    if (rows.includes("__AGT_")) {
      return rows;
    }
    const tail = typeof result.tail === "string" ? result.tail : "";
    return tail.includes("__AGT_") ? tail : fallback;
  }
  return fallback;
};

const parseTerminalCreatePayload = (stdout: string | null): { terminalId: string | null } => {
  const payload = parseJsonValue(stdout);
  if (!isRecord(payload)) {
    return { terminalId: null };
  }
  const result = isRecord(payload.result) ? payload.result : null;
  const terminal = result && isRecord(result.terminal) ? result.terminal : null;
  return {
    terminalId: readStringField(terminal, "terminalId"),
  };
};

const parseTerminalCreateCwd = (stdin: string | null): string => {
  const payload = parseJsonValue(stdin);
  return readStringField(payload, "cwd") ?? "";
};

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

const buildScenarioPrompt = (input: { primaryRoomId: string; envDumpCommand: string }): string =>
  [
    "请执行一次最小 shell profile 审计，只验证事实，不要猜测。",
    `当前房间 chatId: ${input.primaryRoomId}`,
    "不要发送中间确认，不要打开任何 SKILL.md，也不要运行 skill info。",
    "除了最终 required token 以外，不允许发送任何 assistant room 消息。",
    `最终只在 ${input.primaryRoomId} 发送一条用户可见消息，内容必须精确等于：${PROFILE_DONE_TOKEN}。`,
    "直接使用 root_bash 和共享 terminal，不要使用 workspace_bash。",
    "第 1 步：先通过 root_bash 精确执行下面这条 env dump 命令，并记住输出里的 __AGT_HOME__ 值：",
    input.envDumpCommand,
    "第 2 步：创建一个 shared terminal。必须通过 root_bash 执行 `terminal create`，并且把 cwd 设为第 1 步拿到的 __AGT_HOME__，也就是 root-workspace 路径。",
    "第 3 步：继续通过 root_bash 执行 `terminal write`，在这个 terminal 里运行与第 1 步完全相同的 env dump 命令；写入 text 时末尾补 `\\r`。",
    "第 4 步：继续通过 root_bash 执行 `terminal read`，直到输出里看到 `__AGT_DONE__=1`。",
    `第 5 步：完成后只发送最终消息 ${PROFILE_DONE_TOKEN}。`,
    "第 6 步：最后收敛 attention。",
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
    label: "real-shell-profile",
  });
  return new Error(
    [
      `real shell profile scenario failed: ${cause.message}`,
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

export const runRealShellProfileScenario = async (
  harness: RealKernelHarness,
): Promise<RealShellProfileScenarioResult> => {
  const primaryRoomId = getPrimaryRoomId(harness);
  const envDumpCommand = buildEnvDumpCommand();
  const rootWorkspacePath = getRuntimeRootWorkspacePath(harness);
  const runtimeBinDir = resolveRuntimeShellBinDir(rootWorkspacePath);
  const startAt = Date.now();
  let projectedTrace: ProjectedToolTraceEntry[] = [];

  try {
    const sent = await harness.kernel.sendChat(
      harness.session.id,
      buildScenarioPrompt({
        primaryRoomId,
        envDumpCommand,
      }),
    );
    if (!sent.ok) {
      throw new Error(`failed to send shell-profile prompt: ${sent.reason ?? "unknown"}`);
    }

    const finalReply = await waitForAssistantMessage(harness, {
      label: "shell-profile final reply",
      predicate: (message) => message.chatId === primaryRoomId && message.content.trim() === PROFILE_DONE_TOKEN,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });
    assertNoInterimAssistantMessages(harness, {
      startedAt: startAt,
      finalToken: PROFILE_DONE_TOKEN,
    });
    const settledAttention = await waitForAttentionSettled(harness, DEFAULT_TIMEOUT_MS);
    const modelCallRecords = await waitForModelCallsAfter(harness, {
      afterTimestamp: startAt,
      label: "shell-profile model calls",
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });
    projectedTrace = projectToolTraceEntries(modelCallRecords);

    const rootShellEntry =
      projectedTrace
        .filter(
          (entry) =>
            entry.tool === "root_bash" &&
            typeof entry.command === "string" &&
            !entry.command.startsWith("terminal ") &&
            (entry.stdout ?? "").includes("__AGT_DONE__=1"),
        )
        .at(-1) ?? null;
    if (!rootShellEntry) {
      throw new Error("missing root_bash env dump output");
    }

    const terminalCreateEntry =
      projectedTrace.filter((entry) => entry.tool === "root_bash" && entry.command === "terminal create").at(-1) ??
      null;
    if (!terminalCreateEntry) {
      throw new Error("missing terminal create trace");
    }
    const terminalId = parseTerminalCreatePayload(terminalCreateEntry.stdout).terminalId;
    if (!terminalId) {
      throw new Error("missing terminalId in terminal create output");
    }

    const terminalReadEntry =
      projectedTrace
        .filter(
          (entry) =>
            entry.tool === "root_bash" &&
            entry.command === "terminal read" &&
            extractTerminalReadContent(entry.stdout).includes("__AGT_DONE__=1"),
        )
        .at(-1) ?? null;
    if (!terminalReadEntry) {
      throw new Error("missing terminal read output with env markers");
    }

    return {
      finalReply,
      settledAttention,
      rootWorkspacePath,
      runtimeBinDir,
      terminalId,
      terminalCreateCwd: parseTerminalCreateCwd(terminalCreateEntry.stdin),
      rootShellValues: collectMarkedValues(rootShellEntry.stdout ?? ""),
      terminalValues: collectMarkedValues(extractTerminalReadContent(terminalReadEntry.stdout)),
      toolTraceTools: projectedTrace.map((entry) => entry.tool),
      rootBashCommands: projectedTrace
        .filter((entry) => entry.tool === "root_bash" && entry.command !== null)
        .map((entry) => entry.command ?? ""),
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

export const projectRealShellProfileResult = (result: RealShellProfileScenarioResult) => ({
  finalReply: result.finalReply,
  settledAttentionActiveCount: result.settledAttention.active.length,
  rootWorkspacePath: result.rootWorkspacePath,
  runtimeBinDir: result.runtimeBinDir,
  terminalId: result.terminalId,
  terminalCreateCwd: result.terminalCreateCwd,
  rootShellValues: result.rootShellValues,
  terminalValues: result.terminalValues,
  toolTraceTools: result.toolTraceTools,
  rootBashCommands: result.rootBashCommands,
  recentModelCalls: result.recentModelCalls,
  toolTrace: result.toolTrace,
});
