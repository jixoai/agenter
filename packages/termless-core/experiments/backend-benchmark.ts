import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  assertTerminalBackendKind,
  createTerminalBackend,
  renderStructuredViewportBuffer,
  renderStructuredBuffer,
  type TerminalBackendKind,
} from "../src/index.ts";

interface BenchmarkOptions {
  backends: TerminalBackendKind[];
  cols: number;
  rows: number;
  scrollbackLimit: number;
  rounds: number;
  sourcePath: string;
  repeat: number;
  chunkSize: number;
  scrollDelta: number;
  scrollSteps: number;
}

interface TimingSummary {
  minMs: number;
  medianMs: number;
  p95Ms: number;
  maxMs: number;
  meanMs: number;
}

interface RoundResult {
  backend: TerminalBackendKind;
  round: number;
  feedMs: number;
  getTextMs: number;
  getLinesMs: number;
  visibleGetLineMs: number;
  getLinesRangeMs: number;
  getViewportLinesMs: number;
  structuredMs: number;
  structuredViewportMs: number;
  getScrollbackMs: number;
  scrollMs: number;
  scrollThenGetLinesMs: number;
  scrollThenVisibleGetLineMs: number;
  scrollThenViewportLinesMs: number;
  textLength: number;
  rowsRead: number;
  spanCount: number;
  scrollbackTotal: number;
  scrollbackViewportOffset: number;
  chinesePreview: string[];
}

const REPO_ROOT = resolve(import.meta.dir, "../../..");

const readFlagValue = (args: readonly string[], flag: string): string | null => {
  const prefix = `${flag}=`;
  const inline = args.find((arg) => arg.startsWith(prefix));
  if (inline) {
    return inline.slice(prefix.length);
  }
  const index = args.indexOf(flag);
  if (index >= 0) {
    const value = args[index + 1] ?? null;
    return value && !value.startsWith("--") ? value : null;
  }
  return null;
};

const readNumberFlag = (args: readonly string[], flag: string, fallback: number): number => {
  const parsed = Number.parseInt(readFlagValue(args, flag) ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const parseBackends = (value: string | null): TerminalBackendKind[] => {
  const tokens = (value ?? "xterm,ghostty-native")
    .split(",")
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
  return tokens.map(assertTerminalBackendKind);
};

const parseOptions = (args: readonly string[]): BenchmarkOptions => ({
  backends: parseBackends(readFlagValue(args, "--backend") ?? readFlagValue(args, "--backends")),
  cols: readNumberFlag(args, "--cols", 120),
  rows: readNumberFlag(args, "--rows", 30),
  scrollbackLimit: readNumberFlag(args, "--scrollback", 20_000),
  rounds: readNumberFlag(args, "--rounds", 5),
  sourcePath: resolve(readFlagValue(args, "--source") ?? resolve(REPO_ROOT, "AGENTS.md")),
  repeat: readNumberFlag(args, "--repeat", 2),
  chunkSize: readNumberFlag(args, "--chunk-size", 16_384),
  scrollDelta: readNumberFlag(args, "--scroll-delta", 20),
  scrollSteps: readNumberFlag(args, "--scroll-steps", 40),
});

const time = <T>(fn: () => T): { value: T; ms: number } => {
  const startedAt = performance.now();
  const value = fn();
  return {
    value,
    ms: Number((performance.now() - startedAt).toFixed(3)),
  };
};

const summarize = (values: readonly number[]): TimingSummary => {
  const sorted = [...values].sort((a, b) => a - b);
  const percentile = (rank: number): number => sorted[Math.min(sorted.length - 1, Math.floor(rank * sorted.length))] ?? 0;
  const sum = sorted.reduce((acc, value) => acc + value, 0);
  return {
    minMs: sorted[0] ?? 0,
    medianMs: percentile(0.5),
    p95Ms: percentile(0.95),
    maxMs: sorted[sorted.length - 1] ?? 0,
    meanMs: Number((sum / Math.max(1, sorted.length)).toFixed(3)),
  };
};

const toTerminalInput = (source: string, repeat: number): Uint8Array => {
  const unicodeProbe = [
    "",
    "中文渲染探针：你好世界，宽字符应该自然连续，不应该被额外空格拆开。",
    "混合探针：ASCII abc 123 + 中文宽字符 + emoji 🥟🚀 + powerline  main [$✘!?⇡]",
    "颜色探针：\x1b[31m红色中文\x1b[0m \x1b[1;34m蓝色粗体\x1b[0m 正常文本",
    "",
  ].join("\n");
  const payload = Array.from({ length: repeat }, (_, index) => `--- repeat ${index + 1} ---\n${source}`).join("\n");
  return new TextEncoder().encode(`${payload}\n${unicodeProbe}\n`.replace(/\n/g, "\r\n"));
};

const feedInChunks = (backend: ReturnType<typeof createTerminalBackend>, payload: Uint8Array, chunkSize: number): void => {
  for (let offset = 0; offset < payload.byteLength; offset += chunkSize) {
    backend.feed(payload.subarray(offset, offset + chunkSize));
  }
};

const countSpans = (lines: ReturnType<typeof renderStructuredBuffer>["richLines"]): number =>
  lines.reduce((sum, line) => sum + line.spans.length, 0);

const readVisibleLinesByGetLine = (backend: ReturnType<typeof createTerminalBackend>, rows: number): unknown[] => {
  const scrollback = backend.getScrollback();
  return Array.from({ length: rows }, (_, index) => backend.getLine(scrollback.viewportOffset + index));
};

const readVisibleLinesRange = (backend: ReturnType<typeof createTerminalBackend>, rows: number): unknown[] => {
  const scrollback = backend.getScrollback();
  const rangeReadable = backend as ReturnType<typeof createTerminalBackend> & {
    getLinesRange?: (startRow: number, rowCount: number) => unknown[];
  };
  return rangeReadable.getLinesRange?.(scrollback.viewportOffset, rows) ??
    Array.from({ length: rows }, (_, index) => backend.getLine(scrollback.viewportOffset + index));
};

const readViewportLines = (backend: ReturnType<typeof createTerminalBackend>, rows: number): unknown[] => {
  const viewportReadable = backend as ReturnType<typeof createTerminalBackend> & {
    getViewportLines?: () => unknown[];
  };
  return viewportReadable.getViewportLines?.() ?? readVisibleLinesRange(backend, rows);
};

const extractChinesePreview = (text: string): string[] =>
  text
    .split("\n")
    .filter((line) => line.includes("中文") || line.includes("混合探针") || line.includes("颜色探针"))
    .slice(-6);

const runOneRound = (
  backendKind: TerminalBackendKind,
  round: number,
  options: BenchmarkOptions,
  payload: Uint8Array,
): RoundResult => {
  const backend = createTerminalBackend({
    backend: backendKind,
    cols: options.cols,
    rows: options.rows,
    scrollbackLimit: options.scrollbackLimit,
  });
  try {
    const feed = time(() => feedInChunks(backend, payload, options.chunkSize));
    const text = time(() => backend.getText());
    const lines = time(() => backend.getLines());
    const visibleLines = time(() => readVisibleLinesByGetLine(backend, options.rows));
    const rangedLines = time(() => readVisibleLinesRange(backend, options.rows));
    const viewportLines = time(() => readViewportLines(backend, options.rows));
    const structured = time(() => renderStructuredBuffer({ ...backend, rows: options.rows, cols: options.cols }));
    const structuredViewport = time(() => renderStructuredViewportBuffer({ ...backend, rows: options.rows, cols: options.cols }));
    const scrollback = time(() => backend.getScrollback());
    const scroll = time(() => {
      for (let index = 0; index < options.scrollSteps; index += 1) {
        backend.scrollViewport(index % 2 === 0 ? -options.scrollDelta : options.scrollDelta);
      }
    });
    const scrollThenGetLines = time(() => backend.getLines());
    const scrollThenVisibleGetLine = time(() => readVisibleLinesByGetLine(backend, options.rows));
    const scrollThenViewportLines = time(() => readViewportLines(backend, options.rows));
    const finalScrollback = backend.getScrollback();
    return {
      backend: backendKind,
      round,
      feedMs: feed.ms,
      getTextMs: text.ms,
      getLinesMs: lines.ms,
      visibleGetLineMs: visibleLines.ms,
      getLinesRangeMs: rangedLines.ms,
      getViewportLinesMs: viewportLines.ms,
      structuredMs: structured.ms,
      structuredViewportMs: structuredViewport.ms,
      getScrollbackMs: scrollback.ms,
      scrollMs: scroll.ms,
      scrollThenGetLinesMs: scrollThenGetLines.ms,
      scrollThenVisibleGetLineMs: scrollThenVisibleGetLine.ms,
      scrollThenViewportLinesMs: scrollThenViewportLines.ms,
      textLength: text.value.length,
      rowsRead: lines.value.length,
      spanCount: countSpans(structured.value.richLines),
      scrollbackTotal: finalScrollback.totalLines,
      scrollbackViewportOffset: finalScrollback.viewportOffset,
      chinesePreview: extractChinesePreview(text.value),
    };
  } finally {
    backend.destroy();
  }
};

const printSummaryTable = (results: readonly RoundResult[]): void => {
  const rows = [...new Set(results.map((result) => result.backend))].map((backend) => {
    const subset = results.filter((result) => result.backend === backend);
    return {
      backend,
      feedMedian: summarize(subset.map((result) => result.feedMs)).medianMs,
      getTextMedian: summarize(subset.map((result) => result.getTextMs)).medianMs,
      getLinesMedian: summarize(subset.map((result) => result.getLinesMs)).medianMs,
      structuredMedian: summarize(subset.map((result) => result.structuredMs)).medianMs,
      structuredViewportMedian: summarize(subset.map((result) => result.structuredViewportMs)).medianMs,
      scrollMedian: summarize(subset.map((result) => result.scrollMs)).medianMs,
      scrollReadMedian: summarize(subset.map((result) => result.scrollThenGetLinesMs)).medianMs,
      visibleReadMedian: summarize(subset.map((result) => result.visibleGetLineMs)).medianMs,
      viewportReadMedian: summarize(subset.map((result) => result.getViewportLinesMs)).medianMs,
      scrollVisibleMedian: summarize(subset.map((result) => result.scrollThenVisibleGetLineMs)).medianMs,
      scrollViewportMedian: summarize(subset.map((result) => result.scrollThenViewportLinesMs)).medianMs,
      rowsRead: subset.at(-1)?.rowsRead ?? 0,
      spans: subset.at(-1)?.spanCount ?? 0,
      scrollbackTotal: subset.at(-1)?.scrollbackTotal ?? 0,
    };
  });
  console.table(rows);
};

const main = (): void => {
  const options = parseOptions(Bun.argv.slice(2));
  const source = readFileSync(options.sourcePath, "utf8");
  const payload = toTerminalInput(source, options.repeat);
  const results: RoundResult[] = [];

  console.log(
    JSON.stringify(
      {
        options,
        payloadBytes: payload.byteLength,
      },
      null,
      2,
    ),
  );

  for (const backend of options.backends) {
    for (let round = 1; round <= options.rounds; round += 1) {
      const result = runOneRound(backend, round, options, payload);
      results.push(result);
      console.log(JSON.stringify({ kind: "round", ...result }));
    }
  }

  printSummaryTable(results);
  console.log(
    JSON.stringify(
      {
        kind: "summary",
        metrics: Object.fromEntries(
          options.backends.map((backend) => {
            const subset = results.filter((result) => result.backend === backend);
            return [
              backend,
              {
                feedMs: summarize(subset.map((result) => result.feedMs)),
                getTextMs: summarize(subset.map((result) => result.getTextMs)),
                getLinesMs: summarize(subset.map((result) => result.getLinesMs)),
                visibleGetLineMs: summarize(subset.map((result) => result.visibleGetLineMs)),
                getLinesRangeMs: summarize(subset.map((result) => result.getLinesRangeMs)),
                getViewportLinesMs: summarize(subset.map((result) => result.getViewportLinesMs)),
                structuredMs: summarize(subset.map((result) => result.structuredMs)),
                structuredViewportMs: summarize(subset.map((result) => result.structuredViewportMs)),
                getScrollbackMs: summarize(subset.map((result) => result.getScrollbackMs)),
                scrollMs: summarize(subset.map((result) => result.scrollMs)),
                scrollThenGetLinesMs: summarize(subset.map((result) => result.scrollThenGetLinesMs)),
                scrollThenVisibleGetLineMs: summarize(subset.map((result) => result.scrollThenVisibleGetLineMs)),
                scrollThenViewportLinesMs: summarize(subset.map((result) => result.scrollThenViewportLinesMs)),
              },
            ];
          }),
        ),
        chinesePreview: Object.fromEntries(
          options.backends.map((backend) => [
            backend,
            results
              .filter((result) => result.backend === backend)
              .at(-1)?.chinesePreview ?? [],
          ]),
        ),
      },
      null,
      2,
    ),
  );
};

main();
