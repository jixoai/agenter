import type { HeartbeatGroupItem, RuntimeClientState } from "@agenter/client-sdk";

import type { CliShellStore } from "./bootstrap";

export const CLI_SHELL_HEARTBEAT_COPY = {
  disconnected: "正在连接 Agenter daemon...",
  observationPending: "等待 Avatar Heartbeat...",
  observationReady: "Avatar started; 等待新的 Heartbeat...",
} as const;

export type CliShellToolbarStatusKind =
  | "idle"
  | "text-progressing"
  | "thinking"
  | "tool-call"
  | "message-tool"
  | "terminal-tool";

export interface CliShellHeartbeatStatusStore
  extends Pick<CliShellStore, "autoLogin" | "setAuthToken"> {
  hydrateSessionArtifacts(
    sessionId: string,
    input?: { includeChatHistory?: boolean; observabilityMode?: "full" | "heartbeat" },
  ): Promise<void>;
  getState(): RuntimeClientState;
}

const TOOL_NAMESPACE_LABELS = {
  attention: "注意力",
  message: "消息",
  other: "工具",
  terminal: "终端",
} as const;

const TOOL_VERB_LABELS = {
  done: "完成",
  error: "失败",
  running: "处理中",
} as const;

const STATUS_ICONS: Record<CliShellToolbarStatusKind, string> = {
  idle: "◉",
  "message-tool": "✉",
  thinking: "◌",
  "text-progressing": "✎",
  "tool-call": "⚙",
  "terminal-tool": "⌘",
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const readRecordString = (value: Record<string, unknown>, key: string): string | null => {
  const candidate = value[key];
  return typeof candidate === "string" && candidate.trim().length > 0 ? candidate : null;
};

const classifyToolName = (toolName: string | null): keyof typeof TOOL_NAMESPACE_LABELS => {
  if (!toolName) {
    return "other";
  }
  if (
    toolName.startsWith("terminal_") ||
    toolName === "root_bash" ||
    toolName === "workspace_bash" ||
    toolName === "workspace_exec"
  ) {
    return "terminal";
  }
  if (toolName.startsWith("message_")) {
    return "message";
  }
  if (toolName.startsWith("attention_")) {
    return "attention";
  }
  return "other";
};

const resolveToolTail = (toolName: string | null): string => {
  if (!toolName) {
    return "call";
  }
  if (toolName === "root_bash" || toolName === "workspace_bash") {
    return "bash";
  }
  const tokens = toolName.split("_").filter((token) => token.length > 0);
  return tokens[tokens.length - 1] ?? toolName;
};

const resolveLatestHeartbeatPart = (groups: readonly HeartbeatGroupItem[]) => {
  const group = groups.at(-1) ?? null;
  const item = group?.items.at(-1) ?? null;
  const part = item?.parts.at(-1) ?? null;
  return {
    group,
    item,
    part,
  };
};

export const resolveCliShellToolbarStatus = (
  groups: readonly HeartbeatGroupItem[],
): CliShellToolbarStatusKind => {
  const latest = resolveLatestHeartbeatPart(groups);
  if (!latest.part) {
    return "idle";
  }

  if (latest.part.partType === "thinking") {
    return "thinking";
  }
  if (latest.part.partType === "text" && latest.part.isComplete === false) {
    return "text-progressing";
  }
  if (latest.part.partType === "tool_call" || latest.part.partType === "tool_result") {
    const toolName = isRecord(latest.part.payload) ? readRecordString(latest.part.payload, "tool") : null;
    const namespace = classifyToolName(toolName);
    if (namespace === "message") {
      return "message-tool";
    }
    if (namespace === "terminal") {
      return "terminal-tool";
    }
    return "tool-call";
  }
  return "idle";
};

const readToolTraceField = (content: string, key: string): string | null => {
  const match = content.match(new RegExp(`^\\s*${key}:\\s*(.+?)\\s*$`, "m"));
  if (!match) {
    return null;
  }
  const value = match[1]?.trim() ?? "";
  if (!value || value === "null") {
    return null;
  }
  return value.replace(/^['"]|['"]$/g, "");
};

const parseToolTraceSummary = (
  content: string,
): {
  toolName: string | null;
  completed: boolean;
  error: string | null;
} | null => {
  if (!content.includes("tool:")) {
    return null;
  }
  const toolName = readToolTraceField(content, "tool");
  if (!toolName) {
    return null;
  }
  const status = readToolTraceField(content, "status")?.toLowerCase() ?? null;
  const error = readToolTraceField(content, "error");
  return {
    toolName,
    completed: status === "success" || status === "completed" || status === "done",
    error,
  };
};

const summarizeToolPart = (payload: unknown, completed: boolean): string => {
  const record = isRecord(payload) ? payload : {};
  const toolName = readRecordString(record, "tool");
  const namespace = classifyToolName(toolName);
  const namespaceLabel = TOOL_NAMESPACE_LABELS[namespace];
  const tail = resolveToolTail(toolName);
  const error = readRecordString(record, "error");
  const verb = error ? TOOL_VERB_LABELS.error : completed ? TOOL_VERB_LABELS.done : TOOL_VERB_LABELS.running;
  return `${namespaceLabel}工具 ${tail} ${verb}`;
};

const summarizeTextLikePart = (payload: unknown, fallback: string): string => {
  if (!isRecord(payload)) {
    return fallback;
  }
  const content =
    readRecordString(payload, "content") ?? readRecordString(payload, "text") ?? readRecordString(payload, "summary");
  if (!content) {
    return fallback;
  }
  const parsedToolTrace = parseToolTraceSummary(content);
  if (parsedToolTrace) {
    return summarizeToolPart(
      {
        tool: parsedToolTrace.toolName,
        ...(parsedToolTrace.error ? { error: parsedToolTrace.error } : {}),
      },
      parsedToolTrace.completed,
    );
  }
  return content;
};

const normalizeStatusText = (text: string): string => text.replace(/\s+/gu, " ").trim();

export const summarizeCliShellHeartbeat = (input: {
  groups: readonly HeartbeatGroupItem[];
  shellName: string;
  connected: boolean;
  observationReady?: boolean;
}): string => {
  if (!input.connected) {
    return CLI_SHELL_HEARTBEAT_COPY.disconnected;
  }
  if (input.observationReady === false) {
    return CLI_SHELL_HEARTBEAT_COPY.observationPending;
  }

  const latest = resolveLatestHeartbeatPart(input.groups);
  if (!latest.part || !latest.item) {
    return input.observationReady
      ? CLI_SHELL_HEARTBEAT_COPY.observationReady
      : CLI_SHELL_HEARTBEAT_COPY.observationPending;
  }

  const fallbackText = latest.item.text?.trim() || `${input.shellName} 已连接`;
  switch (latest.part.partType) {
    case "thinking":
    case "text":
    case "compact":
      return normalizeStatusText(summarizeTextLikePart(latest.part.payload, fallbackText));
    case "tool_call":
      return summarizeToolPart(latest.part.payload, false);
    case "tool_result":
      return summarizeToolPart(latest.part.payload, true);
    default:
      return normalizeStatusText(fallbackText);
  }
};

export const resolveCliShellToolbarStatusIcon = (status: CliShellToolbarStatusKind): string => STATUS_ICONS[status];

const clipHeartbeatPreview = (text: string, limit = 64): string => {
  const normalized = normalizeStatusText(text);
  if (normalized.length <= limit) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(1, limit - 1))}…`;
};

export const formatCliShellHeartbeatStatus = (input: {
  groups: readonly HeartbeatGroupItem[];
  shellName: string;
  connected: boolean;
  observationReady?: boolean;
}): string => {
  const status = resolveCliShellToolbarStatus(input.groups);
  const icon = resolveCliShellToolbarStatusIcon(status);
  const summary = clipHeartbeatPreview(summarizeCliShellHeartbeat(input));
  return normalizeStatusText(`${icon} ${summary}`);
};

export const readCliShellHeartbeatStatus = async (input: {
  store: CliShellHeartbeatStatusStore;
  runtimeSessionId: string;
  shellName: string;
}): Promise<string> => {
  try {
    const autoLogin = await input.store.autoLogin();
    if (!autoLogin.ok) {
      return formatCliShellHeartbeatStatus({
        groups: [],
        shellName: input.shellName,
        connected: false,
      });
    }
    input.store.setAuthToken(autoLogin.session.token);
    await input.store.hydrateSessionArtifacts(input.runtimeSessionId, {
      includeChatHistory: false,
      observabilityMode: "heartbeat",
    });
    const state = input.store.getState();
    return formatCliShellHeartbeatStatus({
      groups: state.heartbeatGroupsBySession[input.runtimeSessionId]?.data ?? [],
      shellName: input.shellName,
      connected: true,
      observationReady: true,
    });
  } catch {
    return formatCliShellHeartbeatStatus({
      groups: [],
      shellName: input.shellName,
      connected: false,
    });
  }
};
