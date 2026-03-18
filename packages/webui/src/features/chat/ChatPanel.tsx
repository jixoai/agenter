import type { RuntimeChatCycle, RuntimeChatMessage, RuntimeSnapshot } from "@agenter/client-sdk";
import { useVirtualizer } from "@tanstack/react-virtual";
import { AlertTriangle, Circle, CircleDashed, LoaderCircle, Minimize2, Sparkles, Workflow } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { MarkdownDocument } from "../../components/markdown/MarkdownDocument";
import { Badge, BadgeLabel, BadgeLeadingVisual } from "../../components/ui/badge";
import { Dialog } from "../../components/ui/dialog";
import { cn } from "../../lib/utils";
import { AIInput, type AIInputSubmitPayload, type AIInputSuggestion } from "./AIInput";
import { AssistantMarkdown } from "./AssistantMarkdown";
import { resolveChatMessagePresentation } from "./chat-contract";
import { splitCycleInputs, summarizeSystemFacts } from "./cycle-facts";
import { resolveVisibleCycleState, type VisibleCycleEntry } from "./cycle-visibility";
import { buildToolMeta, parseToolPayload } from "./tool-payload";

interface ChatPanelProps {
  activeSessionName: string | null;
  workspacePath?: string | null;
  cycles: RuntimeChatCycle[];
  aiStatus: string;
  loopPhase?: RuntimeSnapshot["runtimes"][string]["loopPhase"] | null;
  noTerminalHint?: string | null;
  disabled: boolean;
  imageEnabled?: boolean;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  onSubmit: (payload: AIInputSubmitPayload) => Promise<void>;
  onSearchPaths?: (input: { cwd: string; query: string; limit?: number }) => Promise<AIInputSuggestion[]>;
}

type ChatRow =
  | {
      key: string;
      type: "message";
      message: RuntimeChatMessage;
    }
  | {
      key: string;
      type: "tool";
      status: "calling" | "done" | "failed";
      toolName: string;
      meta?: string | null;
      callContent?: string;
      resultContent?: string;
    };

type ChatRowAlignment = "start" | "end";

const BOTTOM_GAP = 24;
const LOAD_MORE_GAP = 160;
const CYCLE_ESTIMATE = 276;
const INLINE_CYCLE_LIMIT = 24;
const RAIL_BUTTON_SIZE = 24;
const RAIL_AUTOSCROLL_BLOCK_MS = 420;

const equalStringArrays = (left: readonly string[], right: readonly string[]): boolean => {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((value, index) => value === right[index]);
};

const parseToolName = (message: RuntimeChatMessage): string => {
  if (message.tool?.name) {
    return message.tool.name.trim();
  }
  const match = message.content.match(/tool:\s*([^\n]+)/i);
  return match?.[1]?.trim() || "tool";
};

const cycleLabel = (cycle: RuntimeChatCycle, fallbackNumber: number): string =>
  cycle.cycleId !== null ? `cycle #${cycle.cycleId}` : `pending cycle #${fallbackNumber}`;

const cycleTitle = (cycle: RuntimeChatCycle, fallbackNumber: number): string => cycleLabel(cycle, fallbackNumber);

const attachmentEquals = (
  left: NonNullable<RuntimeChatMessage["attachments"]>[number],
  right: NonNullable<RuntimeChatMessage["attachments"]>[number],
): boolean => {
  return (
    left.assetId === right.assetId &&
    left.kind === right.kind &&
    left.name === right.name &&
    left.mimeType === right.mimeType &&
    left.sizeBytes === right.sizeBytes &&
    left.url === right.url
  );
};

const attachmentsEqual = (
  left: RuntimeChatMessage["attachments"],
  right: RuntimeChatMessage["attachments"],
): boolean => {
  if (left === right) {
    return true;
  }
  const leftItems = left ?? [];
  const rightItems = right ?? [];
  if (leftItems.length !== rightItems.length) {
    return false;
  }
  return leftItems.every((attachment, index) => attachmentEquals(attachment, rightItems[index]!));
};

const runtimeChatMessageEqual = (left: RuntimeChatMessage, right: RuntimeChatMessage): boolean => {
  return (
    left.id === right.id &&
    left.role === right.role &&
    left.channel === right.channel &&
    left.content === right.content &&
    left.timestamp === right.timestamp &&
    left.tool?.name === right.tool?.name &&
    left.tool?.ok === right.tool?.ok &&
    attachmentsEqual(left.attachments, right.attachments)
  );
};

const buildChatRows = (messages: RuntimeChatMessage[]): ChatRow[] => {
  const normalized = messages.filter(
    (message) =>
      message.channel !== "self_talk" && (message.content.trim().length > 0 || (message.attachments?.length ?? 0) > 0),
  );

  const rows: ChatRow[] = [];
  for (let index = 0; index < normalized.length; index += 1) {
    const current = normalized[index];
    if (!current) {
      continue;
    }

    if (current.role === "assistant" && current.channel === "tool_call") {
      const currentPayload = parseToolPayload(current.content, current.tool?.name);
      const toolName = currentPayload.toolName;
      const next = normalized[index + 1];
      if (next && next.role === "assistant" && next.channel === "tool_result" && parseToolName(next) === toolName) {
        const nextPayload = parseToolPayload(next.content, next.tool?.name);
        rows.push({
          key: `tool-${current.id}-${next.id}`,
          type: "tool",
          toolName,
          meta: buildToolMeta(nextPayload) ?? buildToolMeta(currentPayload),
          status: next.tool?.ok === false ? "failed" : "done",
          callContent: currentPayload.body,
          resultContent: nextPayload.body,
        });
        index += 1;
        continue;
      }
      rows.push({
        key: `tool-${current.id}`,
        type: "tool",
        toolName,
        meta: buildToolMeta(currentPayload),
        status: "calling",
        callContent: currentPayload.body,
      });
      continue;
    }

    if (current.role === "assistant" && current.channel === "tool_result") {
      const currentPayload = parseToolPayload(current.content, current.tool?.name);
      rows.push({
        key: `tool-${current.id}`,
        type: "tool",
        toolName: currentPayload.toolName,
        meta: buildToolMeta(currentPayload),
        status: current.tool?.ok === false ? "failed" : "done",
        resultContent: currentPayload.body,
      });
      continue;
    }

    rows.push({ key: current.id, type: "message", message: current });
  }

  return rows;
};

const cycleStatusMeta = (
  cycle: RuntimeChatCycle,
  loopPhase?: RuntimeSnapshot["runtimes"][string]["loopPhase"] | null,
): {
  icon: typeof Circle;
  label: string;
  tone: string;
  description: string;
  animate?: boolean;
} => {
  switch (cycle.status) {
    case "pending":
      return {
        icon: CircleDashed,
        label: "queued",
        tone: "text-slate-500 bg-slate-100",
        description: "Waiting to collect this cycle.",
      };
    case "collecting":
      if (loopPhase === "calling_model") {
        return {
          icon: LoaderCircle,
          label: "wait model",
          tone: "text-sky-700 bg-sky-100",
          description: "Collected facts. Waiting for model output.",
          animate: true,
        };
      }
      if (loopPhase === "persisting_cycle") {
        return {
          icon: LoaderCircle,
          label: "record",
          tone: "text-indigo-700 bg-indigo-100",
          description: "Collected facts. Recording this cycle.",
          animate: true,
        };
      }
      return {
        icon: LoaderCircle,
        label: "collect",
        tone: "text-amber-700 bg-amber-100",
        description: "Collecting facts for this cycle.",
        animate: true,
      };
    case "streaming":
      return {
        icon: Sparkles,
        label: "stream",
        tone: "text-teal-700 bg-teal-100",
        description: "Streaming assistant output.",
        animate: true,
      };
    case "applying":
      return {
        icon: Workflow,
        label: "apply",
        tone: "text-blue-700 bg-blue-100",
        description: "Applying tool and message outputs.",
      };
    case "error":
      return {
        icon: AlertTriangle,
        label: "error",
        tone: "text-rose-700 bg-rose-100",
        description: "This cycle ended with an error.",
      };
    default:
      return {
        icon: Circle,
        label: "done",
        tone: "text-emerald-700 bg-emerald-100",
        description: "This cycle is complete.",
      };
  }
};

const AttachmentStrip = memo(
  ({
    attachments,
    onPreview,
  }: {
    attachments: NonNullable<RuntimeChatMessage["attachments"]>;
    onPreview: (assetId: string) => void;
  }) => (
    <div className="flex flex-wrap gap-2">
      {attachments.map((attachment) => (
        <button
          key={attachment.assetId}
          type="button"
          onClick={() => onPreview(attachment.assetId)}
          className="overflow-hidden rounded-xl bg-slate-100"
          title={attachment.name}
        >
          <img src={attachment.url} alt={attachment.name} className="h-20 w-20 object-cover" loading="lazy" />
        </button>
      ))}
    </div>
  ),
);
AttachmentStrip.displayName = "AttachmentStrip";

const rowShellClassName = "w-fit max-w-[92%] md:max-w-[44rem]";

const ChatMessageRow = memo(
  ({
    message,
    onPreviewAttachment,
  }: {
    message: RuntimeChatMessage;
    onPreviewAttachment: (assetId: string) => void;
  }) => {
    const alignment: ChatRowAlignment = message.role === "user" ? "end" : "start";
    const justifyClassName = alignment === "end" ? "justify-end" : "justify-start";
    const presentation = resolveChatMessagePresentation({
      role: message.role,
      channel: message.channel,
    });
    const attachments = message.attachments ?? [];
    const hasText = message.content.trim().length > 0;

    return (
      <div
        role="listitem"
        data-chat-row="message"
        data-chat-align={alignment}
        data-chat-role={message.role}
        data-chat-channel={message.channel ?? ""}
        className={cn("flex w-full px-1 py-1", justifyClassName)}
      >
        <article className={cn(rowShellClassName, "rounded-2xl px-3 py-2 text-[13px]", presentation.bubbleClassName)}>
          <div className="space-y-2">
            {attachments.length > 0 ? (
              <AttachmentStrip attachments={attachments} onPreview={onPreviewAttachment} />
            ) : null}
            {hasText ? (
              message.role === "assistant" ? (
                <AssistantMarkdown content={message.content} channel={message.channel} tool={message.tool} />
              ) : (
                <MarkdownDocument
                  value={message.content}
                  mode="preview"
                  usage="chat"
                  surface={presentation.markdownSurface}
                  syntaxTone={presentation.syntaxTone}
                  className="text-[13px] text-current"
                />
              )
            ) : null}
          </div>
        </article>
      </div>
    );
  },
  (left, right) =>
    left.onPreviewAttachment === right.onPreviewAttachment && runtimeChatMessageEqual(left.message, right.message),
);
ChatMessageRow.displayName = "ChatMessageRow";

const ChatToolRow = memo(
  ({ row }: { row: Extract<ChatRow, { type: "tool" }> }) => (
    <div role="listitem" data-chat-row="tool" data-chat-align="start" className="flex w-full justify-start px-1 py-1">
      <article className={cn(rowShellClassName, "rounded-2xl bg-white/90 px-2.5 py-1.5 text-[13px]")}>
        <AssistantMarkdown
          content=""
          toolTrace={{
            id: row.key,
            toolName: row.toolName,
            status: row.status,
            meta: row.meta,
            callContent: row.callContent,
            resultContent: row.resultContent,
          }}
        />
      </article>
    </div>
  ),
  (left, right) =>
    left.row.key === right.row.key &&
    left.row.toolName === right.row.toolName &&
    left.row.status === right.row.status &&
    left.row.meta === right.row.meta &&
    left.row.callContent === right.row.callContent &&
    left.row.resultContent === right.row.resultContent,
);
ChatToolRow.displayName = "ChatToolRow";

const CycleCollectedFacts = memo(({ cycle }: { cycle: RuntimeChatCycle }) => {
  const { systemFacts } = splitCycleInputs(cycle);
  if (systemFacts.length === 0) {
    return null;
  }

  return (
    <details className="rounded-2xl bg-slate-100/80 px-3 py-2 text-[11px] text-slate-600">
      <summary className="flex cursor-pointer list-none items-center gap-2">
        <span className="font-medium text-slate-700">Collected facts</span>
        <span className="truncate text-slate-500">{summarizeSystemFacts(systemFacts)}</span>
      </summary>
      <div className="mt-2 space-y-2">
        {systemFacts.map((fact) => (
          <section key={fact.key} className="space-y-1 rounded-xl bg-white/90 px-2.5 py-2">
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
              <span className="font-medium tracking-[0.16em] text-slate-400 uppercase">{fact.source}</span>
              <span className="text-slate-700">{fact.title}</span>
              <span>{fact.summary}</span>
            </div>
            {fact.detail.trim().length > 0 ? (
              <MarkdownDocument
                value={fact.detail}
                mode="raw"
                usage="chat"
                surface="muted"
                syntaxTone="accented"
                density="compact"
                padding="compact"
                maxHeight={220}
                className="text-[12px] text-slate-600"
              />
            ) : null}
          </section>
        ))}
      </div>
    </details>
  );
});
CycleCollectedFacts.displayName = "CycleCollectedFacts";

const CycleUserInputs = memo(
  ({ cycle, onPreviewAttachment }: { cycle: RuntimeChatCycle; onPreviewAttachment: (assetId: string) => void }) => {
    const { userInputs } = splitCycleInputs(cycle);
    if (userInputs.length === 0) {
      return null;
    }

    return (
      <div className="space-y-1">
        {userInputs.map((input, index) => {
          const text = input.parts
            .filter((part): part is Extract<(typeof input.parts)[number], { type: "text" }> => part.type === "text")
            .map((part) => part.text)
            .join("\n");
          const attachments = input.parts
            .filter((part): part is Extract<(typeof input.parts)[number], { type: "image" }> => part.type === "image")
            .map((part) => ({
              assetId: part.assetId,
              kind: "image" as const,
              name: part.name,
              mimeType: part.mimeType,
              sizeBytes: part.sizeBytes,
              url: part.url,
            }));

          return (
            <ChatMessageRow
              key={`${cycle.id}:user:${index}`}
              message={{
                id: `${cycle.id}:user:${index}`,
                role: "user",
                channel: undefined,
                content: text,
                timestamp: cycle.createdAt,
                attachments,
              }}
              onPreviewAttachment={onPreviewAttachment}
            />
          );
        })}
      </div>
    );
  },
);
CycleUserInputs.displayName = "CycleUserInputs";

const CycleCard = memo(
  ({
    cycle,
    cycleFallbackNumber,
    loopPhase,
    onPreviewAttachment,
  }: {
    cycle: RuntimeChatCycle;
    cycleFallbackNumber: number;
    loopPhase?: RuntimeSnapshot["runtimes"][string]["loopPhase"] | null;
    onPreviewAttachment: (assetId: string) => void;
  }) => {
    const rows = useMemo(
      () => buildChatRows([...cycle.outputs, ...cycle.liveMessages]),
      [cycle.liveMessages, cycle.outputs],
    );
    const status = cycleStatusMeta(cycle, loopPhase);
    const StatusIcon = status.icon;
    const liveDraft = cycle.streaming?.content.trim() ?? "";

    return (
      <article
        data-cycle-status={cycle.status}
        className="rounded-[1.35rem] bg-[color-mix(in_srgb,white,transparent_8%)] px-3 py-3 ring-1 ring-slate-200/70"
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              title={cycleTitle(cycle, cycleFallbackNumber)}
              variant="secondary"
              className="rounded-full text-[11px] font-medium text-slate-700"
            >
              <BadgeLeadingVisual>
                <StatusIcon className={cn("h-3.5 w-3.5", cycle.status === "streaming" ? "animate-pulse" : "")} />
              </BadgeLeadingVisual>
              <BadgeLabel>{cycleLabel(cycle, cycleFallbackNumber)}</BadgeLabel>
            </Badge>
            <Badge variant="secondary" className="rounded-full text-[11px] text-slate-600">
              {cycle.kind}
            </Badge>
            {cycle.wakeSource ? (
              <Badge variant="secondary" className="rounded-full text-[11px] text-slate-600">
                {cycle.wakeSource}
              </Badge>
            ) : null}
          </div>
          <Badge className={cn("rounded-full text-[11px] font-medium", status.tone)}>
            <BadgeLeadingVisual>
              <StatusIcon className={cn("h-3.5 w-3.5", status.animate ? "animate-spin" : "")} />
            </BadgeLeadingVisual>
            <BadgeLabel>{status.label}</BadgeLabel>
          </Badge>
        </div>

        <div className="space-y-2.5">
          <CycleUserInputs cycle={cycle} onPreviewAttachment={onPreviewAttachment} />
          <CycleCollectedFacts cycle={cycle} />
          {liveDraft.length > 0 ? (
            <ChatMessageRow
              message={{
                id: `${cycle.id}:draft`,
                role: "assistant",
                channel: "to_user",
                content: liveDraft,
                timestamp: cycle.createdAt,
              }}
              onPreviewAttachment={onPreviewAttachment}
            />
          ) : null}
          {rows.length === 0 && cycle.status !== "done" && cycle.status !== "error" ? (
            <div className="rounded-2xl bg-slate-100 px-3 py-3 text-sm text-slate-500">{status.description}</div>
          ) : null}
          {rows.length > 0 ? (
            <div role="list" aria-label={`cycle-${cycle.id}-outputs`} className="space-y-1">
              {rows.map((row) =>
                row.type === "tool" ? (
                  <ChatToolRow key={row.key} row={row} />
                ) : (
                  <ChatMessageRow key={row.key} message={row.message} onPreviewAttachment={onPreviewAttachment} />
                ),
              )}
            </div>
          ) : null}
        </div>
      </article>
    );
  },
);
CycleCard.displayName = "CycleCard";

const VirtualCycleCard = memo(
  ({
    cycle,
    cycleFallbackNumber,
    virtualIndex,
    virtualStart,
    measureElement,
    registerCycleElement,
    loopPhase,
    onPreviewAttachment,
  }: {
    cycle: RuntimeChatCycle;
    cycleFallbackNumber: number;
    virtualIndex: number;
    virtualStart: number;
    measureElement: (node: Element | null | undefined) => void;
    registerCycleElement: (cycleId: string) => (node: HTMLDivElement | null) => void;
    loopPhase?: RuntimeSnapshot["runtimes"][string]["loopPhase"] | null;
    onPreviewAttachment: (assetId: string) => void;
  }) => {
    const bindRef = useMemo(() => registerCycleElement(cycle.id), [registerCycleElement, cycle.id]);
    const rowRef = useCallback(
      (node: HTMLDivElement | null) => {
        measureElement(node);
        bindRef(node);
      },
      [bindRef, measureElement],
    );

    return (
      <div
        data-chat-cycle={cycle.id}
        data-index={virtualIndex}
        data-cycle-number={cycleFallbackNumber}
        ref={rowRef}
        className="absolute top-0 left-0 w-full px-1 py-1"
        style={{ transform: `translateY(${virtualStart}px)` }}
      >
        <CycleCard
          cycle={cycle}
          cycleFallbackNumber={cycleFallbackNumber}
          loopPhase={loopPhase}
          onPreviewAttachment={onPreviewAttachment}
        />
      </div>
    );
  },
);
VirtualCycleCard.displayName = "VirtualCycleCard";

const InlineCycleCard = memo(
  ({
    cycle,
    cycleFallbackNumber,
    registerCycleElement,
    loopPhase,
    onPreviewAttachment,
  }: {
    cycle: RuntimeChatCycle;
    cycleFallbackNumber: number;
    registerCycleElement: (cycleId: string) => (node: HTMLDivElement | null) => void;
    loopPhase?: RuntimeSnapshot["runtimes"][string]["loopPhase"] | null;
    onPreviewAttachment: (assetId: string) => void;
  }) => {
    const bindRef = useMemo(() => registerCycleElement(cycle.id), [registerCycleElement, cycle.id]);

    return (
      <div data-chat-cycle={cycle.id} data-cycle-number={cycleFallbackNumber} ref={bindRef}>
        <CycleCard
          cycle={cycle}
          cycleFallbackNumber={cycleFallbackNumber}
          loopPhase={loopPhase}
          onPreviewAttachment={onPreviewAttachment}
        />
      </div>
    );
  },
);
InlineCycleCard.displayName = "InlineCycleCard";

const ChatStatusIndicator = ({ aiStatus }: { aiStatus: string }) => {
  if (aiStatus === "idle") {
    return null;
  }

  return (
    <div data-chat-status="live" className="mt-2 flex justify-start px-1">
      <Badge variant="secondary" className="rounded-xl text-xs text-slate-600">
        <BadgeLeadingVisual>
          <Sparkles className="h-3.5 w-3.5 animate-pulse text-teal-700" />
        </BadgeLeadingVisual>
        <BadgeLabel>{`AI ${aiStatus}`}</BadgeLabel>
      </Badge>
    </div>
  );
};

const CycleRail = ({
  cycles,
  cycleFallbackNumbers,
  visibleCycleIds,
  anchorCycleId,
  onSelect,
}: {
  cycles: RuntimeChatCycle[];
  cycleFallbackNumbers: ReadonlyMap<string, number>;
  visibleCycleIds: readonly string[];
  anchorCycleId: string | null;
  onSelect: (index: number) => void;
}) => {
  const visibleCycleSet = useMemo(() => new Set(visibleCycleIds), [visibleCycleIds]);
  const railItemRefs = useRef(new Map<string, HTMLDivElement>());
  const railAutoScrollBlockedUntilRef = useRef(0);

  const setRailItemRef = useCallback(
    (cycleId: string) => (node: HTMLDivElement | null) => {
      if (!node) {
        railItemRefs.current.delete(cycleId);
        return;
      }
      railItemRefs.current.set(cycleId, node);
    },
    [],
  );

  const blockRailAutoScroll = useCallback(() => {
    railAutoScrollBlockedUntilRef.current = Date.now() + RAIL_AUTOSCROLL_BLOCK_MS;
  }, []);

  useEffect(() => {
    if (!anchorCycleId) {
      return;
    }
    if (Date.now() < railAutoScrollBlockedUntilRef.current) {
      return;
    }
    const target = railItemRefs.current.get(anchorCycleId);
    if (!target) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      target.scrollIntoView({
        block: "center",
        inline: "nearest",
        behavior: "auto",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [anchorCycleId]);

  return (
    <div className="flex h-full w-11 shrink-0 justify-center">
      <div
        data-cycle-rail=""
        className="scrollbar-none scrollbar-track-transparent scrollbar-thumb-[color-mix(in_srgb,currentColor,transparent)] flex h-full w-full snap-y snap-mandatory flex-col overflow-y-auto rounded-full bg-slate-100/80 px-1"
        onWheel={blockRailAutoScroll}
        onPointerDown={blockRailAutoScroll}
        onTouchStart={blockRailAutoScroll}
      >
        <div aria-hidden="true" className="shrink-0" style={{ height: `calc(50% - ${RAIL_BUTTON_SIZE / 2}px)` }} />
        {cycles.map((cycle, index) => {
          const status = cycleStatusMeta(cycle);
          const isVisible = visibleCycleSet.has(cycle.id);
          const isAnchor = cycle.id === anchorCycleId;
          const itemCycleFallbackNumber = cycleFallbackNumbers.get(cycle.id) ?? index + 1;
          return (
            <div
              key={cycle.id}
              ref={setRailItemRef(cycle.id)}
              data-visible={isVisible ? "true" : "false"}
              data-anchor={isAnchor ? "true" : "false"}
              className="flex snap-center justify-center py-1"
            >
              <button
                type="button"
                aria-label={`Jump to ${cycleLabel(cycle, itemCycleFallbackNumber)}`}
                title={cycleTitle(cycle, itemCycleFallbackNumber)}
                aria-current={isAnchor ? "step" : undefined}
                onClick={() => onSelect(index)}
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full transition",
                  isAnchor
                    ? "bg-teal-600 text-white shadow-sm ring-2 ring-teal-200"
                    : isVisible
                      ? "bg-teal-100 text-teal-700 ring-1 ring-teal-300"
                      : status.tone,
                )}
              >
                {cycle.kind === "compact" ? <Minimize2 className="h-3.5 w-3.5" /> : <Circle className="h-3 w-3" />}
              </button>
            </div>
          );
        })}
        <div aria-hidden="true" className="shrink-0" style={{ height: `calc(50% - ${RAIL_BUTTON_SIZE / 2}px)` }} />
      </div>
    </div>
  );
};

export const ChatPanel = ({
  activeSessionName,
  workspacePath,
  cycles,
  aiStatus,
  loopPhase,
  noTerminalHint,
  disabled,
  imageEnabled = false,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  onSubmit,
  onSearchPaths,
}: ChatPanelProps) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const observedCycleNodesRef = useRef(new Map<string, HTMLDivElement>());
  const visibleCyclesRef = useRef(new Map<string, VisibleCycleEntry>());
  const [stickToBottom, setStickToBottom] = useState(true);
  const [previewAssetId, setPreviewAssetId] = useState<string | null>(null);
  const [visibleCycleIds, setVisibleCycleIds] = useState<string[]>([]);
  const [railAnchorCycleId, setRailAnchorCycleId] = useState<string | null>(null);
  const loadMoreRef = useRef(false);

  const handlePreviewAttachment = useCallback((assetId: string) => {
    setPreviewAssetId(assetId);
  }, []);

  const attachmentsById = useMemo(() => {
    const entries = new Map<
      string,
      { assetId: string; name: string; mimeType: string; sizeBytes: number; url: string }
    >();
    for (const cycle of cycles) {
      for (const input of cycle.inputs) {
        for (const part of input.parts) {
          if (part.type === "image") {
            entries.set(part.assetId, part);
          }
        }
      }
      for (const message of cycle.outputs) {
        for (const attachment of message.attachments ?? []) {
          entries.set(attachment.assetId, attachment);
        }
      }
    }
    return entries;
  }, [cycles]);

  const previewAttachment = previewAssetId ? (attachmentsById.get(previewAssetId) ?? null) : null;
  const inputPlaceholder = imageEnabled
    ? "Message Agenter, use @ to reference files, or paste images..."
    : "Message Agenter and use @ to reference files...";
  const useInlineCycles = cycles.length <= INLINE_CYCLE_LIMIT;
  const latestCycleScrollKey = useMemo(() => {
    const lastCycle = cycles.at(-1);
    if (!lastCycle) {
      return "empty";
    }
    return [
      lastCycle.id,
      lastCycle.status,
      lastCycle.outputs.length,
      lastCycle.liveMessages.length,
      lastCycle.streaming?.content ?? "",
    ].join("|");
  }, [cycles]);

  const cycleVirtualizer = useVirtualizer({
    count: cycles.length,
    getScrollElement: () => viewportRef.current,
    getItemKey: (index) => cycles[index]?.id ?? index,
    estimateSize: () => CYCLE_ESTIMATE,
    overscan: 6,
    initialRect: {
      width: 0,
      height: CYCLE_ESTIMATE * 4,
    },
    enabled: !useInlineCycles,
  });
  const cycleIdsKey = useMemo(() => cycles.map((cycle) => cycle.id).join("|"), [cycles]);
  const orderedCycleIds = useMemo(() => cycles.map((cycle) => cycle.id), [cycles]);
  const cycleFallbackNumbers = useMemo(
    () => new Map(cycles.map((cycle, index) => [cycle.id, index + 1] as const)),
    [cycles],
  );

  const syncVisibleCycleState = useCallback(() => {
    const nextState = resolveVisibleCycleState(visibleCyclesRef.current.values(), orderedCycleIds);
    setVisibleCycleIds((current) =>
      equalStringArrays(current, nextState.visibleIds) ? current : nextState.visibleIds,
    );
    setRailAnchorCycleId((current) => (current === nextState.anchorId ? current : nextState.anchorId));
  }, [orderedCycleIds]);

  const registerCycleElement = useCallback(
    (cycleId: string) => (node: HTMLDivElement | null) => {
      const previous = observedCycleNodesRef.current.get(cycleId);
      if (previous && previous !== node && observerRef.current) {
        observerRef.current.unobserve(previous);
      }
      if (!node) {
        observedCycleNodesRef.current.delete(cycleId);
        if (visibleCyclesRef.current.delete(cycleId)) {
          syncVisibleCycleState();
        }
        return;
      }
      observedCycleNodesRef.current.set(cycleId, node);
      if (observerRef.current) {
        observerRef.current.observe(node);
      }
    },
    [syncVisibleCycleState],
  );

  useEffect(() => {
    const cycleIdSet = new Set(orderedCycleIds);
    setVisibleCycleIds((current) => {
      const next = current.filter((cycleId) => cycleIdSet.has(cycleId));
      return equalStringArrays(current, next) ? current : next;
    });
    setRailAnchorCycleId((current) => (current && cycleIdSet.has(current) ? current : null));
  }, [orderedCycleIds]);

  useEffect(() => {
    const root = viewportRef.current;
    if (!root) {
      return;
    }
    visibleCyclesRef.current.clear();
    setVisibleCycleIds((current) => (current.length === 0 ? current : []));
    setRailAnchorCycleId((current) => (current === null ? current : null));
    observerRef.current?.disconnect();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const cycleId = (entry.target as HTMLDivElement).dataset.chatCycle;
          if (!cycleId) {
            continue;
          }
          if (!entry.isIntersecting || entry.intersectionRatio <= 0) {
            visibleCyclesRef.current.delete(cycleId);
            continue;
          }
          const rootBounds = entry.rootBounds;
          const targetCenter = entry.boundingClientRect.top + entry.boundingClientRect.height / 2;
          const rootCenter = rootBounds ? rootBounds.top + rootBounds.height / 2 : targetCenter;
          visibleCyclesRef.current.set(cycleId, {
            id: cycleId,
            ratio: entry.intersectionRatio,
            distance: Math.abs(targetCenter - rootCenter),
          });
        }
        syncVisibleCycleState();
      },
      {
        root,
        threshold: [0, 0.2, 0.4, 0.6, 0.8, 1],
      },
    );

    observerRef.current = observer;
    for (const node of observedCycleNodesRef.current.values()) {
      observer.observe(node);
    }

    return () => {
      observer.disconnect();
      observerRef.current = null;
      visibleCyclesRef.current.clear();
    };
  }, [cycleIdsKey, syncVisibleCycleState]);

  useEffect(() => {
    loadMoreRef.current = false;
  }, [loadingMore]);

  useEffect(() => {
    if (!stickToBottom || cycles.length === 0) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      if (useInlineCycles) {
        const node = viewportRef.current;
        if (node) {
          node.scrollTop = node.scrollHeight;
        }
        return;
      }
      cycleVirtualizer.scrollToIndex(cycles.length - 1, { align: "end" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [cycles.length, cycleVirtualizer, latestCycleScrollKey, stickToBottom, useInlineCycles]);

  return (
    <section className="flex h-full flex-1 flex-col rounded-2xl bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="typo-title-3 truncate text-slate-900">
          {activeSessionName ? `Chat · ${activeSessionName}` : "Chat"}
        </h2>
        <Badge variant={aiStatus === "error" ? "destructive" : aiStatus === "idle" ? "secondary" : "warning"}>
          {aiStatus}
        </Badge>
      </div>

      {noTerminalHint ? (
        <div className="mb-2 rounded-2xl bg-amber-50 px-3 py-2 text-xs text-amber-800">{noTerminalHint}</div>
      ) : null}

      <div className="flex flex-1 gap-2 overflow-hidden rounded-[1.4rem] bg-slate-50 p-2">
        <div
          ref={viewportRef}
          className="flex-1 overflow-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="log"
          aria-live="polite"
          aria-label="Chat cycles"
          onScroll={(event) => {
            const node = event.currentTarget;
            const isBottom = node.scrollHeight - node.scrollTop - node.clientHeight < BOTTOM_GAP;
            setStickToBottom((current) => (current === isBottom ? current : isBottom));

            if (node.scrollTop <= LOAD_MORE_GAP && hasMore && !loadingMore && !loadMoreRef.current) {
              loadMoreRef.current = true;
              onLoadMore?.();
            }
          }}
        >
          {cycles.length === 0 ? (
            <p className="typo-caption px-2 py-1 text-slate-500">
              Start by asking Agenter a task or reference a workspace file with @.
            </p>
          ) : useInlineCycles ? (
            <div role="list" aria-label="Chat cycles list" className="space-y-2 px-1 py-1">
              {cycles.map((cycle) => (
                <InlineCycleCard
                  key={cycle.id}
                  cycle={cycle}
                  cycleFallbackNumber={cycleFallbackNumbers.get(cycle.id) ?? 1}
                  registerCycleElement={registerCycleElement}
                  loopPhase={loopPhase}
                  onPreviewAttachment={handlePreviewAttachment}
                />
              ))}
            </div>
          ) : (
            <div
              role="list"
              aria-label="Chat cycles list"
              style={{ height: cycleVirtualizer.getTotalSize(), position: "relative", width: "100%" }}
            >
              {cycleVirtualizer.getVirtualItems().map((virtualRow) => {
                const cycle = cycles[virtualRow.index];
                if (!cycle) {
                  return null;
                }
                return (
                  <VirtualCycleCard
                    key={cycle.id}
                    cycle={cycle}
                    cycleFallbackNumber={cycleFallbackNumbers.get(cycle.id) ?? virtualRow.index + 1}
                    virtualIndex={virtualRow.index}
                    virtualStart={virtualRow.start}
                    measureElement={cycleVirtualizer.measureElement}
                    registerCycleElement={registerCycleElement}
                    loopPhase={loopPhase}
                    onPreviewAttachment={handlePreviewAttachment}
                  />
                );
              })}
            </div>
          )}
        </div>

        {cycles.length > 0 ? (
          <CycleRail
            cycles={cycles}
            cycleFallbackNumbers={cycleFallbackNumbers}
            visibleCycleIds={visibleCycleIds}
            anchorCycleId={railAnchorCycleId}
            onSelect={(index) => {
              setStickToBottom(index >= cycles.length - 1);
              setRailAnchorCycleId(cycles[index]?.id ?? null);
              if (useInlineCycles) {
                observedCycleNodesRef.current.get(cycles[index]?.id ?? "")?.scrollIntoView({
                  block: "center",
                  behavior: "smooth",
                });
                return;
              }
              cycleVirtualizer.scrollToIndex(index, { align: "center" });
            }}
          />
        ) : null}
      </div>

      <ChatStatusIndicator aiStatus={aiStatus} />

      <div className="mt-3">
        <AIInput
          workspacePath={workspacePath}
          disabled={disabled}
          imageEnabled={imageEnabled}
          placeholder={inputPlaceholder}
          submitTitle="Send message to the current session"
          onSubmit={onSubmit}
          onSearchPaths={onSearchPaths}
        />
      </div>

      <Dialog
        open={previewAttachment !== null}
        title={previewAttachment?.name ?? "Image preview"}
        description={
          previewAttachment ? `${previewAttachment.mimeType} · ${previewAttachment.sizeBytes} bytes` : undefined
        }
        onClose={() => setPreviewAssetId(null)}
      >
        {previewAttachment ? (
          <img
            src={previewAttachment.url}
            alt={previewAttachment.name}
            className="max-h-[70dvh] w-full object-contain"
          />
        ) : null}
      </Dialog>
    </section>
  );
};
