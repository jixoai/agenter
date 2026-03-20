import type { RuntimeClientState } from "@agenter/client-sdk";
import { Circle, CircleDot, Maximize2, Minimize2, Minus, Square } from "lucide-react";
import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";

import { AsyncSurface, resolveAsyncSurfaceState } from "../../components/ui/async-surface";
import { Badge } from "../../components/ui/badge";
import { Button, ButtonLabel, ButtonLeadingVisual } from "../../components/ui/button";
import {
  InlineAffordance,
  InlineAffordanceLabel,
  InlineAffordanceLeadingVisual,
  InlineAffordanceTrailingVisual,
} from "../../components/ui/inline-affordance";
import { ClipSurface, ScrollViewport } from "../../components/ui/overflow-surface";
import { Skeleton } from "../../components/ui/skeleton";
import { cn } from "../../lib/utils";

interface TerminalPanelProps {
  runtime: RuntimeClientState["runtimes"][string] | undefined;
  snapshots: RuntimeClientState["terminalSnapshotsBySession"][string] | undefined;
  loading?: boolean;
}

export interface TerminalViewportMetrics {
  scale: number;
  width: number;
  height: number;
  scaledWidth: number;
  scaledHeight: number;
}

export type TerminalScaleMode = "fit" | "cover";

type TerminalSnapshot = NonNullable<TerminalPanelProps["snapshots"]>[string];
type TerminalRichLine = NonNullable<TerminalSnapshot["richLines"]>[number];
type TerminalRichSpan = TerminalRichLine["spans"][number];

const TITLEBAR_HEIGHT = 34;
const STATUSBAR_HEIGHT = 26;
const VIEWPORT_PADDING_X = 16;
const VIEWPORT_PADDING_Y = 14;
const CELL_WIDTH = 8.2;
const LINE_HEIGHT = 18;
const SCALE_MODE_STORAGE_KEY = "agenter:webui:terminal-scale-mode";

const statusVariant = (status: "IDLE" | "BUSY") => (status === "BUSY" ? "warning" : "secondary");

const isScaleMode = (value: string | null): value is TerminalScaleMode => value === "fit" || value === "cover";

const readScaleMode = (): TerminalScaleMode => {
  if (typeof window === "undefined") {
    return "fit";
  }
  const stored = window.localStorage.getItem(SCALE_MODE_STORAGE_KEY);
  return isScaleMode(stored) ? stored : "fit";
};

const resolveSpanTone = (span: TerminalRichSpan): { color?: string; backgroundColor?: string } => {
  if (span.inverse) {
    return {
      color: span.bg ?? "#0f172a",
      backgroundColor: span.fg ?? "#f8fafc",
    };
  }
  return {
    color: span.fg,
    backgroundColor: span.bg,
  };
};

const renderRichLine = (line: TerminalRichLine, lineIndex: number) => {
  if (line.spans.length === 0) {
    return <span className="text-transparent"> </span>;
  }

  return line.spans.map((span, spanIndex) => {
    const { color, backgroundColor } = resolveSpanTone(span);
    return (
      <span
        key={`line-${lineIndex}-span-${spanIndex}`}
        style={{
          color,
          backgroundColor,
          fontWeight: span.bold ? 700 : undefined,
          textDecoration: span.underline ? "underline" : undefined,
          textDecorationThickness: span.underline ? "1px" : undefined,
          textUnderlineOffset: span.underline ? "2px" : undefined,
        }}
      >
        {span.text.length > 0 ? span.text : " "}
      </span>
    );
  });
};

export const buildViewportMetrics = (input: {
  availableWidth: number;
  availableHeight: number;
  cols: number;
  rows: number;
  mode: TerminalScaleMode;
}): TerminalViewportMetrics => {
  const viewportWidth = input.cols * CELL_WIDTH + VIEWPORT_PADDING_X * 2;
  const viewportHeight = input.rows * LINE_HEIGHT + VIEWPORT_PADDING_Y * 2;
  const width = viewportWidth;
  const height = viewportHeight + TITLEBAR_HEIGHT + STATUSBAR_HEIGHT;
  const fitScale = Math.min(input.availableWidth / width, input.availableHeight / height, 1);
  const coverScale = Math.max(input.availableWidth / width, input.availableHeight / height, 1);
  const rawScale = input.mode === "cover" ? coverScale : fitScale;
  const scale = Number.isFinite(rawScale) && rawScale > 0 ? rawScale : 1;
  return {
    scale,
    width,
    height,
    scaledWidth: width * scale,
    scaledHeight: height * scale,
  };
};

const LoadingShell = () => (
  <div className="space-y-3">
    <div className="flex items-center justify-between gap-3">
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3 w-40" />
      </div>
      <Skeleton className="h-8 w-28 rounded-xl" />
    </div>
    <Skeleton className="h-8 w-40 rounded-xl" />
    <Skeleton className="h-full min-h-[22rem] w-full rounded-2xl" />
  </div>
);

export const TerminalPanel = ({ runtime, snapshots, loading = false }: TerminalPanelProps) => {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [scaleMode, setScaleMode] = useState<TerminalScaleMode>(() => readScaleMode());

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(SCALE_MODE_STORAGE_KEY, scaleMode);
  }, [scaleMode]);

  useEffect(() => {
    const node = stageRef.current;
    if (!node || typeof ResizeObserver === "undefined") {
      return;
    }

    const updateStageSize = (width: number, height: number) => {
      setStageSize({ width, height });
    };

    const rect = node.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      updateStageSize(rect.width, rect.height);
    }

    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect;
      if (!next) {
        return;
      }
      updateStageSize(next.width, next.height);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const hasRuntimeTerminals = Boolean(runtime && runtime.terminals.length > 0);
  const surfaceState = resolveAsyncSurfaceState({
    loading,
    hasData: hasRuntimeTerminals,
  });

  if (!runtime || runtime.terminals.length === 0) {
    return (
      <AsyncSurface
        state={surfaceState}
        skeleton={<LoadingShell />}
        empty={
          <div className="flex h-full items-center justify-center rounded-2xl bg-slate-50 px-4 text-sm text-slate-500">
            No terminal in this session.
          </div>
        }
        className="h-full"
      />
    );
  }

  const focusedTerminalId = runtime.focusedTerminalIds[0] ?? runtime.focusedTerminalId;
  const focused = runtime.terminals.find((item) => item.terminalId === focusedTerminalId) ?? runtime.terminals[0];
  const snapshot = snapshots?.[focused.terminalId];
  const rows = snapshot?.rows ?? 24;
  const cols = snapshot?.cols ?? 80;
  const metrics = buildViewportMetrics({
    availableWidth: Math.max(stageSize.width - 8, 320),
    availableHeight: Math.max(stageSize.height - 8, 200),
    cols,
    rows,
    mode: scaleMode,
  });
  const viewportStyle = {
    width: `${metrics.width}px`,
    height: `${metrics.height}px`,
    transform: `scale(${metrics.scale})`,
    transformOrigin: "top left",
  } satisfies CSSProperties;
  const scaledFrameStyle = {
    width: `${metrics.scaledWidth}px`,
    height: `${metrics.scaledHeight}px`,
  } satisfies CSSProperties;
  const terminalBodyStyle = {
    width: `${cols * CELL_WIDTH}px`,
    minWidth: `${cols * CELL_WIDTH}px`,
    height: `${rows * LINE_HEIGHT}px`,
    minHeight: `${rows * LINE_HEIGHT}px`,
    lineHeight: `${LINE_HEIGHT}px`,
    fontSize: "12px",
  } satisfies CSSProperties;
  const richLines = snapshot?.richLines ?? [];
  const hasRichLines = richLines.length > 0;

  return (
    <AsyncSurface
      state={surfaceState}
      skeleton={<LoadingShell />}
      empty={
        <div className="flex h-full items-center justify-center rounded-2xl bg-slate-50 px-4 text-sm text-slate-500">
          No terminal in this session.
        </div>
      }
      className="h-full"
      loadingOverlayLabel="Refreshing terminal..."
    >
      <section className="flex h-full flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="typo-title-3 text-slate-900">Terminal</h3>
              <Badge variant={statusVariant(focused.status)}>{focused.status}</Badge>
            </div>
            <p className="text-[11px] text-slate-500">
              seq {snapshot?.seq ?? focused.seq} · {cols} cols × {rows} rows
            </p>
          </div>

          <div className="inline-flex rounded-xl bg-slate-100 p-1">
            <Button
              type="button"
              size="sm"
              variant={scaleMode === "fit" ? "secondary" : "ghost"}
              aria-pressed={scaleMode === "fit"}
              onClick={() => setScaleMode("fit")}
              title="Fit terminal into the panel"
            >
              <ButtonLeadingVisual>
                <Minimize2 className="h-3.5 w-3.5" />
              </ButtonLeadingVisual>
              <ButtonLabel>Fit</ButtonLabel>
            </Button>
            <Button
              type="button"
              size="sm"
              variant={scaleMode === "cover" ? "secondary" : "ghost"}
              aria-pressed={scaleMode === "cover"}
              onClick={() => setScaleMode("cover")}
              title="Cover the panel and allow scrolling"
            >
              <ButtonLeadingVisual>
                <Maximize2 className="h-3.5 w-3.5" />
              </ButtonLeadingVisual>
              <ButtonLabel>Cover</ButtonLabel>
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {runtime.terminals.map((terminal) => (
            <span
              key={terminal.terminalId}
              className={cn(
                "rounded-md px-2 py-1 text-[11px]",
                terminal.terminalId === focused.terminalId ? "bg-teal-100 text-teal-900" : "bg-slate-100 text-slate-700",
              )}
            >
              {terminal.terminalId}
            </span>
          ))}
        </div>

        <ScrollViewport
          ref={stageRef}
          className={cn(
            "flex flex-1 rounded-2xl bg-slate-100 p-3",
            scaleMode === "fit" ? "items-start justify-center" : "items-start justify-start",
          )}
        >
          <div className="shrink-0" style={scaledFrameStyle}>
            <ClipSurface
              data-testid="terminal-viewport"
              className="corner-superellipse/2 rounded-[18px] border border-slate-300 bg-slate-900 shadow-[0_22px_80px_rgba(15,23,42,0.28)]"
              style={viewportStyle}
            >
              <header className="flex h-8.5 items-center justify-between border-b border-slate-700 bg-[linear-gradient(180deg,#1f2937,#111827)] px-4 text-[11px] text-slate-200">
                <div className="flex items-center gap-1.5 text-slate-400">
                  <Circle className="h-2.5 w-2.5 fill-rose-400 text-rose-400" />
                  <Circle className="h-2.5 w-2.5 fill-amber-300 text-amber-300" />
                  <Circle className="h-2.5 w-2.5 fill-emerald-400 text-emerald-400" />
                </div>
                <InlineAffordance size="inline" className="text-slate-300">
                  <InlineAffordanceLeadingVisual>
                    <Square className="h-3 w-3" />
                  </InlineAffordanceLeadingVisual>
                  <InlineAffordanceLabel className="max-w-[28ch] truncate">{focused.terminalId}</InlineAffordanceLabel>
                </InlineAffordance>
                <InlineAffordance size="inline" className="text-slate-500">
                  <InlineAffordanceLeadingVisual>
                    <Minus className="h-3 w-3" />
                  </InlineAffordanceLeadingVisual>
                  <InlineAffordanceTrailingVisual>
                    <Square className="h-2.5 w-2.5" />
                  </InlineAffordanceTrailingVisual>
                </InlineAffordance>
              </header>

              <div className="bg-slate-950 px-4 py-3">
                {hasRichLines ? (
                  <div
                    data-testid="terminal-rich-surface"
                    style={terminalBodyStyle}
                    className="font-mono whitespace-pre text-slate-100 [font-variant-ligatures:none]"
                  >
                    {richLines.map((line, lineIndex) => (
                      <div key={`line-${lineIndex}`} className="h-[18px] min-h-[18px]">
                        {renderRichLine(line, lineIndex)}
                      </div>
                    ))}
                  </div>
                ) : (
                  <pre
                    style={terminalBodyStyle}
                    className="font-mono whitespace-pre text-slate-100 [font-variant-ligatures:none]"
                  >
                    {(snapshot?.lines ?? []).join("\n")}
                  </pre>
                )}
              </div>

              <footer className="flex h-[26px] items-center justify-between gap-2 border-t border-slate-800 bg-slate-900 px-4 text-[11px] text-slate-400">
                <InlineAffordance size="inline" className="min-w-0 flex-1">
                  <InlineAffordanceLeadingVisual>
                    <CircleDot className="h-3 w-3 text-emerald-400" />
                  </InlineAffordanceLeadingVisual>
                  <InlineAffordanceLabel className="truncate">{focused.cwd}</InlineAffordanceLabel>
                </InlineAffordance>
                <span>
                  cursor {snapshot?.cursor.x ?? 0}:{snapshot?.cursor.y ?? 0}
                  {snapshot?.cursorVisible === false ? " · hidden" : ""}
                </span>
              </footer>
            </ClipSurface>
          </div>
        </ScrollViewport>
      </section>
    </AsyncSurface>
  );
};
