import { describe, expect, test } from "bun:test";

import type { ManagedTerminalSnapshot } from "../src/managed-terminal";
import { buildTerminalSemanticFingerprint, buildTerminalViewFingerprint } from "../src/terminal-snapshot-fingerprint";

const createSnapshot = (overrides: Partial<ManagedTerminalSnapshot> = {}): ManagedTerminalSnapshot => ({
  seq: overrides.seq ?? 1,
  timestamp: overrides.timestamp ?? Date.now(),
  cols: overrides.cols ?? 80,
  rows: overrides.rows ?? 24,
  lines: overrides.lines ?? ["$ echo hi", "hi"],
  richLines: overrides.richLines ?? [{ spans: [] }, { spans: [] }],
  cursor: overrides.cursor ?? { x: 0, y: 1 },
  cursorVisible: overrides.cursorVisible ?? true,
});

describe("Feature: terminal snapshot semantic fingerprint", () => {
  test("Scenario: Given only cursor metadata changes When building fingerprints Then view changes but semantic fingerprint stays stable", () => {
    const base = createSnapshot();
    const next = createSnapshot({
      seq: 2,
      timestamp: base.timestamp + 50,
      cursor: { x: 4, y: 1 },
      cursorVisible: false,
    });

    expect(buildTerminalViewFingerprint(next)).not.toBe(buildTerminalViewFingerprint(base));
    expect(buildTerminalSemanticFingerprint(next)).toBe(buildTerminalSemanticFingerprint(base));
  });

  test("Scenario: Given terminal content changes When building semantic fingerprint Then the loopbus-visible fingerprint changes", () => {
    const base = createSnapshot();
    const next = createSnapshot({
      seq: 2,
      lines: ["$ echo hi", "hi", "$"],
      richLines: [{ spans: [] }, { spans: [] }, { spans: [] }],
    });

    expect(buildTerminalSemanticFingerprint(next)).not.toBe(buildTerminalSemanticFingerprint(base));
  });
});
