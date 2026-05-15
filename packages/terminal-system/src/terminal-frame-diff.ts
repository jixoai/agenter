import type {
  TerminalTransportFramePayload,
  TerminalTransportFramePatch,
  TerminalTransportRichLine,
} from "@agenter/terminal-transport-protocol";
import { cloneTerminalTransportFramePayload } from "@agenter/terminal-transport-protocol";

import type { ManagedTerminalSnapshot } from "./managed-terminal";

export type {
  TerminalTransportFramePayload,
  TerminalTransportFramePatch,
} from "@agenter/terminal-transport-protocol";

const textEncoder = new TextEncoder();

const cloneRichLine = (line: TerminalTransportRichLine): TerminalTransportRichLine => ({
  spans: line.spans.map((span) => ({ ...span })),
});

export const cloneTerminalFramePayload = cloneTerminalTransportFramePayload;

export const terminalSnapshotToFramePayload = (snapshot: ManagedTerminalSnapshot): TerminalTransportFramePayload => ({
  seq: snapshot.seq,
  timestamp: snapshot.timestamp,
  cols: snapshot.cols,
  rows: snapshot.rows,
  lines: [...snapshot.lines],
  richLines: snapshot.richLines?.map(cloneRichLine),
  cursor: { ...snapshot.cursor },
  scrollback: { ...snapshot.scrollback },
});

export const projectTerminalSnapshotFramePayload = (
  snapshot: ManagedTerminalSnapshot,
  input: {
    cols?: number;
    rows?: number;
    viewportStart?: number;
  },
): TerminalTransportFramePayload => {
  const requestedRows = Math.max(1, Math.trunc(input.rows ?? snapshot.rows));
  const requestedCols = Math.max(1, Math.trunc(input.cols ?? snapshot.cols));
  const advertisedTotalLines = Math.max(
    snapshot.scrollback.totalLines,
    snapshot.scrollback.viewportOffset + requestedRows,
    snapshot.lines.length,
    requestedRows,
  );
  const requestedViewportStart =
    typeof input.viewportStart === "number"
      ? Math.max(0, Math.trunc(input.viewportStart))
      : Math.max(0, Math.trunc(snapshot.scrollback.viewportOffset));
  const carriesFullScrollback =
    snapshot.lines.length > requestedRows && requestedViewportStart + requestedRows <= snapshot.lines.length;
  const carriesBackendViewport =
    !carriesFullScrollback &&
    snapshot.scrollback.totalLines > snapshot.lines.length &&
    snapshot.scrollback.screenLines <= snapshot.lines.length &&
    requestedViewportStart >= snapshot.scrollback.viewportOffset &&
    requestedViewportStart < snapshot.scrollback.viewportOffset + snapshot.lines.length;
  const totalLines = carriesFullScrollback || carriesBackendViewport
    ? Math.max(advertisedTotalLines, snapshot.lines.length)
    : Math.max(snapshot.lines.length, requestedRows);
  const maxStart = Math.max(0, totalLines - requestedRows);
  const viewportStart = carriesFullScrollback || carriesBackendViewport
    ? Math.max(0, Math.min(maxStart, requestedViewportStart))
    : 0;
  const sourceStart = carriesFullScrollback
    ? viewportStart
    : carriesBackendViewport
      ? Math.max(0, viewportStart - snapshot.scrollback.viewportOffset)
      : 0;
  const end = Math.min(snapshot.lines.length, sourceStart + requestedRows);
  const visibleLines = snapshot.lines.slice(sourceStart, end);
  const visibleRichLines = snapshot.richLines?.slice(sourceStart, end).map(cloneRichLine);
  while (visibleLines.length < requestedRows) {
    visibleLines.push("");
  }
  if (visibleRichLines) {
    while (visibleRichLines.length < requestedRows) {
      visibleRichLines.push({ spans: [] });
    }
  }
  const cursorLocalY = carriesFullScrollback || carriesBackendViewport
    ? snapshot.cursor.y - viewportStart
    : snapshot.cursor.y;
  return {
    seq: snapshot.seq,
    timestamp: snapshot.timestamp,
    cols: requestedCols,
    rows: requestedRows,
    lines: visibleLines,
    richLines: visibleRichLines,
    cursor: {
      x: Math.max(0, Math.min(Math.max(0, requestedCols - 1), snapshot.cursor.x)),
      y: Math.max(0, cursorLocalY),
      visible: (snapshot.cursor.visible ?? true) && cursorLocalY >= 0 && cursorLocalY < requestedRows,
    },
    scrollback: {
      viewportOffset: viewportStart,
      totalLines,
      screenLines: requestedRows,
    },
  };
};

const encodedBytes = (value: unknown): number => textEncoder.encode(JSON.stringify(value)).byteLength;

const richLineKey = (line: TerminalTransportRichLine | undefined): string =>
  JSON.stringify(
    line?.spans.map((span) => [
      span.text,
      span.fg ?? "",
      span.bg ?? "",
      span.bold === true,
      span.underline === true,
      span.inverse === true,
    ]) ?? [],
  );

const rowKey = (frame: TerminalTransportFramePayload, row: number): string =>
  `${frame.lines[row] ?? ""}\u0000${richLineKey(frame.richLines?.[row])}`;

const rowPatchFor = (frame: TerminalTransportFramePayload, row: number) => ({
  row,
  line: frame.lines[row] ?? "",
  richLine: frame.richLines?.[row] ? cloneRichLine(frame.richLines[row]) : undefined,
});

const buildRowsPatch = (
  base: TerminalTransportFramePayload,
  current: TerminalTransportFramePayload,
): TerminalTransportFramePatch => ({
  type: "rows",
  baseFrameSeq: base.seq,
  rowPatches: current.lines
    .map((_, row) => (rowKey(base, row) === rowKey(current, row) ? null : rowPatchFor(current, row)))
    .filter((patch): patch is NonNullable<typeof patch> => patch !== null),
  cols: current.cols,
  rows: current.rows,
  cursor: { ...current.cursor },
  scrollback: { ...current.scrollback },
  timestamp: current.timestamp,
});

const findScrollDelta = (
  base: TerminalTransportFramePayload,
  current: TerminalTransportFramePayload,
): number | null => {
  const rowCount = Math.min(base.lines.length, current.lines.length);
  if (rowCount < 2) {
    return null;
  }
  const maxDelta = Math.min(rowCount - 1, Math.max(1, Math.floor(rowCount / 2)));
  let best: { delta: number; matches: number } | null = null;
  for (let delta = -maxDelta; delta <= maxDelta; delta += 1) {
    if (delta === 0) {
      continue;
    }
    let matches = 0;
    for (let currentRow = 0; currentRow < rowCount; currentRow += 1) {
      const baseRow = currentRow + delta;
      if (baseRow < 0 || baseRow >= rowCount) {
        continue;
      }
      if (rowKey(base, baseRow) === rowKey(current, currentRow)) {
        matches += 1;
      }
    }
    if (!best || matches > best.matches) {
      best = { delta, matches };
    }
  }
  if (!best || best.matches < Math.ceil(rowCount * 0.6)) {
    return null;
  }
  return best.delta;
};

const buildScrollRowsPatch = (
  base: TerminalTransportFramePayload,
  current: TerminalTransportFramePayload,
  deltaRows: number,
): TerminalTransportFramePatch | null => {
  if (deltaRows === 0) {
    return null;
  }
  const insertedLines =
    deltaRows > 0 ? current.lines.slice(-deltaRows) : current.lines.slice(0, Math.abs(deltaRows));
  const insertedRichLines =
    current.richLines && base.richLines
      ? deltaRows > 0
        ? current.richLines.slice(-deltaRows).map(cloneRichLine)
        : current.richLines.slice(0, Math.abs(deltaRows)).map(cloneRichLine)
      : undefined;
  return {
    type: "scrollRows",
    baseFrameSeq: base.seq,
    deltaRows,
    insertedLines,
    insertedRichLines,
    cols: current.cols,
    rows: current.rows,
    cursor: { ...current.cursor },
    scrollback: { ...current.scrollback },
    timestamp: current.timestamp,
  };
};

export const chooseTerminalFramePatch = (input: {
  baseFrame: TerminalTransportFramePayload | null;
  currentFrame: TerminalTransportFramePayload;
  lastAppliedFrameSeq: number;
  maxPatchBytes?: number;
}): TerminalTransportFramePatch => {
  const fullPatch: TerminalTransportFramePatch = {
    type: "full",
    frame: cloneTerminalTransportFramePayload(input.currentFrame),
  };
  const fullBytes = encodedBytes(fullPatch);
  const maxPatchBytes = input.maxPatchBytes ?? Number.POSITIVE_INFINITY;
  const base = input.baseFrame;
  if (
    !base ||
    base.seq !== input.lastAppliedFrameSeq ||
    base.cols !== input.currentFrame.cols ||
    base.rows !== input.currentFrame.rows ||
    base.scrollback.viewportOffset !== input.currentFrame.scrollback.viewportOffset ||
    base.scrollback.totalLines !== input.currentFrame.scrollback.totalLines ||
    base.scrollback.screenLines !== input.currentFrame.scrollback.screenLines ||
    base.lines.length !== input.currentFrame.lines.length ||
    Boolean(base.richLines) !== Boolean(input.currentFrame.richLines)
  ) {
    return fullPatch;
  }

  const candidates: TerminalTransportFramePatch[] = [buildRowsPatch(base, input.currentFrame)];
  const scrollDelta = findScrollDelta(base, input.currentFrame);
  if (scrollDelta !== null) {
    const scrollPatch = buildScrollRowsPatch(base, input.currentFrame, scrollDelta);
    if (scrollPatch) {
      candidates.push(scrollPatch);
    }
  }
  const best = candidates.reduce((left, right) => (encodedBytes(right) < encodedBytes(left) ? right : left));
  const bestBytes = encodedBytes(best);
  if (bestBytes >= fullBytes || bestBytes > maxPatchBytes) {
    return fullPatch;
  }
  return best;
};
