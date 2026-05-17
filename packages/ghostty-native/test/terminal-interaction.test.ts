import { describe, expect, test } from "bun:test";

import { createGhosttyNativeBackend } from "../src";

const encoder = new TextEncoder();

const lineText = (backend: ReturnType<typeof createGhosttyNativeBackend>, row: number): string =>
  backend.getLine(row).map((cell) => cell.char).join("").trimEnd();

describe("Feature: ghostty-native backend-owned terminal interaction", () => {
  test("Scenario: Given wrapped and wide terminal text When selection is copied Then text comes from Ghostty selectionString", () => {
    const backend = createGhosttyNativeBackend({ cols: 8, rows: 4, scrollbackLimit: 100 });
    try {
      backend.feed(encoder.encode("hello中文\r\nwide 🥟 ok\r\n"));

      expect(backend.selectRange({ ownerId: "terminal", startRow: 0, startCol: 0, endRow: 4, endCol: 7 })).toBe(true);
      const copied = backend.copySelection("terminal");

      expect(copied).toContain("hello中文");
      expect(copied).toContain("wide");
      expect(backend.getSelectionOverlay("terminal")?.ownership).toBe("backend-native");
    } finally {
      backend.destroy();
    }
  });

  test("Scenario: Given backend-native selection When scrollback moves Then overlay follows backend rows instead of host screen rows", () => {
    const backend = createGhosttyNativeBackend({ cols: 12, rows: 3, scrollbackLimit: 100 });
    try {
      backend.feed(encoder.encode("one\r\ntwo\r\nthree\r\n"));
      expect(backend.selectLineAt({ ownerId: "terminal", row: 1, col: 0 })).toBe(true);
      const before = backend.getSelectionOverlay("terminal");
      expect(before?.rows[0]?.row).toBe(1);
      expect(backend.copySelection("terminal")).toBe("two");

      backend.feed(encoder.encode("four\r\n"));
      const after = backend.getSelectionOverlay("terminal");

      expect(backend.copySelection("terminal")).toBe("two");
      expect(after?.rows[0]?.row).toBe(before?.rows[0]?.row);
      expect(lineText(backend, after?.rows[0]?.row ?? 0)).toContain("two");
    } finally {
      backend.destroy();
    }
  });

  test("Scenario: Given viewport is scrolled When selecting a visible row by backend coordinate Then copied text matches that visible row", () => {
    const backend = createGhosttyNativeBackend({ cols: 12, rows: 3, scrollbackLimit: 100 });
    try {
      backend.feed(encoder.encode("zero\r\none\r\ntwo\r\nthree\r\nfour\r\n"));
      backend.scrollViewport(-2);
      const scrollback = backend.getScrollback();
      const visibleTopText = lineText(backend, scrollback.viewportOffset);

      expect(scrollback.viewportOffset).toBeGreaterThan(0);
      expect(backend.selectLineAt({ ownerId: "terminal", row: scrollback.viewportOffset, col: 0 })).toBe(true);
      expect(backend.copySelection("terminal")).toBe(visibleTopText);
      expect(backend.getSelectionOverlay("terminal")?.rows[0]?.row).toBe(scrollback.viewportOffset);
    } finally {
      backend.destroy();
    }
  });

  test("Scenario: Given word and line selection requests When routed to ghostty-native Then backend APIs compute the selection", () => {
    const backend = createGhosttyNativeBackend({ cols: 20, rows: 4, scrollbackLimit: 100 });
    try {
      backend.feed(encoder.encode("alpha beta\r\nsecond line\r\n"));

      expect(backend.selectWordAt({ ownerId: "terminal", row: 0, col: 7 })).toBe(true);
      expect(backend.copySelection("terminal")).toBe("beta");

      expect(backend.selectLineAt({ ownerId: "terminal", row: 1, col: 2 })).toBe(true);
      expect(backend.copySelection("terminal")).toBe("second line");
    } finally {
      backend.destroy();
    }
  });
});
