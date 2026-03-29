import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef } from "react";

import { MarkdownDocument } from "../../components/markdown/MarkdownDocument";
import { ScrollViewport } from "../../components/ui/overflow-surface";
import { ToolInvocationCard } from "../../components/ui/tool-invocation-card";
import { cn } from "../../lib/utils";
import { observeElementOffsetWithCleanup } from "../../lib/virtualizer";
import type { CycleModelCallTranscriptMessageRow, CycleModelCallTranscriptRow } from "./cycle-modelcall-workbench";

const MESSAGE_ROW_ESTIMATE = 136;
const TOOL_ROW_ESTIMATE = 224;
const ROW_OVERSCAN = 8;

const timestampFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});

const resolveMessageChrome = (
  presentation: CycleModelCallTranscriptMessageRow["presentation"],
): {
  bubbleClassName: string;
  metaClassName: string;
  markdownSurface: "bubble-user" | "bubble-assistant" | "bubble-self-talk";
} => {
  if (presentation === "input") {
    return {
      bubbleClassName: "bg-slate-900 text-white shadow-xs",
      metaClassName: "text-white/72",
      markdownSurface: "bubble-user",
    };
  }

  if (presentation === "technical") {
    return {
      bubbleClassName: "bg-slate-100 text-slate-700 ring-1 ring-slate-200/90",
      metaClassName: "text-slate-500",
      markdownSurface: "bubble-self-talk",
    };
  }

  return {
    bubbleClassName: "bg-white text-slate-900 ring-1 ring-slate-200/90 shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
    metaClassName: "text-slate-500",
    markdownSurface: "bubble-assistant",
  };
};

const TranscriptMessageBubble = ({ row }: { row: CycleModelCallTranscriptMessageRow }) => {
  const chrome = resolveMessageChrome(row.presentation);
  const label = row.label.trim();
  const role = row.role.trim();
  const showLabel = label.length > 0 && label !== role;

  return (
    <div
      className={cn("flex w-full py-1.5", row.lane === "input" ? "justify-end" : "justify-start")}
      data-cycle-transcript-row=""
      data-cycle-transcript-kind="message"
      data-cycle-transcript-lane={row.lane}
      data-cycle-transcript-presentation={row.presentation}
    >
      <article className={cn("w-full max-w-[min(100%,44rem)] min-w-0 rounded-2xl px-3 py-2.5", chrome.bubbleClassName)}>
        <div className={cn("mb-1 flex flex-wrap items-center gap-2 text-[11px]", chrome.metaClassName)}>
          <span className="font-medium">{role}</span>
          {showLabel ? <span>{label}</span> : null}
          {row.timestamp ? <span>{timestampFormatter.format(new Date(row.timestamp))}</span> : null}
        </div>
        <MarkdownDocument
          value={row.content}
          mode="preview"
          usage="chat"
          surface={chrome.markdownSurface}
          syntaxTone="accented"
          className="text-[13px] text-current"
        />
      </article>
    </div>
  );
};

const TranscriptToolRow = ({ row }: { row: Extract<CycleModelCallTranscriptRow, { type: "tool" }> }) => {
  return (
    <div
      className="flex w-full justify-start py-1.5"
      data-cycle-transcript-row=""
      data-cycle-transcript-kind="tool"
      data-cycle-transcript-lane={row.lane}
    >
      <div className="w-full max-w-[min(100%,44rem)]">
        <div className="mb-1 flex flex-wrap items-center gap-2 px-1 text-[11px] text-slate-500">
          <span className="font-medium">{row.label}</span>
          {row.timestamp ? <span>{timestampFormatter.format(new Date(row.timestamp))}</span> : null}
        </div>
        <ToolInvocationCard invocation={row.invocation} className="bg-white" />
      </div>
    </div>
  );
};

interface CycleModelCallTranscriptProps {
  rows: readonly CycleModelCallTranscriptRow[];
  emptyMessage: string;
}

export const CycleModelCallTranscript = ({ rows, emptyMessage }: CycleModelCallTranscriptProps) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => viewportRef.current,
    observeElementOffset: observeElementOffsetWithCleanup,
    estimateSize: (index) => (rows[index]?.type === "tool" ? TOOL_ROW_ESTIMATE : MESSAGE_ROW_ESTIMATE),
    overscan: ROW_OVERSCAN,
    initialRect: {
      width: 0,
      height: MESSAGE_ROW_ESTIMATE * 5,
    },
  });

  return (
    <ScrollViewport
      ref={viewportRef}
      className="h-full px-3 py-3"
      role="log"
      aria-label="Model conversation transcript"
      data-testid="cycle-modelcall-transcript"
      data-cycle-transcript-virtualized="true"
    >
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-6 text-sm text-slate-500">
          {emptyMessage}
        </div>
      ) : (
        <div
          className="relative"
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const row = rows[virtualRow.index];
            if (!row) {
              return null;
            }
            return (
              <div
                key={row.key}
                data-index={virtualRow.index}
                ref={(node) => {
                  if (node) {
                    rowVirtualizer.measureElement(node);
                  }
                }}
                className="absolute top-0 left-0 w-full"
                style={{
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {row.type === "tool" ? <TranscriptToolRow row={row} /> : <TranscriptMessageBubble row={row} />}
              </div>
            );
          })}
        </div>
      )}
    </ScrollViewport>
  );
};
