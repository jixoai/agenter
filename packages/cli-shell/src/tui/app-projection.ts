import type { GlobalTerminalEntry } from "@agenter/client-sdk";
import type { TerminalRenderRichLine } from "@agenter/termless-core";

import type { CliShellComposedSurfaceState } from "./types";

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

const readComposedMetadataString = (
  entry: GlobalTerminalEntry | null,
  key:
    | "composedBottomLine"
    | "composedDialogueDraft"
    | "composedManagedLabel"
    | "composedUnreadLabel"
    | "composedHeartbeatLabel",
): string | null => {
  const value = entry?.metadata?.[key];
  return typeof value === "string" ? value : null;
};

const readComposedMetadataPlacement = (
  entry: GlobalTerminalEntry | null,
): "left" | "right" | "floating" | null => {
  const value = entry?.metadata?.composedDialoguePlacement;
  return value === "left" || value === "right" || value === "floating" ? value : null;
};

const readComposedMetadataShellSnapshotSeq = (
  entry: GlobalTerminalEntry | null,
  fallback: number,
): number => {
  const value = entry?.metadata?.composedShellSnapshotSeq;
  return typeof value === "number" && Number.isInteger(value) ? value : fallback;
};

const hasExplicitComposedMetadata = (entry: GlobalTerminalEntry | null): boolean =>
  entry?.metadata?.composedDialogueOpen === true ||
  typeof entry?.metadata?.composedDialoguePlacement === "string" ||
  typeof entry?.metadata?.composedDialogueDraft === "string" ||
  typeof entry?.metadata?.composedBottomLine === "string" ||
  typeof entry?.metadata?.composedManagedLabel === "string" ||
  typeof entry?.metadata?.composedUnreadLabel === "string" ||
  typeof entry?.metadata?.composedHeartbeatLabel === "string" ||
  typeof entry?.metadata?.composedShellSnapshotSeq === "number";

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
    bottomLine: readComposedMetadataString(entry, "composedBottomLine") ?? snapshot.lines.at(-1) ?? "",
    dialogueOpen: entry.metadata?.composedDialogueOpen === true,
    dialoguePlacement: readComposedMetadataPlacement(entry),
    dialogueDraft: readComposedMetadataString(entry, "composedDialogueDraft") ?? "",
    managedLabel: readComposedMetadataString(entry, "composedManagedLabel") ?? "",
    unreadLabel: readComposedMetadataString(entry, "composedUnreadLabel") ?? "",
    heartbeatLabel: readComposedMetadataString(entry, "composedHeartbeatLabel") ?? "",
    terminalLines: [...snapshot.lines],
    terminalRichLines:
      snapshot.richLines?.map((line) => ({
        spans: line.spans.map((span) => ({ ...span })),
      })) ?? undefined,
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
  ].join("\u001f");

export const richLinesFromComposedSurface = (surface: CliShellComposedSurfaceState): TerminalRenderRichLine[] =>
  surface.terminalRichLines?.map((line) => ({
    spans: line.spans.map((span) => ({ ...span })),
  })) ??
  surface.terminalLines.map((text) => ({
    spans: text.length > 0 ? [{ text }] : [],
  }));
