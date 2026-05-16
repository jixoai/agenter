import { closeSync, openSync } from "node:fs";

export interface CliShellPerfTraceEvent {
  kind: string;
  timestamp: number;
  seq?: number;
  sinceStartMs?: number;
  sincePreviousMs?: number;
  detail?: Record<string, unknown>;
}

export interface CliShellPerfSnapshot {
  dirtyAgoMs: number | null;
  pullMs: number | null;
  patch: string;
  frameBytes: number | null;
  diffBytes: number | null;
  applyMs: number | null;
  renderMs: number | null;
  frameGapMs: number | null;
  fps: number | null;
  dirtyQueue: number;
  pullQueue: number;
  renderQueue: number;
  skippedFrames: number;
  paintCells: string;
  viewport: string;
  mode: string;
  frameSource: string;
}

export interface CliShellPerfTracer {
  enabled: boolean;
  record(event: Omit<CliShellPerfTraceEvent, "timestamp">): void;
  snapshot(): CliShellPerfSnapshot;
  dispose(): void;
}

const initializedTraceFiles = new Set<string>();
const TRACE_SUMMARY_INTERVAL_MS = 1_000;

const TRACE_KIND_GROUPS: Record<string, readonly string[]> = {
  key: ["key-", "terminal-key-", "terminal-input-"],
  selection: ["selection-", "semantic-selection-"],
  follow: ["follow-cursor", "viewport-target"],
  scroll: ["viewport-", "scrollbar-"],
  frame: ["frame-", "pull-frame-", "paint-", "render-"],
};

interface SuppressedTraceSummary {
  count: number;
  firstAt: number;
  lastAt: number;
  kinds: Record<string, number>;
  lastFrameSeq: number | null;
  lastPatchType: string | null;
  lastPullLatencyMs: number | null;
  maxPullLatencyMs: number | null;
}

const resolveTraceFile = (debugEnabled = false): string | null => {
  const rawValue = process.env.AGENTER_CLI_SHELL_TRACE?.trim();
  const value = rawValue && rawValue.length > 0 ? rawValue : null;
  const normalizedValue = value?.toLowerCase() ?? null;
  if ((!value || value === "0" || normalizedValue === "false") && !debugEnabled) {
    return null;
  }
  if (value === "1" || normalizedValue === "true") {
    return ".agenter-cli-shell-trace.ndjson";
  }
  if (!value || value === "0" || normalizedValue === "false") {
    return ".agenter-cli-shell-trace.ndjson";
  }
  return value;
};

export const createCliShellPerfTracer = (input: { enabled?: boolean; filters?: readonly string[] } = {}): CliShellPerfTracer => {
  const traceFile = resolveTraceFile(input.enabled ?? false);
  if (!traceFile) {
    return {
      enabled: false,
      record: () => {},
      snapshot: () => ({
        dirtyAgoMs: null,
        pullMs: null,
        patch: "-",
        frameBytes: null,
        diffBytes: null,
        applyMs: null,
        renderMs: null,
        frameGapMs: null,
        fps: null,
        dirtyQueue: 0,
        pullQueue: 0,
        renderQueue: 0,
        skippedFrames: 0,
        paintCells: "-",
        viewport: "-",
        mode: "off",
        frameSource: "-",
      }),
      dispose: () => {},
    };
  }

  if (!initializedTraceFiles.has(traceFile)) {
    initializedTraceFiles.add(traceFile);
    closeSync(openSync(traceFile, "w"));
  }

  let writer: { write(chunk: string): unknown; end(): unknown } | null = Bun.file(traceFile).writer();
  let traceSeq = 0;
  let traceStartedAt = 0;
  let previousTraceAt = 0;
  const snapshot: CliShellPerfSnapshot = {
    dirtyAgoMs: null,
    pullMs: null,
    patch: "-",
    frameBytes: null,
    diffBytes: null,
    applyMs: null,
    renderMs: null,
    frameGapMs: null,
    fps: null,
    dirtyQueue: 0,
    pullQueue: 0,
    renderQueue: 0,
    skippedFrames: 0,
    paintCells: "-",
    viewport: "-",
    mode: "normal",
    frameSource: "-",
  };
  let lastDirtyAt: number | null = null;
  let suppressedSummary: SuppressedTraceSummary | null = null;
  const filters = (input.filters ?? []).map((filter) => filter.trim().toLowerCase()).filter((filter) => filter.length > 0);

  const numberDetail = (detail: Record<string, unknown> | undefined, key: string): number | null => {
    const value = detail?.[key];
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  };

  const stringDetail = (detail: Record<string, unknown> | undefined, key: string): string | null => {
    const value = detail?.[key];
    return typeof value === "string" ? value : null;
  };

  const numberArrayDetail = (value: unknown): number[] | null => {
    if (!Array.isArray(value)) {
      return null;
    }
    const numbers = value.filter((entry): entry is number => typeof entry === "number" && Number.isFinite(entry));
    return numbers.length === value.length ? numbers : null;
  };

  const percentile = (values: readonly number[], percentileValue: number): number | null => {
    if (values.length === 0) {
      return null;
    }
    const sorted = [...values].sort((left, right) => left - right);
    const index = Math.min(
      sorted.length - 1,
      Math.max(0, Math.floor((sorted.length - 1) * percentileValue)),
    );
    return Number(sorted[index]?.toFixed(2));
  };

  const summarizeRendererStats = (value: unknown): Record<string, unknown> | null => {
    if (typeof value !== "object" || value === null) {
      return null;
    }
    const stats = value as Record<string, unknown>;
    const frameTimes = numberArrayDetail(stats.frameTimes);
    const summary: Record<string, unknown> = {};
    if (typeof stats.fps === "number" && Number.isFinite(stats.fps)) {
      summary.fps = stats.fps;
    }
    if (typeof stats.frameCount === "number" && Number.isFinite(stats.frameCount)) {
      summary.frameCount = stats.frameCount;
    }
    if (typeof stats.averageFrameTime === "number" && Number.isFinite(stats.averageFrameTime)) {
      summary.averageFrameTimeMs = Number(stats.averageFrameTime.toFixed(2));
    }
    if (typeof stats.minFrameTime === "number" && Number.isFinite(stats.minFrameTime)) {
      summary.minFrameTimeMs = Number(stats.minFrameTime.toFixed(2));
    }
    if (typeof stats.maxFrameTime === "number" && Number.isFinite(stats.maxFrameTime)) {
      summary.maxFrameTimeMs = Number(stats.maxFrameTime.toFixed(2));
    }
    if (frameTimes) {
      summary.frameTimeSampleCount = frameTimes.length;
      summary.lastFrameTimeMs = Number((frameTimes.at(-1) ?? 0).toFixed(2));
      summary.p95FrameTimeMs = percentile(frameTimes, 0.95);
      summary.p99FrameTimeMs = percentile(frameTimes, 0.99);
      summary.slowFramesOver16Ms = frameTimes.filter((frameTime) => frameTime > 16).length;
      summary.slowFramesOver33Ms = frameTimes.filter((frameTime) => frameTime > 33).length;
    }
    return Object.keys(summary).length > 0 ? summary : null;
  };

  const normalizeDetail = (detail: Record<string, unknown> | undefined): Record<string, unknown> | undefined => {
    if (!detail) {
      return undefined;
    }
    const normalized: Record<string, unknown> = { ...detail };
    const rendererStats = summarizeRendererStats(normalized.stats);
    if (rendererStats) {
      normalized.rendererStats = rendererStats;
      delete normalized.stats;
    }
    return normalized;
  };

  const updateSnapshot = (event: CliShellPerfTraceEvent): void => {
    if (event.kind === "frame-dirty-received") {
      lastDirtyAt = event.timestamp;
      snapshot.dirtyAgoMs = 0;
      snapshot.dirtyQueue = numberDetail(event.detail, "dirtyQueueDepth") ?? Math.max(snapshot.dirtyQueue, 1);
      return;
    }
    if (event.kind === "pull-frame-sent") {
      snapshot.pullQueue = 1;
      snapshot.mode = stringDetail(event.detail, "pullMode") ?? snapshot.mode;
      return;
    }
    if (event.kind === "pull-frame-blocked" || event.kind === "pull-frame-scheduled") {
      snapshot.pullQueue = Math.max(snapshot.pullQueue, 1);
      snapshot.mode = stringDetail(event.detail, "pullMode") ?? snapshot.mode;
      const dirtyQueue = numberDetail(event.detail, "dirtyQueueDepth");
      if (dirtyQueue !== null) {
        snapshot.dirtyQueue = dirtyQueue;
      }
      return;
    }
    if (event.kind === "pull-frame-cancelled") {
      snapshot.pullQueue = 0;
      return;
    }
    if (event.kind === "pull-frame-send-failed") {
      snapshot.pullQueue = 0;
      return;
    }
    if (event.kind === "frame-received") {
      snapshot.pullQueue = 0;
      snapshot.pullMs = numberDetail(event.detail, "latencyMs");
      const patchType = stringDetail(event.detail, "patchType") ?? "?";
      const patchRows = numberDetail(event.detail, "patchRows");
      snapshot.patch = patchRows === null ? patchType : `${patchType}:${patchRows}`;
      snapshot.diffBytes = numberDetail(event.detail, "diffBytes");
      snapshot.frameBytes = numberDetail(event.detail, "frameBytes");
      const skippedFrames = numberDetail(event.detail, "skippedFrames");
      if (skippedFrames !== null) {
        snapshot.skippedFrames += skippedFrames;
      }
      return;
    }
    if (event.kind === "frame-applied") {
      snapshot.applyMs = numberDetail(event.detail, "applyMs");
      snapshot.frameBytes = numberDetail(event.detail, "frameBytes") ?? snapshot.frameBytes;
      const viewportStart = numberDetail(event.detail, "viewportStart");
      const screenLines = numberDetail(event.detail, "screenLines");
      const totalLines = numberDetail(event.detail, "totalLines");
      if (viewportStart !== null && screenLines !== null && totalLines !== null) {
        snapshot.viewport = `${viewportStart}-${viewportStart + screenLines}/${totalLines}`;
      }
      snapshot.dirtyQueue = 0;
      snapshot.renderQueue = Math.max(snapshot.renderQueue, 1);
      return;
    }
    if (event.kind === "render-revision-scheduled") {
      snapshot.renderQueue = 1;
      return;
    }
    if (event.kind === "render-revision-committed") {
      snapshot.renderQueue = 0;
      return;
    }
    if (event.kind === "render-requested") {
      snapshot.renderQueue = 1;
      return;
    }
    if (event.kind === "render-revision-coalesced") {
      snapshot.renderQueue += 1;
      return;
    }
    if (event.kind === "paint-committed") {
      snapshot.renderQueue = 0;
      const dirtyQueue = numberDetail(event.detail, "dirtyQueueDepth");
      if (dirtyQueue !== null) {
        snapshot.dirtyQueue = dirtyQueue;
      }
      return;
    }
    if (event.kind === "render-applied") {
      snapshot.frameGapMs = numberDetail(event.detail, "elapsedMs");
      snapshot.renderMs = numberDetail(event.detail, "terminalPaintMs");
      snapshot.fps = numberDetail(event.detail, "estimatedFps");
      const paintRows = numberDetail(event.detail, "terminalPaintRows");
      const paintSpans = numberDetail(event.detail, "terminalPaintSpans");
      const paintGlyphs = numberDetail(event.detail, "terminalPaintGlyphs");
      if (paintRows !== null && paintSpans !== null && paintGlyphs !== null) {
        snapshot.paintCells = `${paintRows}r/${paintSpans}s/${paintGlyphs}g`;
      }
      const viewportStart = numberDetail(event.detail, "viewportStart");
      const scrollbackRows = numberDetail(event.detail, "scrollbackRows");
      const visibleLineCount = numberDetail(event.detail, "visibleLineCount");
      if (viewportStart !== null && scrollbackRows !== null && visibleLineCount !== null) {
        snapshot.viewport = `${viewportStart}-${viewportStart + visibleLineCount}/${scrollbackRows}`;
      }
      snapshot.frameSource = stringDetail(event.detail, "frameSource") ?? snapshot.frameSource;
      return;
    }
    if (event.kind === "projection-frame-source") {
      snapshot.frameSource = stringDetail(event.detail, "frameSource") ?? snapshot.frameSource;
    }
  };

  const numericDetail = (detail: Record<string, unknown> | undefined, key: string): number | null => {
    const value = detail?.[key];
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  };

  const shouldSuppressTraceEvent = (event: CliShellPerfTraceEvent): boolean => {
    if (!matchesTraceFilter(event.kind)) {
      return true;
    }
    if (event.kind === "pull-frame-scheduled" || event.kind === "pull-frame-sent") {
      return numericDetail(event.detail, "dirtyQueueDepth") === 0;
    }
    if (event.kind === "client-send" && event.detail?.messageType === "pullFrame") {
      return true;
    }
    if (
      event.kind === "client-direct-message" &&
      (event.detail?.messageType === "trace" || event.detail?.messageType === "frame")
    ) {
      return true;
    }
    if (event.kind === "frame-received" && event.detail?.patchType === "notModified") {
      return true;
    }
    if (event.kind === "frame-not-modified") {
      return true;
    }
    return false;
  };

  const matchesTraceFilter = (kind: string): boolean => {
    if (filters.length === 0) {
      return true;
    }
    return filters.some((filter) => {
      const group = TRACE_KIND_GROUPS[filter];
      if (group) {
        return group.some((prefix) => kind.startsWith(prefix));
      }
      return kind === filter || kind.startsWith(`${filter}-`) || kind.includes(filter);
    });
  };

  const rememberSuppressedEvent = (event: CliShellPerfTraceEvent): void => {
    const frameSeq = numericDetail(event.detail, "frameSeq");
    const latencyMs = numericDetail(event.detail, "latencyMs");
    const patchType = typeof event.detail?.patchType === "string" ? event.detail.patchType : null;
    if (!suppressedSummary) {
      suppressedSummary = {
        count: 0,
        firstAt: event.timestamp,
        lastAt: event.timestamp,
        kinds: {},
        lastFrameSeq: null,
        lastPatchType: null,
        lastPullLatencyMs: null,
        maxPullLatencyMs: null,
      };
    }
    suppressedSummary.count += 1;
    suppressedSummary.lastAt = event.timestamp;
    suppressedSummary.kinds[event.kind] = (suppressedSummary.kinds[event.kind] ?? 0) + 1;
    if (frameSeq !== null) {
      suppressedSummary.lastFrameSeq = frameSeq;
    }
    if (patchType !== null) {
      suppressedSummary.lastPatchType = patchType;
    }
    if (latencyMs !== null) {
      suppressedSummary.lastPullLatencyMs = latencyMs;
      suppressedSummary.maxPullLatencyMs =
        suppressedSummary.maxPullLatencyMs === null ? latencyMs : Math.max(suppressedSummary.maxPullLatencyMs, latencyMs);
    }
  };

  const takeSuppressedSummary = (timestamp: number): Omit<CliShellPerfTraceEvent, "timestamp"> | null => {
    if (!suppressedSummary) {
      return null;
    }
    if (timestamp - suppressedSummary.firstAt < TRACE_SUMMARY_INTERVAL_MS) {
      return null;
    }
    const summary = suppressedSummary;
    suppressedSummary = null;
    return {
      kind: "trace-summary",
      detail: {
        suppressedEvents: summary.count,
        windowMs: summary.lastAt - summary.firstAt,
        kinds: JSON.stringify(summary.kinds),
        lastFrameSeq: summary.lastFrameSeq,
        lastPatchType: summary.lastPatchType,
        lastPullLatencyMs: summary.lastPullLatencyMs,
        maxPullLatencyMs: summary.maxPullLatencyMs,
      },
    };
  };

  const writeTraceEvent = (timestamp: number, event: Omit<CliShellPerfTraceEvent, "timestamp">): CliShellPerfTraceEvent => {
    traceSeq += 1;
    const traceEvent = {
      timestamp,
      seq: traceSeq,
      sinceStartMs: timestamp - traceStartedAt,
      sincePreviousMs: previousTraceAt === 0 ? 0 : timestamp - previousTraceAt,
      ...event,
      detail: normalizeDetail(event.detail),
    };
    previousTraceAt = timestamp;
    writer?.write(`${JSON.stringify(traceEvent)}\n`);
    return traceEvent;
  };

  return {
    enabled: true,
    record(event) {
      const timestamp = Date.now();
      if (traceStartedAt === 0) {
        traceStartedAt = timestamp;
      }
      const traceEvent = {
        timestamp,
        ...event,
        detail: normalizeDetail(event.detail),
      };
      updateSnapshot(traceEvent);
      const summary = takeSuppressedSummary(timestamp);
      if (summary) {
        writeTraceEvent(timestamp, summary);
      }
      if (shouldSuppressTraceEvent(traceEvent)) {
        rememberSuppressedEvent(traceEvent);
        return;
      }
      writeTraceEvent(timestamp, traceEvent);
    },
    snapshot() {
      return {
        ...snapshot,
        dirtyAgoMs: lastDirtyAt === null ? snapshot.dirtyAgoMs : Math.max(0, Date.now() - lastDirtyAt),
      };
    },
    dispose() {
      const timestamp = Date.now();
      const summary = suppressedSummary;
      if (summary) {
        suppressedSummary = null;
        writeTraceEvent(timestamp, {
          kind: "trace-summary",
          detail: {
            suppressedEvents: summary.count,
            windowMs: summary.lastAt - summary.firstAt,
            kinds: JSON.stringify(summary.kinds),
            lastFrameSeq: summary.lastFrameSeq,
            lastPatchType: summary.lastPatchType,
            lastPullLatencyMs: summary.lastPullLatencyMs,
            maxPullLatencyMs: summary.maxPullLatencyMs,
          },
        });
      }
      writer?.end();
      writer = null;
    },
  };
};
