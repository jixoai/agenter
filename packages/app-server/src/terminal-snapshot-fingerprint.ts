import type { ManagedTerminalSnapshot } from "./managed-terminal";

const stableSnapshotStringify = (value: unknown): string => JSON.stringify(value);

export const buildTerminalViewFingerprint = (snapshot: ManagedTerminalSnapshot): string =>
  stableSnapshotStringify({
    cols: snapshot.cols,
    rows: snapshot.rows,
    cursor: snapshot.cursor,
    cursorVisible: snapshot.cursorVisible,
    lines: snapshot.lines,
    richLines: snapshot.richLines,
  });

export const buildTerminalSemanticFingerprint = (snapshot: ManagedTerminalSnapshot): string =>
  stableSnapshotStringify({
    cols: snapshot.cols,
    rows: snapshot.rows,
    lines: snapshot.lines,
    richLines: snapshot.richLines,
  });
