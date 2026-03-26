import { describe, expect, test } from "bun:test";

import { buildTerminalSemanticFingerprint, buildTerminalViewFingerprint } from "../src/terminal-snapshot-fingerprint";

describe("Feature: terminal snapshot fingerprints", () => {
  test("Scenario: Given a snapshot fingerprint When it is generated Then the runtime stores a compact sha256 digest instead of raw snapshot JSON", () => {
    const snapshot = {
      seq: 42,
      timestamp: 1_741_234_567_890,
      cols: 80,
      rows: 24,
      cursor: { x: 1, y: 23 },
      cursorVisible: true,
      lines: Array.from({ length: 24 }, (_, index) => `line-${index}`),
      richLines: Array.from({ length: 24 }, (_, index) => ({
        spans: [{ text: `line-${index}`, bold: false, underline: false, inverse: false }],
      })),
    };

    const viewHash = buildTerminalViewFingerprint(snapshot);
    const semanticHash = buildTerminalSemanticFingerprint(snapshot);

    expect(viewHash).toMatch(/^[0-9a-f]{64}$/);
    expect(semanticHash).toMatch(/^[0-9a-f]{64}$/);
    expect(viewHash).not.toContain("line-0");
    expect(semanticHash).not.toContain("line-0");
  });
});
