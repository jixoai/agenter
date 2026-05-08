import { createHash } from "node:crypto";

import type { ManagedTerminalSnapshot } from "./managed-terminal";

const stableSnapshotStringify = (value: unknown): string => JSON.stringify(value);

const buildFingerprint = (value: unknown): string => createHash("sha256").update(stableSnapshotStringify(value)).digest("hex");

export const buildTerminalViewFingerprint = (snapshot: ManagedTerminalSnapshot): string =>
  buildFingerprint({
    cols: snapshot.cols,
    rows: snapshot.rows,
    cursor: snapshot.cursor,
    scrollback: snapshot.scrollback,
    lines: snapshot.lines,
    richLines: snapshot.richLines,
  });

export const buildTerminalSemanticFingerprint = (snapshot: ManagedTerminalSnapshot): string =>
  buildFingerprint({
    cols: snapshot.cols,
    rows: snapshot.rows,
    lines: snapshot.lines,
    richLines: snapshot.richLines,
  });
