import type { TerminalActivityItem } from "@agenter/client-sdk";
import { MessageSquareText, Wrench } from "lucide-react";
import type { ReactNode } from "react";

import { MarkdownDocument } from "../../components/markdown/MarkdownDocument";
import { Badge } from "../../components/ui/badge";
import { ToolInvocationCard, type ToolInvocationView } from "../../components/ui/tool-invocation-card";
import { AssistantMarkdown } from "../chat/AssistantMarkdown";
import { parseToolPayload } from "../chat/tool-payload";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readString = (value: Record<string, unknown>, key: string): string | undefined => {
  const candidate = value[key];
  return typeof candidate === "string" ? candidate : undefined;
};

const parseTimestampMs = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const toStatus = (value: unknown, ok: unknown): ToolInvocationView["status"] => {
  if (value === "waiting" || value === "running" || value === "success" || value === "failed" || value === "cancelled") {
    return value;
  }
  if (ok === true) {
    return "success";
  }
  if (ok === false) {
    return "failed";
  }
  return "waiting";
};

const toPayload = (value: unknown): ToolInvocationView["call"] => {
  if (value === undefined) {
    return undefined;
  }
  return {
    value,
    ...(typeof value === "string" ? { rawText: value } : {}),
  };
};

const parseJsonLoose = (value: string): unknown => {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const toInvocationFromTerminalIo = (item: TerminalActivityItem): ToolInvocationView | null => {
  if (item.kind !== "terminal_read" && item.kind !== "terminal_write") {
    return null;
  }
  if (item.kind === "terminal_read") {
    return {
      invocationId: `terminal-activity-${item.id}`,
      toolName: "terminal_read",
      status: "success",
      startedAt: item.createdAt,
      finishedAt: item.createdAt,
      result: {
        value: parseJsonLoose(item.content),
        rawText: item.content,
      },
    };
  }
  return {
    invocationId: `terminal-activity-${item.id}`,
    toolName: "terminal_write",
    status: "success",
    startedAt: item.createdAt,
    finishedAt: item.createdAt,
    call: {
      value: item.content,
      rawText: item.content,
    },
    result: item.detail
      ? {
          value: item.detail,
        }
      : undefined,
  };
};

const hasToolLikeTitle = (title: string): boolean => /tool[\s_-]?(call|result)/i.test(title);

const shouldUseLegacyToolFallback = (item: TerminalActivityItem): boolean =>
  (item.kind === "message" && item.channel === "tool") || hasToolLikeTitle(item.title);

const toInvocationFromLegacyToolContent = (item: TerminalActivityItem): ToolInvocationView | null => {
  if (!shouldUseLegacyToolFallback(item)) {
    return null;
  }
  const parsed = parseToolPayload(item.content, item.title);
  if (!isRecord(parsed.data)) {
    return null;
  }
  const payload = parsed.data;
  const hasToolFields =
    "tool" in payload ||
    "invocationId" in payload ||
    "status" in payload ||
    "call" in payload ||
    "result" in payload ||
    "input" in payload ||
    "output" in payload ||
    "error" in payload;
  if (!hasToolFields) {
    return null;
  }
  const callValue = "call" in payload ? payload.call : "input" in payload ? payload.input : undefined;
  const resultValue = "result" in payload ? payload.result : "output" in payload ? payload.output : undefined;
  const startedAt = parseTimestampMs(payload.startedAt) ?? parseTimestampMs(payload.timestamp) ?? item.createdAt;
  const finishedAt = parseTimestampMs(payload.finishedAt);
  return {
    invocationId: readString(payload, "invocationId") ?? `terminal-activity-${item.id}`,
    toolName: parsed.toolName,
    status: toStatus(payload.status, payload.ok),
    startedAt,
    finishedAt,
    call: toPayload(callValue),
    result: toPayload(resultValue),
    error: readString(payload, "error"),
  };
};

export const toInvocationFromActivity = (item: TerminalActivityItem): ToolInvocationView | null => {
  const ioInvocation = toInvocationFromTerminalIo(item);
  if (ioInvocation) {
    return ioInvocation;
  }
  if (item.kind === "message" && item.channel === "tool" && item.tool) {
    return {
      invocationId: item.tool.invocationId,
      toolName: item.tool.name,
      status: item.tool.status,
      startedAt: item.tool.startedAt,
      finishedAt: item.tool.finishedAt,
      call: item.tool.call
        ? {
            value: item.tool.call.value,
            rawText: item.tool.call.rawText,
          }
        : undefined,
      result: item.tool.result
        ? {
            value: item.tool.result.value,
            rawText: item.tool.result.rawText,
          }
        : undefined,
      error: item.tool.error,
    };
  }
  if (!shouldUseLegacyToolFallback(item)) {
    return null;
  }
  return toInvocationFromLegacyToolContent(item);
};

export const renderTerminalActivityBody = (item: TerminalActivityItem): ReactNode => {
  if (item.kind === "message") {
    return (
      <AssistantMarkdown
        content={item.content}
        channel={item.channel === "user_input" ? undefined : item.channel}
        tool={item.tool}
      />
    );
  }
  const fenced = ["```text", item.content, "```"].join("\n");
  return (
    <MarkdownDocument
      value={fenced}
      mode="preview"
      usage="inspector"
      surface="muted"
      syntaxTone="accented"
      density="compact"
      padding="compact"
    />
  );
};

export const renderTerminalActivityFallbackCard = (item: TerminalActivityItem) => (
  <article className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
    <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
      {item.kind === "message" ? <MessageSquareText className="h-3.5 w-3.5" /> : <Wrench className="h-3.5 w-3.5" />}
      <span>{item.title}</span>
      <Badge variant="secondary">{item.kind}</Badge>
      {item.cycleId ? <Badge variant="secondary">cycle {item.cycleId}</Badge> : null}
    </div>
    {renderTerminalActivityBody(item)}
  </article>
);

export const renderTerminalActivityCard = (item: TerminalActivityItem) => {
  const invocation = toInvocationFromActivity(item);
  if (invocation) {
    return <ToolInvocationCard invocation={invocation} className="bg-white" />;
  }
  return renderTerminalActivityFallbackCard(item);
};
