import type { GlobalTerminalEntry } from "@agenter/client-sdk";
import type { TerminalRenderRichLine } from "@agenter/termless-core";

import type { CliShellComposedSurfaceState, CliShellSelectionSourceDescriptor } from "./types";

export const cloneSnapshotRichLines = (
  snapshot: NonNullable<GlobalTerminalEntry["snapshot"]>["richLines"],
): TerminalRenderRichLine[] =>
  snapshot?.map((line) => ({
    spans: line.spans.map((span) => ({ ...span })),
  })) ?? [];

export const resolveSnapshotRichLines = (
  snapshot: GlobalTerminalEntry["snapshot"] | null | undefined,
): TerminalRenderRichLine[] => {
  if (!snapshot) {
    return [];
  }
  if (snapshot.richLines && snapshot.richLines.length > 0) {
    return cloneSnapshotRichLines(snapshot.richLines);
  }
  return snapshot.lines.map((text) => ({
    spans: text.length > 0 ? [{ text }] : [],
  }));
};

const readComposedMetadataShellSnapshotSeq = (
  entry: GlobalTerminalEntry | null,
  fallback: number,
): number => {
  const value = entry?.metadata?.composedFrameSeq;
  return typeof value === "number" && Number.isInteger(value) ? value : fallback;
};

const hasExplicitComposedMetadata = (entry: GlobalTerminalEntry | null): boolean =>
  typeof entry?.metadata?.composedFrameSeq === "number" ||
  typeof entry?.metadata?.composedFrameMetadata === "object" ||
  Array.isArray(entry?.metadata?.composedSelectionSources);

const readComposedSelectionSource = (
  source: unknown,
): CliShellSelectionSourceDescriptor | null => {
  if (!source || typeof source !== "object") {
    return null;
  }
  const record = source as {
    owner?: unknown;
    row?: unknown;
    col?: unknown;
    width?: unknown;
    height?: unknown;
    sourceStartRow?: unknown;
  };
  if (
    (record.owner !== "terminal" && record.owner !== "dialogue") ||
    typeof record.row !== "number" ||
    typeof record.col !== "number" ||
    typeof record.width !== "number" ||
    typeof record.height !== "number"
  ) {
    return null;
  }
  return {
    owner: record.owner,
    row: record.row,
    col: record.col,
    width: record.width,
    height: record.height,
    sourceStartRow: typeof record.sourceStartRow === "number" ? record.sourceStartRow : undefined,
  };
};

export const snapshotsShareVisibleBody = (
  left: GlobalTerminalEntry["snapshot"] | null | undefined,
  right: GlobalTerminalEntry["snapshot"] | null | undefined,
): boolean => {
  if (!left || !right) {
    return false;
  }
  if (left.lines.length !== right.lines.length) {
    return false;
  }
  return left.lines.every((line, index) => line === right.lines[index]);
};

export const resolvePublishedComposedSurface = (input: {
  terminalEntry: GlobalTerminalEntry | null;
  shellSnapshotSeqFallback: number;
}): { surface: CliShellComposedSurfaceState | null; hasPublishedTruth: boolean } => {
  const entry = input.terminalEntry;
  const snapshot = entry?.snapshot;
  const shellTerminalId =
    typeof entry?.metadata?.composedShellTerminalId === "string"
      ? entry.metadata.composedShellTerminalId
      : null;
  if (!entry || !snapshot || !shellTerminalId) {
    return {
      surface: null,
      hasPublishedTruth: false,
    };
  }
  const surface: CliShellComposedSurfaceState = {
    shellTerminalId,
    terminalId: entry.terminalId,
    shellSnapshotSeq: readComposedMetadataShellSnapshotSeq(entry, input.shellSnapshotSeqFallback),
    cols: snapshot.cols,
    rows: snapshot.rows,
    bottomLine: snapshot.lines.at(-1) ?? "",
    dialogueOpen: false,
    dialoguePlacement: null,
    dialogueDraft: "",
    managedLabel: "",
    unreadLabel: "",
    heartbeatLabel: "",
    terminalLines: [...snapshot.lines],
    terminalRichLines:
      snapshot.richLines?.map((line) => ({
        spans: line.spans.map((span) => ({ ...span })),
      })) ?? undefined,
    selectionSources: Array.isArray(entry.metadata?.composedSelectionSources)
      ? entry.metadata.composedSelectionSources.flatMap((source) => {
          const selectionSource = readComposedSelectionSource(source);
          return selectionSource ? [selectionSource] : [];
        })
      : undefined,
    cursor: { ...snapshot.cursor },
    scrollback: { ...snapshot.scrollback },
  };
  return {
    surface,
    hasPublishedTruth: hasExplicitComposedMetadata(input.terminalEntry),
  };
};

export const resolveComposedSurfaceKey = (surface: CliShellComposedSurfaceState): string =>
  [
    surface.terminalId,
    surface.shellTerminalId,
    surface.shellSnapshotSeq,
    surface.cols,
    surface.rows,
    surface.dialogueOpen ? "1" : "0",
    surface.dialoguePlacement ?? "",
    surface.dialogueDraft,
    surface.bottomLine,
    surface.managedLabel,
    surface.unreadLabel,
    surface.heartbeatLabel,
    surface.cursor.x,
    surface.cursor.y,
    surface.cursor.visible ? "1" : "0",
    surface.scrollback.viewportOffset,
    surface.scrollback.totalLines,
    surface.scrollback.screenLines,
    surface.selectionSources?.map((source) => [
      source.owner,
      source.row,
      source.col,
      source.width,
      source.height,
      source.sourceStartRow ?? "",
    ].join(",")).join("|") ?? "",
  ].join("\u001f");

export const richLinesFromComposedSurface = (surface: CliShellComposedSurfaceState): TerminalRenderRichLine[] =>
  surface.terminalRichLines?.map((line) => ({
    spans: line.spans.map((span) => ({ ...span })),
  })) ??
  surface.terminalLines.map((text) => ({
    spans: text.length > 0 ? [{ text }] : [],
  }));
