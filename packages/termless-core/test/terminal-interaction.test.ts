import { describe, expect, test } from "bun:test";

import {
  TERMINAL_INTERACTION_HOST_PROJECTION_ONLY,
  TERMINAL_INTERACTION_UNAVAILABLE,
  createBackendInteractionAdapter,
  createTerminalInteractionCapabilities,
  isBackendOwnedTerminalInteraction,
  type Cell,
  type TerminalInteractionReadable,
} from "../src";

const emptyCell = (char: string): Cell => ({
  char,
  fg: null,
  bg: null,
  bold: false,
  dim: false,
  italic: false,
  underline: false,
  underlineColor: null,
  strikethrough: false,
  inverse: false,
  blink: false,
  hidden: false,
  wide: Bun.stringWidth(char) > 1,
  continuation: false,
  hyperlink: null,
});

const createReadable = (lines: string[]): TerminalInteractionReadable => ({
  getLine(row) {
    return Array.from(lines[row] ?? "").map(emptyCell);
  },
  getScrollback() {
    return {
      viewportOffset: 0,
      totalLines: lines.length,
      screenLines: lines.length,
    };
  },
});

describe("Feature: backend-owned terminal interaction capability facts", () => {
  test("Scenario: Given capability facts When checking ownership Then native adapter unavailable and host projection-only are not conflated", () => {
    const native = createTerminalInteractionCapabilities("backend-native");
    const adapter = createTerminalInteractionCapabilities("backend-adapter-owned");

    expect(isBackendOwnedTerminalInteraction(native)).toBe(true);
    expect(native).toMatchObject({
      ownership: "backend-native",
      selection: true,
      copy: true,
      semanticSelection: true,
      overlay: true,
    });
    expect(isBackendOwnedTerminalInteraction(adapter)).toBe(true);
    expect(adapter).toMatchObject({
      ownership: "backend-adapter-owned",
      selection: true,
      copy: true,
      semanticSelection: true,
      overlay: true,
    });
    expect(isBackendOwnedTerminalInteraction(TERMINAL_INTERACTION_UNAVAILABLE)).toBe(false);
    expect(TERMINAL_INTERACTION_UNAVAILABLE.copy).toBe(false);
    expect(isBackendOwnedTerminalInteraction(TERMINAL_INTERACTION_HOST_PROJECTION_ONLY)).toBe(false);
    expect(TERMINAL_INTERACTION_HOST_PROJECTION_ONLY.selection).toBe(false);
  });

  test("Scenario: Given a backend-adapter owner When selecting CJK emoji and wrapped rows Then text and overlay stay in backend coordinates", () => {
    const adapter = createBackendInteractionAdapter({
      ownerId: "dialogue",
      readable: createReadable(["$ echo 你好world ok", "emoji 🥟 done", "tail"]),
    });

    expect(adapter.selectWordAt({ ownerId: "dialogue", row: 0, col: 8 })).toBe(true);
    expect(adapter.copySelection("dialogue")).toBe("你好");
    expect(adapter.getSelectionOverlay("dialogue")).toEqual({
      ownerId: "dialogue",
      ownership: "backend-adapter-owned",
      rows: [{ row: 0, startCol: 7, endCol: 11 }],
      selectedText: "你好",
    });

    expect(adapter.selectRange({ ownerId: "dialogue", startRow: 1, startCol: 6, endRow: 2, endCol: 4 })).toBe(true);
    expect(adapter.copySelection("dialogue")).toBe("🥟 done\ntail");
    expect(adapter.getSelectionOverlay("dialogue")?.rows).toEqual([
      { row: 1, startCol: 6, endCol: 13 },
      { row: 2, startCol: 0, endCol: 4 },
    ]);
  });

  test("Scenario: Given a bounded owner When another owner requests selection Then the adapter refuses to leak text or overlay", () => {
    const adapter = createBackendInteractionAdapter({
      ownerId: "shell",
      readable: createReadable(["shell secret"]),
    });

    expect(adapter.selectLineAt({ ownerId: "dialogue", row: 0, col: 0 })).toBe(false);
    expect(adapter.copySelection("dialogue")).toBe("");
    expect(adapter.getSelectionOverlay("dialogue")).toBeNull();

    expect(adapter.selectLineAt({ ownerId: "shell", row: 0, col: 0 })).toBe(true);
    expect(adapter.copySelection("shell")).toBe("shell secret");
    expect(adapter.copySelection("dialogue")).toBe("");
  });
});
