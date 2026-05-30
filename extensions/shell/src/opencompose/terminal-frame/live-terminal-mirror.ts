import type { TerminalRenderRichLine } from "@agenter/termless-core";
import {
  applyTerminalFramePatch,
  createTerminalTransportRowCacheDecoder,
  createTerminalTransportClientSession,
  estimateTerminalTransportFramePayloadBytes,
  estimateTerminalTransportPatchPayloadBytes,
  type TerminalTransportClientConnectionState,
  type TerminalTransportClientSession,
  type TerminalTransportClientSessionEvents,
  type TerminalTransportOwnerCoordinate,
  type TerminalTransportFramePatch,
  type TerminalTransportFramePayload,
  type TerminalTransportInteractionFrameState,
  type TerminalTransportSelectionRange,
  type TerminalTransportRowCacheDecoder,
  type TerminalTransportServerMessage,
  type TerminalTransportSnapshot,
} from "@agenter/terminal-transport-protocol";

export interface OpenComposeLiveTerminalView {
  snapshotSeq: number;
  plainLines: string[];
  richLines: TerminalRenderRichLine[];
  cursorAbsRow: number;
  cursorCol: number;
  cursorVisible: boolean;
  rows: number;
  cols: number;
  viewportStart: number;
  viewportEnd: number;
  scrollbackRows: number;
  interaction?: TerminalTransportInteractionFrameState;
  running: boolean;
  connected: boolean;
}

export interface OpenComposeLiveTerminalMirror {
  connect(): Promise<void>;
  disconnect(): void;
  getView(): OpenComposeLiveTerminalView;
  notifyPaintCommitted(): void;
  setPullGeometry(cols: number, rows: number): void;
  sendInputBytes(data: Uint8Array): boolean;
  resize(cols: number, rows: number): boolean;
  scrollViewport(deltaRows: number): boolean;
  setViewportStart(viewportStart: number): boolean;
  followCursor(): boolean;
  selectionStart(point: TerminalTransportOwnerCoordinate): boolean;
  selectionUpdate(point: TerminalTransportOwnerCoordinate): boolean;
  selectionEnd(point: TerminalTransportOwnerCoordinate): boolean;
  selectWordAt(point: TerminalTransportOwnerCoordinate): boolean;
  selectLineAt(point: TerminalTransportOwnerCoordinate): boolean;
  selectRange(range: TerminalTransportSelectionRange): boolean;
  copySelection(ownerId?: string): boolean;
  clearSelection(ownerId?: string): boolean;
  subscribe(listener: () => void): () => void;
}

export type OpenComposeLiveTerminalRefreshMode = "fixed" | "dynamic";

export interface OpenComposeLiveTerminalPacingOptions {
  mode?: OpenComposeLiveTerminalRefreshMode;
  fixedFps?: number;
  activeFps?: number;
  idleFps?: number;
  dynamicQuietMs?: number;
}

export interface OpenComposeLiveTerminalTransportSessionInput {
  transportUrl: string;
  terminalId?: string;
  geometryRole?: "projection-only" | "authority";
  debugTrace?: boolean;
  events: Required<Pick<TerminalTransportClientSessionEvents, "onOpen" | "onClose" | "onError" | "onMessage">> &
    Pick<TerminalTransportClientSessionEvents, "onTrace">;
}

export type OpenComposeLiveTerminalTransportSessionFactory = (
  input: OpenComposeLiveTerminalTransportSessionInput,
) => TerminalTransportClientSession;

const DEFAULT_FIXED_FPS = 30;
const DEFAULT_ACTIVE_FPS = 30;
const DEFAULT_IDLE_FPS = 1;
const DEFAULT_DYNAMIC_QUIET_MS = 2_000;
export const OPENCOMPOSE_PRODUCT_DYNAMIC_QUIET_MS = 120;

const cloneRichLines = (lines: readonly TerminalRenderRichLine[]): TerminalRenderRichLine[] =>
  lines.map((line) => ({
    spans: line.spans.map((span) => ({ ...span })),
  }));

const richLineToPlain = (line: TerminalRenderRichLine): string => line.spans.map((span) => span.text).join("");

const linesToRichLines = (lines: readonly string[]): TerminalRenderRichLine[] =>
  lines.map((text) => ({
    spans: text.length > 0 ? [{ text }] : [],
  }));

const cloneFrame = (frame: TerminalTransportFramePayload): TerminalTransportFramePayload => structuredClone(frame);

const framesShareInteractionTruth = (
  left: TerminalTransportFramePayload,
  right: TerminalTransportFramePayload,
): boolean => JSON.stringify(left.interaction ?? null) === JSON.stringify(right.interaction ?? null);

const framesShareVisibleTruth = (
  left: TerminalTransportFramePayload,
  right: TerminalTransportFramePayload,
): boolean => {
  if (
    left.seq !== right.seq ||
    left.cols !== right.cols ||
    left.rows !== right.rows ||
    left.cursor.x !== right.cursor.x ||
    left.cursor.y !== right.cursor.y ||
    (left.cursor.visible ?? true) !== (right.cursor.visible ?? true) ||
    left.scrollback.viewportOffset !== right.scrollback.viewportOffset ||
    left.scrollback.totalLines !== right.scrollback.totalLines ||
    left.scrollback.screenLines !== right.scrollback.screenLines ||
    left.lines.length !== right.lines.length ||
    (left.richLines?.length ?? 0) !== (right.richLines?.length ?? 0) ||
    !framesShareInteractionTruth(left, right)
  ) {
    return false;
  }
  if (!left.lines.every((line, index) => line === right.lines[index])) {
    return false;
  }
  const leftRichLines = left.richLines ?? [];
  const rightRichLines = right.richLines ?? [];
  return leftRichLines.every((line, lineIndex) => {
    const other = rightRichLines[lineIndex];
    return (
      other !== undefined &&
      line.spans.length === other.spans.length &&
      line.spans.every((span, spanIndex) => {
        const otherSpan = other.spans[spanIndex];
        return (
          otherSpan !== undefined &&
          span.text === otherSpan.text &&
          span.fg === otherSpan.fg &&
          span.bg === otherSpan.bg &&
          span.bold === otherSpan.bold &&
          span.underline === otherSpan.underline &&
          span.inverse === otherSpan.inverse
        );
      })
    );
  });
};

const framesShareDrawableCells = (
  left: TerminalTransportFramePayload,
  right: TerminalTransportFramePayload,
): boolean => {
  if (
    left.cols !== right.cols ||
    left.rows !== right.rows ||
    left.cursor.x !== right.cursor.x ||
    left.cursor.y !== right.cursor.y ||
    (left.cursor.visible ?? true) !== (right.cursor.visible ?? true) ||
    left.scrollback.viewportOffset !== right.scrollback.viewportOffset ||
    left.scrollback.totalLines !== right.scrollback.totalLines ||
    left.scrollback.screenLines !== right.scrollback.screenLines ||
    left.lines.length !== right.lines.length ||
    (left.richLines?.length ?? 0) !== (right.richLines?.length ?? 0) ||
    !framesShareInteractionTruth(left, right)
  ) {
    return false;
  }
  if (!left.lines.every((line, index) => line === right.lines[index])) {
    return false;
  }
  const leftRichLines = left.richLines ?? [];
  const rightRichLines = right.richLines ?? [];
  return leftRichLines.every((line, lineIndex) => {
    const other = rightRichLines[lineIndex];
    return (
      other !== undefined &&
      line.spans.length === other.spans.length &&
      line.spans.every((span, spanIndex) => {
        const otherSpan = other.spans[spanIndex];
        return (
          otherSpan !== undefined &&
          span.text === otherSpan.text &&
          span.fg === otherSpan.fg &&
          span.bg === otherSpan.bg &&
          span.bold === otherSpan.bold &&
          span.underline === otherSpan.underline &&
          span.inverse === otherSpan.inverse
        );
      })
    );
  });
};

const resolvePatchRowCount = (patch: TerminalTransportFramePatch): number => {
  if (patch.type === "full") {
    return patch.frame.lines.length;
  }
  if (patch.type === "rows") {
    return patch.rowPatches.length;
  }
  if (patch.type === "scrollRows") {
    return patch.insertedLines.length;
  }
  if (patch.type === "notModified") {
    return 0;
  }
  return patch.cachedRows.length;
};

const normalizeFps = (value: number | undefined, fallback: number): number => {
  const normalized = Math.trunc(value ?? fallback);
  return Number.isFinite(normalized) && normalized > 0 ? normalized : fallback;
};

const fpsToDelayMs = (fps: number): number => Math.max(1, Math.round(1_000 / fps));

const normalizeFrameDimension = (value: number, fallback: number): number => {
  const normalized = Math.trunc(value);
  return Number.isFinite(normalized) ? Math.max(1, normalized) : fallback;
};

const normalizeViewportFrame = (
  frame: TerminalTransportFramePayload,
): { frame: TerminalTransportFramePayload; cursorAbsRow: number; cursorVisible: boolean } => {
  const safeRows = Math.max(1, Math.trunc(frame.rows));
  const safeCols = Math.max(1, Math.trunc(frame.cols));
  const viewportStart = Math.max(0, Math.trunc(frame.scrollback.viewportOffset));
  const cursorVisible = frame.cursor.visible ?? true;
  const cursorAbsY = Math.max(0, Math.trunc(frame.cursor.absY ?? frame.cursor.y));
  const canSliceViewport = frame.lines.length > safeRows && viewportStart + safeRows <= frame.lines.length;
  const totalLines = canSliceViewport
    ? Math.max(frame.scrollback.totalLines, frame.lines.length, viewportStart + safeRows, safeRows)
    : Math.max(frame.lines.length, safeRows);
  if (!canSliceViewport) {
    const lines = frame.lines.slice(0, safeRows);
    const richLines = frame.richLines?.slice(0, safeRows).map((line) => ({
      spans: line.spans.map((span) => ({ ...span })),
    }));
    while (lines.length < safeRows) {
      lines.push("");
    }
    if (richLines) {
      while (richLines.length < safeRows) {
        richLines.push({ spans: [] });
      }
    }
    const localCursorY = Math.max(0, Math.min(Math.max(0, safeRows - 1), Math.trunc(frame.cursor.y)));
    return {
      frame: {
        ...frame,
        cols: safeCols,
        rows: safeRows,
        lines,
        richLines,
        cursor: {
          x: Math.max(0, Math.min(Math.max(0, safeCols - 1), Math.trunc(frame.cursor.x))),
          y: localCursorY,
          visible: frame.cursor.visible ?? true,
        },
        scrollback: {
          viewportOffset: viewportStart,
          totalLines,
          screenLines: safeRows,
        },
      },
      cursorAbsRow: Math.max(0, Math.trunc(frame.cursor.absY ?? viewportStart + localCursorY)),
      cursorVisible,
    };
  }
  const maxStart = Math.max(0, totalLines - safeRows);
  const start = Math.max(0, Math.min(maxStart, viewportStart));
  const lines = frame.lines.slice(start, start + safeRows);
  const richLines = frame.richLines?.slice(start, start + safeRows).map((line) => ({
    spans: line.spans.map((span) => ({ ...span })),
  }));
  while (lines.length < safeRows) {
    lines.push("");
  }
  if (richLines) {
    while (richLines.length < safeRows) {
      richLines.push({ spans: [] });
    }
  }
  const cursorLocalY = Math.trunc(frame.cursor.y) - start;
  return {
    frame: {
      ...frame,
      cols: safeCols,
      rows: safeRows,
      lines,
      richLines,
      cursor: {
        x: Math.max(0, Math.min(Math.max(0, safeCols - 1), Math.trunc(frame.cursor.x))),
        y: Math.max(0, cursorLocalY),
        visible: (frame.cursor.visible ?? true) && cursorLocalY >= 0 && cursorLocalY < safeRows,
      },
      scrollback: {
        viewportOffset: start,
        totalLines,
        screenLines: safeRows,
      },
    },
    cursorAbsRow: cursorAbsY,
    cursorVisible,
  };
};

const viewFromSnapshot = (input: {
  snapshot: TerminalTransportFramePayload | null;
  running: boolean;
  connected: boolean;
}): OpenComposeLiveTerminalView => {
  const snapshot = input.snapshot;
  if (!snapshot) {
    return {
      snapshotSeq: -1,
      plainLines: [],
      richLines: [],
      cursorAbsRow: 0,
      cursorCol: 0,
      cursorVisible: false,
      rows: 24,
      cols: 80,
      viewportStart: 0,
      viewportEnd: 24,
      scrollbackRows: 24,
      interaction: undefined,
      running: input.running,
      connected: input.connected,
    };
  }
  const normalized = normalizeViewportFrame(snapshot);
  const frame = normalized.frame;
  const richLines =
    frame.richLines && frame.richLines.length > 0
      ? cloneRichLines(frame.richLines)
      : linesToRichLines(frame.lines);
  const plainLines = richLines.map((line) => richLineToPlain(line));
  const viewportStart = Math.max(0, frame.scrollback.viewportOffset);
  const viewportEnd = Math.max(viewportStart, viewportStart + frame.rows);
  return {
    snapshotSeq: frame.seq,
    plainLines,
    richLines,
    cursorAbsRow: normalized.cursorAbsRow,
    cursorCol: Math.max(0, frame.cursor.x),
    cursorVisible: normalized.cursorVisible,
    rows: frame.rows,
    cols: frame.cols,
    viewportStart,
    viewportEnd,
    scrollbackRows: Math.max(frame.scrollback.totalLines, viewportEnd),
    interaction: frame.interaction ? structuredClone(frame.interaction) : undefined,
    running: input.running,
    connected: input.connected,
  };
};

export const createOpenComposeLiveTerminalMirror = (input: {
  terminalId: string;
  transportUrl: string;
  initialSnapshot?: TerminalTransportSnapshot | null;
  geometryRole?: "projection-only" | "authority";
  trace?: {
    enabled: boolean;
    record(event: { kind: string; detail?: Record<string, unknown> }): void;
  };
  debugTrace?: boolean;
  pacing?: OpenComposeLiveTerminalPacingOptions;
  requestPaint?: () => void;
  onSelectionText?: (event: { ownerId?: string; text: string }) => void;
  createTransportSession?: OpenComposeLiveTerminalTransportSessionFactory;
}): OpenComposeLiveTerminalMirror => {
  let session: TerminalTransportClientSession | null = null;
  let connectionState: TerminalTransportClientConnectionState = "idle";
  let running = true;
  let latestSnapshot: TerminalTransportFramePayload | null = input.initialSnapshot ? cloneFrame(input.initialSnapshot) : null;
  let rowCacheDecoder: TerminalTransportRowCacheDecoder = createTerminalTransportRowCacheDecoder();
  let dirtyFrameSeq = latestSnapshot?.seq ?? 0;
  let observedFrameSeq = latestSnapshot?.seq ?? 0;
  let pullInFlight = false;
  let paintInFlight = false;
  let pullTimer: ReturnType<typeof setTimeout> | null = null;
  let pullTimerDueAt = 0;
  let lastPullAt = 0;
  let lastPullSentAt = 0;
  let pullBlockedTraceKey = "";
  let pullDueNow = false;
  const pacingMode = input.pacing?.mode ?? "fixed";
  const fixedFps = normalizeFps(input.pacing?.fixedFps, DEFAULT_FIXED_FPS);
  const activeFps = normalizeFps(input.pacing?.activeFps, DEFAULT_ACTIVE_FPS);
  const idleFps = normalizeFps(input.pacing?.idleFps, DEFAULT_IDLE_FPS);
  const dynamicQuietMs = Math.max(1, Math.trunc(input.pacing?.dynamicQuietMs ?? DEFAULT_DYNAMIC_QUIET_MS));
  let dynamicActive = false;
  let lastDrawableChangeAt = 0;
  let pullGeometry: { cols: number; rows: number } | null = latestSnapshot
    ? {
        cols: Math.max(1, Math.trunc(latestSnapshot.cols)),
        rows: Math.max(1, Math.trunc(latestSnapshot.rows)),
      }
    : null;
  let pullGeometryDirty = false;
  const listeners = new Set<() => void>();
  const trace = (kind: string, detail?: Record<string, unknown>): void => {
    input.trace?.record({
      kind,
      detail: {
        terminalId: input.terminalId,
        ...detail,
      },
    });
  };

  const emit = (): void => {
    for (const listener of listeners) {
      listener();
    }
  };

  const applySnapshot = (snapshot: TerminalTransportFramePayload): { applied: boolean; drawableChanged: boolean } => {
    if (latestSnapshot && snapshot.seq < latestSnapshot.seq) {
      return {
        applied: false,
        drawableChanged: false,
      };
    }
    const previousSnapshot = latestSnapshot;
    if (previousSnapshot && framesShareVisibleTruth(snapshot, previousSnapshot)) {
      return {
        applied: false,
        drawableChanged: false,
      };
    }
    const drawableChanged = previousSnapshot === null || !framesShareDrawableCells(snapshot, previousSnapshot);
    latestSnapshot = cloneFrame(snapshot);
    if (drawableChanged) {
      lastDrawableChangeAt = Date.now();
      if (pacingMode === "dynamic") {
        dynamicActive = true;
      }
      trace("drawable-frame-changed", {
        frameSeq: snapshot.seq,
        viewportStart: snapshot.scrollback.viewportOffset,
        totalLines: snapshot.scrollback.totalLines,
        screenLines: snapshot.scrollback.screenLines,
        pacingMode,
      });
    } else if (
      pacingMode === "dynamic" &&
      dynamicActive &&
      lastDrawableChangeAt > 0 &&
      Date.now() - lastDrawableChangeAt >= dynamicQuietMs
    ) {
      dynamicActive = false;
      trace("dynamic-pacing-idle", {
        quietMs: Date.now() - lastDrawableChangeAt,
        thresholdMs: dynamicQuietMs,
      });
    }
    return {
      applied: true,
      drawableChanged,
    };
  };

  const observeUnchangedFrame = (frameSeq: number, reason: string): void => {
    if (
      pacingMode === "dynamic" &&
      dynamicActive &&
      lastDrawableChangeAt > 0 &&
      Date.now() - lastDrawableChangeAt >= dynamicQuietMs
    ) {
      dynamicActive = false;
      trace("dynamic-pacing-idle", {
        frameSeq,
        reason,
        quietMs: Date.now() - lastDrawableChangeAt,
        thresholdMs: dynamicQuietMs,
      });
    }
  };

  const recordDirtySignal = (frameSeq: number, reason: string): void => {
    if (pacingMode === "dynamic") {
      lastDrawableChangeAt = Date.now();
      dynamicActive = true;
      trace("dynamic-pacing-active", {
        frameSeq,
        reason,
      });
    }
  };

  const shouldPullDueNowForDirty = (): boolean => {
    // Fixed pacing deliberately ignores dirty as an immediate pull trigger: dirty only
    // tells the next paced frame to return content. Dynamic pacing may wake early.
    return pacingMode === "dynamic" && hasDirtyFrame();
  };

  const hasDirtyFrame = (): boolean => dirtyFrameSeq > observedFrameSeq;

  const resolvePullMode = (): "idle" | "active" => {
    if (pacingMode === "fixed") {
      return "active";
    }
    return dynamicActive || hasDirtyFrame() ? "active" : "idle";
  };

  const resolvePullDelayMs = (): number => {
    if (pacingMode === "fixed") {
      return fpsToDelayMs(fixedFps);
    }
    const active = resolvePullMode() === "active";
    return active ? fpsToDelayMs(activeFps) : fpsToDelayMs(idleFps);
  };

  const resolveDirtyQueueDepth = (): number => Math.max(0, dirtyFrameSeq - observedFrameSeq);

  const resolvePullGeometry = (): { cols: number; rows: number } => ({
    cols: pullGeometry?.cols ?? latestSnapshot?.cols ?? 80,
    rows: pullGeometry?.rows ?? latestSnapshot?.rows ?? 24,
  });

  const updatePullGeometry = (cols: number, rows: number): boolean => {
    const next = {
      cols: normalizeFrameDimension(cols, pullGeometry?.cols ?? latestSnapshot?.cols ?? 80),
      rows: normalizeFrameDimension(rows, pullGeometry?.rows ?? latestSnapshot?.rows ?? 24),
    };
    if (pullGeometry?.cols === next.cols && pullGeometry.rows === next.rows) {
      return false;
    }
    pullGeometry = next;
    pullGeometryDirty = true;
    pullDueNow = true;
    trace("pull-geometry-updated", {
      cols: next.cols,
      rows: next.rows,
    });
    return true;
  };

  const schedulePullFrame = (): void => {
    const blockedReasons = [
      !session ? "no-session" : null,
      connectionState !== "connected" ? `connection-${connectionState}` : null,
      pullInFlight ? "pull-in-flight" : null,
      paintInFlight ? "paint-in-flight" : null,
    ].filter((reason): reason is string => reason !== null);
    if (blockedReasons.length > 0) {
      const traceKey = JSON.stringify({
        blockedReasons,
        dirtyFrameSeq,
        latestSeq: latestSnapshot?.seq ?? 0,
        pullGeometryDirty,
      });
      if (traceKey !== pullBlockedTraceKey) {
        pullBlockedTraceKey = traceKey;
        trace("pull-frame-blocked", {
          blockedReasons,
          dirtyFrameSeq,
          latestFrameSeq: latestSnapshot?.seq ?? 0,
          observedFrameSeq,
          dirtyQueueDepth: resolveDirtyQueueDepth(),
          pullGeometryDirty,
          pullMode: resolvePullMode(),
          pacingMode,
        });
      }
      return;
    }
    const delayMs = resolvePullDelayMs();
    const elapsed = Date.now() - lastPullAt;
    const waitMs = pullDueNow || shouldPullDueNowForDirty() ? 0 : Math.max(0, delayMs - elapsed);
    if (pullTimer) {
      const nextDueAt = Date.now() + waitMs;
      if (pullTimerDueAt > 0 && nextDueAt + 1 < pullTimerDueAt) {
        clearTimeout(pullTimer);
        pullTimer = null;
        pullTimerDueAt = 0;
      } else {
        trace("pull-frame-timer-kept", {
          dirtyFrameSeq,
          latestFrameSeq: latestSnapshot?.seq ?? 0,
          observedFrameSeq,
          dirtyQueueDepth: resolveDirtyQueueDepth(),
          pullMode: resolvePullMode(),
          pacingMode,
        });
        return;
      }
    }
    pullBlockedTraceKey = "";
    trace("pull-frame-scheduled", {
      waitMs,
      delayMs,
      pacingMode,
      fixedFps,
      activeFps,
      idleFps,
      elapsedSinceLastPullMs: elapsed,
      dirtyFrameSeq,
      latestFrameSeq: latestSnapshot?.seq ?? 0,
      observedFrameSeq,
      dirtyQueueDepth: resolveDirtyQueueDepth(),
      pullGeometryDirty,
      pullMode: resolvePullMode(),
    });
    pullTimerDueAt = Date.now() + waitMs;
    pullTimer = setTimeout(() => {
      pullTimer = null;
      pullTimerDueAt = 0;
      if (!session || connectionState !== "connected" || pullInFlight) {
        trace("pull-frame-cancelled", {
          reason: !session ? "no-session" : connectionState !== "connected" ? `connection-${connectionState}` : "pull-in-flight",
          dirtyFrameSeq,
          latestFrameSeq: latestSnapshot?.seq ?? 0,
          observedFrameSeq,
          pullMode: resolvePullMode(),
          pacingMode,
        });
        return;
      }
      if (paintInFlight) {
        trace("pull-frame-cancelled", {
          reason: "paint-in-flight",
          dirtyFrameSeq,
          latestFrameSeq: latestSnapshot?.seq ?? 0,
          observedFrameSeq,
          dirtyQueueDepth: resolveDirtyQueueDepth(),
          pullMode: resolvePullMode(),
          pacingMode,
        });
        return;
      }
      pullInFlight = true;
      pullDueNow = false;
      lastPullAt = Date.now();
      lastPullSentAt = lastPullAt;
      const geometry = resolvePullGeometry();
      const pullMessage = {
        lastAppliedFrameSeq: latestSnapshot?.seq ?? 0,
        cols: geometry.cols,
        rows: geometry.rows,
      };
      trace("pull-frame-sent", {
        lastAppliedFrameSeq: pullMessage.lastAppliedFrameSeq,
        cols: pullMessage.cols,
        rows: pullMessage.rows,
        dirtyFrameSeq,
        observedFrameSeq,
        dirtyQueueDepth: resolveDirtyQueueDepth(),
        pullGeometryDirty,
        pullMode: resolvePullMode(),
        pacingMode,
      });
      const sent = session.pullFrame(pullMessage);
      if (!sent) {
        pullInFlight = false;
        trace("pull-frame-send-failed");
        schedulePullFrame();
      }
    }, waitMs);
  };

  const handleServerMessage = (message: TerminalTransportServerMessage): void => {
    if (message.type === "frameDirty") {
      const previousDirtySeq = dirtyFrameSeq;
      const nextDirtySeq = Math.max(dirtyFrameSeq, message.frameSeq);
      // Dirty is a coarse server hint. Fixed pacing remains the default product law:
      // dynamic active/idle switching is experimental and must be enabled explicitly.
      trace("frame-dirty-received", {
        frameSeq: message.frameSeq,
        reason: message.reason,
        observedFrameSeq,
        dirtyQueueDepth: Math.max(0, nextDirtySeq - observedFrameSeq),
        skippedFrames: Math.max(0, message.frameSeq - previousDirtySeq),
        pacingMode,
      });
      dirtyFrameSeq = nextDirtySeq;
      recordDirtySignal(message.frameSeq, message.reason);
      schedulePullFrame();
      return;
    }
    if (message.type === "frame") {
      const frameReceivedAt = Date.now();
      const previousSeq = latestSnapshot?.seq ?? 0;
      trace("frame-received", {
        frameSeq: message.frameSeq,
        patchType: message.patch.type,
        patchRows: resolvePatchRowCount(message.patch),
        diffBytes: estimateTerminalTransportPatchPayloadBytes(message.patch),
        frameBytes:
          message.patch.type === "full" ? estimateTerminalTransportFramePayloadBytes(message.patch.frame) : null,
        skippedFrames: Math.max(0, message.frameSeq - previousSeq - 1),
        latencyMs: lastPullSentAt > 0 ? Date.now() - lastPullSentAt : null,
      });
      observedFrameSeq = Math.max(observedFrameSeq, message.frameSeq);
      if (message.patch.type === "notModified") {
        pullInFlight = false;
        observeUnchangedFrame(message.frameSeq, "notModified");
        trace("frame-not-modified", {
          frameSeq: message.frameSeq,
          baseFrameSeq: message.patch.baseFrameSeq,
          dirtyFrameSeq,
          observedFrameSeq,
          dirtyQueueDepth: resolveDirtyQueueDepth(),
          latencyMs: lastPullSentAt > 0 ? Date.now() - lastPullSentAt : null,
        });
        schedulePullFrame();
        return;
      }
      const nextSnapshot = applyTerminalFramePatch(latestSnapshot, message.patch, message.frameSeq, rowCacheDecoder);
      pullInFlight = false;
      const appliedSnapshot = nextSnapshot ? applySnapshot(nextSnapshot) : { applied: false, drawableChanged: false };
      if (nextSnapshot && appliedSnapshot.applied) {
        // Terminal liveness is owned by explicit status/close events from the
        // transport. A trailing frame may still arrive after the terminal has
        // already stopped, so frame delivery must never resurrect running=true.
        paintInFlight = true;
        const geometry = resolvePullGeometry();
        if (nextSnapshot.cols === geometry.cols && nextSnapshot.rows === geometry.rows) {
          pullGeometryDirty = false;
        }
        trace("frame-applied", {
          frameSeq: nextSnapshot.seq,
          applyMs: Date.now() - frameReceivedAt,
          frameBytes: estimateTerminalTransportFramePayloadBytes(nextSnapshot),
          lineCount: nextSnapshot.lines.length,
          richLineCount: nextSnapshot.richLines?.length ?? 0,
          viewportStart: nextSnapshot.scrollback.viewportOffset,
          totalLines: nextSnapshot.scrollback.totalLines,
          screenLines: nextSnapshot.scrollback.screenLines,
          cursorRow: nextSnapshot.cursor.y,
          cursorCol: nextSnapshot.cursor.x,
          drawableChanged: appliedSnapshot.drawableChanged,
        });
        input.requestPaint?.();
      } else {
        observeUnchangedFrame(message.frameSeq, nextSnapshot ? "duplicate-frame" : "stale-or-unapplicable-frame");
        trace("frame-skipped", {
          frameSeq: message.frameSeq,
          reason:
            nextSnapshot && latestSnapshot && framesShareVisibleTruth(nextSnapshot, latestSnapshot)
              ? "duplicate-frame"
              : "stale-or-unapplicable-frame",
          latestFrameSeq: latestSnapshot?.seq ?? 0,
          observedFrameSeq,
          applyMs: Date.now() - frameReceivedAt,
        });
      }
      schedulePullFrame();
      return;
    }
    if (message.type === "trace") {
      trace(`server-${message.event}`, {
        ...message.fields,
        serverTimestamp: message.timestamp ?? null,
      });
      return;
    }
    if (message.type === "status") {
      running = message.running;
      emit();
      return;
    }
    if (message.type === "selectionText") {
      trace("selection-text-received", {
        ownerId: message.ownerId ?? "terminal",
        textLength: message.text.length,
      });
      input.onSelectionText?.({
        ownerId: message.ownerId,
        text: message.text,
      });
      return;
    }
  };

  return {
    async connect(): Promise<void> {
      if (session) {
        return;
      }
      const createTransportSession = input.createTransportSession ?? createTerminalTransportClientSession;
      session = createTransportSession({
        transportUrl: input.transportUrl,
        terminalId: input.terminalId,
        geometryRole: input.geometryRole ?? "authority",
        debugTrace: input.debugTrace ?? input.trace?.enabled === true,
        events: {
          onOpen: () => {
            connectionState = "connected";
            dirtyFrameSeq = Math.max(dirtyFrameSeq, latestSnapshot?.seq ?? 0);
            observedFrameSeq = Math.max(observedFrameSeq, latestSnapshot?.seq ?? 0);
            pullDueNow = true;
            schedulePullFrame();
            emit();
          },
          onClose: () => {
            connectionState = "closed";
            running = false;
            emit();
          },
          onError: () => {
            connectionState = "error";
            emit();
          },
          onMessage: handleServerMessage,
          onTrace: (event) => {
            trace(event.kind, {
              messageType: event.messageType,
              byteLength: event.byteLength,
              dataPlane: event.dataPlane,
              reason: event.reason,
              decodeMs:
                typeof event.decodeMs === "number" && Number.isFinite(event.decodeMs)
                  ? Number(event.decodeMs.toFixed(2))
                  : null,
              pullInFlight,
              paintInFlight,
              dirtyFrameSeq,
              observedFrameSeq,
              latestFrameSeq: latestSnapshot?.seq ?? 0,
              pullMode: resolvePullMode(),
              pacingMode,
            });
          },
        },
      });
      connectionState = "connecting";
      emit();
      await session.connect();
    },
    disconnect(): void {
      connectionState = session ? "closed" : "idle";
      session?.disconnect();
      session = null;
      rowCacheDecoder = createTerminalTransportRowCacheDecoder();
      observedFrameSeq = latestSnapshot?.seq ?? 0;
      if (pullTimer) {
        clearTimeout(pullTimer);
        pullTimer = null;
        pullTimerDueAt = 0;
      }
      pullInFlight = false;
      paintInFlight = false;
      pullDueNow = false;
      dynamicActive = false;
    },
    getView(): OpenComposeLiveTerminalView {
      return viewFromSnapshot({
        snapshot: latestSnapshot,
        running,
        connected: connectionState === "connected",
      });
    },
    notifyPaintCommitted(): void {
      if (!paintInFlight) {
        return;
      }
      paintInFlight = false;
      trace("paint-committed", {
        observedFrameSeq,
        dirtyQueueDepth: resolveDirtyQueueDepth(),
      });
      // Paint completion, not input events, is the only place that schedules the
      // next post-frame pull after a drawn frame. This keeps the loop RAF-like.
      schedulePullFrame();
    },
    setPullGeometry(cols: number, rows: number): void {
      if (updatePullGeometry(cols, rows)) {
        schedulePullFrame();
      }
    },
    sendInputBytes(data: Uint8Array): boolean {
      const sent = session?.sendInputBytes(data) ?? false;
      trace("terminal-input-sent", {
        byteLength: data.byteLength,
        sent,
        pullMode: resolvePullMode(),
      });
      return sent;
    },
    followCursor(): boolean {
      const sent = session?.followCursor() ?? false;
      trace("follow-cursor-sent", {
        source: "follow-cursor",
        sent,
        pullMode: resolvePullMode(),
        currentViewportStart: latestSnapshot?.scrollback.viewportOffset ?? null,
        totalLines: latestSnapshot?.scrollback.totalLines ?? null,
        screenLines: latestSnapshot?.scrollback.screenLines ?? null,
      });
      return sent;
    },
    selectionStart(point): boolean {
      const sent = session?.selectionStart(point) ?? false;
      trace("selection-start-sent", {
        ownerId: point.ownerId,
        row: point.row,
        col: point.col,
        sent,
      });
      return sent;
    },
    selectionUpdate(point): boolean {
      const sent = session?.selectionUpdate(point) ?? false;
      trace("selection-update-sent", {
        ownerId: point.ownerId,
        row: point.row,
        col: point.col,
        sent,
      });
      return sent;
    },
    selectionEnd(point): boolean {
      const sent = session?.selectionEnd(point) ?? false;
      trace("selection-end-sent", {
        ownerId: point.ownerId,
        row: point.row,
        col: point.col,
        sent,
      });
      return sent;
    },
    selectWordAt(point): boolean {
      const sent = session?.selectWordAt(point) ?? false;
      trace("semantic-selection-word-sent", {
        ownerId: point.ownerId,
        row: point.row,
        col: point.col,
        sent,
      });
      return sent;
    },
    selectLineAt(point): boolean {
      const sent = session?.selectLineAt(point) ?? false;
      trace("semantic-selection-line-sent", {
        ownerId: point.ownerId,
        row: point.row,
        col: point.col,
        sent,
      });
      return sent;
    },
    selectRange(range): boolean {
      const sent = session?.selectRange(range) ?? false;
      trace("selection-range-sent", {
        ownerId: range.ownerId,
        startRow: range.startRow,
        startCol: range.startCol,
        endRow: range.endRow,
        endCol: range.endCol,
        sent,
      });
      return sent;
    },
    copySelection(ownerId): boolean {
      const sent = session?.copySelection(ownerId) ?? false;
      trace("selection-copy-requested", {
        ownerId: ownerId ?? "terminal",
        sent,
      });
      return sent;
    },
    clearSelection(ownerId): boolean {
      const sent = session?.clearSelection(ownerId) ?? false;
      trace("selection-clear-sent", {
        ownerId: ownerId ?? "terminal",
        sent,
      });
      return sent;
    },
    resize(cols: number, rows: number): boolean {
      const changed = updatePullGeometry(cols, rows);
      const normalizedCols = normalizeFrameDimension(cols, pullGeometry?.cols ?? latestSnapshot?.cols ?? 80);
      const normalizedRows = normalizeFrameDimension(rows, pullGeometry?.rows ?? latestSnapshot?.rows ?? 24);
      const sent = session?.resize(normalizedCols, normalizedRows) ?? false;
      trace("terminal-resize-sent", {
        cols: normalizedCols,
        rows: normalizedRows,
        sent,
        geometryChanged: changed,
        pullMode: resolvePullMode(),
      });
      if (changed) {
        schedulePullFrame();
      }
      return sent;
    },
    scrollViewport(deltaRows: number): boolean {
      const delta = Math.trunc(deltaRows);
      if (!Number.isFinite(delta) || delta === 0) {
        return false;
      }
      if (!session || connectionState !== "connected") {
        trace("viewport-delta-sent", {
          deltaRows: delta,
          sent: false,
          pullMode: resolvePullMode(),
          viewportStart: latestSnapshot?.scrollback.viewportOffset ?? null,
          totalLines: latestSnapshot?.scrollback.totalLines ?? null,
          screenLines: latestSnapshot?.scrollback.screenLines ?? null,
        });
        return false;
      }
      const sent = session.scrollViewport(delta);
      trace("viewport-delta-sent", {
        deltaRows: delta,
        sent,
        pullMode: resolvePullMode(),
        viewportStart: latestSnapshot?.scrollback.viewportOffset ?? null,
        totalLines: latestSnapshot?.scrollback.totalLines ?? null,
        screenLines: latestSnapshot?.scrollback.screenLines ?? null,
      });
      return true;
    },
    setViewportStart(viewportStart: number): boolean {
      const safeStart = Math.max(0, Math.trunc(viewportStart));
      if (!Number.isFinite(safeStart)) {
        return false;
      }
      const sent = session?.setViewportStart(safeStart) ?? false;
      trace("viewport-target-sent", {
        viewportStart: safeStart,
        sent,
        pullMode: resolvePullMode(),
        currentViewportStart: latestSnapshot?.scrollback.viewportOffset ?? null,
        totalLines: latestSnapshot?.scrollback.totalLines ?? null,
        screenLines: latestSnapshot?.scrollback.screenLines ?? null,
      });
      return sent;
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};
