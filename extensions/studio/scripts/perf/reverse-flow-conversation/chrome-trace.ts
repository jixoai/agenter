import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { Page } from "playwright";

type TraceEvent = {
  args?: Record<string, unknown>;
  cat?: string;
  dur?: number;
  name: string;
  ph: string;
  pid: number;
  tid: number;
  ts?: number;
};

export interface TraceTopEvent {
  count: number;
  name: string;
  totalMs: number;
}

export interface TraceSummary {
  busyMs: number;
  gcMs: number;
  layoutMs: number;
  longTasks: number;
  paintMs: number;
  rendererThreadName: string | null;
  scriptingMs: number;
  topEvents: TraceTopEvent[];
  totalMs: number;
  tracePath: string;
}

const TRACE_CATEGORIES = [
  "-*",
  "blink.user_timing",
  "devtools.timeline",
  "disabled-by-default-devtools.timeline",
  "disabled-by-default-devtools.timeline.stack",
  "disabled-by-default-v8.runtime_stats_sampling",
  "loading",
  "toplevel",
  "v8.execute",
].join(",");

const SCRIPTING_EVENTS = new Set([
  "CompileScript",
  "EvaluateScript",
  "EventDispatch",
  "FireAnimationFrame",
  "FireIdleCallback",
  "FunctionCall",
  "RunMicrotasks",
  "TimerFire",
  "V8.Execute",
]);

const LAYOUT_EVENTS = new Set(["Layout", "UpdateLayoutTree"]);
const PAINT_EVENTS = new Set(["Paint", "RasterTask", "PrePaint"]);
const GC_EVENTS = new Set(["MajorGC", "MinorGC", "V8.GCCompactor", "V8.GCFinalizeMC"]);
const TASK_EVENTS = new Set(["RunTask", "ThreadControllerImpl::RunTask"]);

const round = (value: number): number => Math.round(value * 100) / 100;
const toMs = (durationUs: number | undefined): number => (durationUs ?? 0) / 1_000;

const findRendererThread = (events: readonly TraceEvent[]): { pid: number; tid: number; name: string } | null => {
  const processNames = new Map<string, string>();
  for (const event of events) {
    if (event.ph !== "M" || event.name !== "process_name") {
      continue;
    }
    const processName = typeof event.args?.name === "string" ? event.args.name : null;
    if (processName) {
      processNames.set(`${event.pid}`, processName);
    }
  }

  for (const event of events) {
    if (event.ph !== "M" || event.name !== "thread_name") {
      continue;
    }
    const threadName = typeof event.args?.name === "string" ? event.args.name : null;
    if (!threadName || threadName !== "CrRendererMain") {
      continue;
    }
    const processName = processNames.get(`${event.pid}`) ?? null;
    if (processName && processName !== "Renderer") {
      continue;
    }
    return { pid: event.pid, tid: event.tid, name: threadName };
  }

  return null;
};

const summarizeTraceEvents = (events: readonly TraceEvent[], tracePath: string): TraceSummary => {
  const rendererThread = findRendererThread(events);
  const mainThreadEvents = events.filter(
    (event) => event.ph === "X" && (!rendererThread || (event.pid === rendererThread.pid && event.tid === rendererThread.tid)),
  );

  const totalMs = round(
    mainThreadEvents.reduce((max, event) => {
      const end = (event.ts ?? 0) + (event.dur ?? 0);
      return Math.max(max, end);
    }, 0) /
      1_000 -
      mainThreadEvents.reduce((min, event) => {
        return Math.min(min, event.ts ?? Number.POSITIVE_INFINITY);
      }, Number.POSITIVE_INFINITY) /
        1_000,
  );

  let busyMs = 0;
  let scriptingMs = 0;
  let layoutMs = 0;
  let paintMs = 0;
  let gcMs = 0;
  let longTasks = 0;
  const topEvents = new Map<string, { count: number; totalMs: number }>();

  for (const event of mainThreadEvents) {
    const eventMs = toMs(event.dur);
    const existing = topEvents.get(event.name) ?? { count: 0, totalMs: 0 };
    existing.count += 1;
    existing.totalMs += eventMs;
    topEvents.set(event.name, existing);

    if (TASK_EVENTS.has(event.name)) {
      busyMs += eventMs;
      if (eventMs >= 50) {
        longTasks += 1;
      }
    }
    if (SCRIPTING_EVENTS.has(event.name)) {
      scriptingMs += eventMs;
    }
    if (LAYOUT_EVENTS.has(event.name)) {
      layoutMs += eventMs;
    }
    if (PAINT_EVENTS.has(event.name)) {
      paintMs += eventMs;
    }
    if (GC_EVENTS.has(event.name)) {
      gcMs += eventMs;
    }
  }

  return {
    totalMs: Number.isFinite(totalMs) ? round(Math.max(totalMs, 0)) : 0,
    busyMs: round(busyMs),
    scriptingMs: round(scriptingMs),
    layoutMs: round(layoutMs),
    paintMs: round(paintMs),
    gcMs: round(gcMs),
    longTasks,
    rendererThreadName: rendererThread?.name ?? null,
    tracePath,
    topEvents: [...topEvents.entries()]
      .sort((left, right) => right[1].totalMs - left[1].totalMs)
      .slice(0, 8)
      .map(([name, value]) => ({
        name,
        count: value.count,
        totalMs: round(value.totalMs),
      })),
  };
};

export const captureChromiumTrace = async (
  page: Page,
  outputPath: string,
  action: () => Promise<void>,
): Promise<TraceSummary> => {
  const client = await page.context().newCDPSession(page);
  const events: TraceEvent[] = [];
  const traceComplete = new Promise<void>((resolve) => {
    client.on("Tracing.dataCollected", (chunk: { value: TraceEvent[] }) => {
      events.push(...chunk.value);
    });
    client.on("Tracing.tracingComplete", () => {
      resolve();
    });
  });

  await client.send("Tracing.start", {
    categories: TRACE_CATEGORIES,
    options: "sampling-frequency=10000",
    transferMode: "ReportEvents",
  });

  try {
    await action();
  } finally {
    await client.send("Tracing.end");
    await traceComplete;
  }

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify({ traceEvents: events }, null, 2));
  return summarizeTraceEvents(events, outputPath);
};
