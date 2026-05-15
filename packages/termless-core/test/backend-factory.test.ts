import { describe, expect, test } from "bun:test";

import {
  assertTerminalBackendKind,
  createTerminalBackend,
  DEFAULT_TERMINAL_BACKEND,
} from "../src";

describe("Feature: termless backend factory", () => {
  test("Scenario: Given omitted backend When creating a backend Then xterm remains the default launch truth", () => {
    const backend = createTerminalBackend({
      cols: 80,
      rows: 24,
      scrollbackLimit: 1_000,
    });

    backend.feed(new TextEncoder().encode("default backend\r\n"));
    expect(DEFAULT_TERMINAL_BACKEND).toBe("xterm");
    expect(backend.getText()).toContain("default backend");
    backend.destroy();
  });

  test("Scenario: Given an unsupported backend token When asserting backend kind Then the factory rejects it before launch", () => {
    expect(() => assertTerminalBackendKind("ghostty-web")).toThrow("unsupported terminal backend");
  });

  test("Scenario: Given a backend supports viewport reads When reading range and viewport lines Then callers can avoid full scrollback export", () => {
    const backend = createTerminalBackend({
      cols: 40,
      rows: 4,
      scrollbackLimit: 1_000,
    });

    backend.feed(new TextEncoder().encode("one\r\ntwo\r\nthree\r\nfour\r\nfive\r\nsix\r\n"));
    const scrollback = backend.getScrollback();
    const ranged = backend.getLinesRange(scrollback.viewportOffset, backend.getScrollback().screenLines);
    const viewport = backend.getViewportLines();

    expect(ranged).toHaveLength(4);
    expect(viewport).toHaveLength(4);
    expect(ranged.map((line) => line.map((cell) => cell.char).join("").trimEnd())).toEqual(
      viewport.map((line) => line.map((cell) => cell.char).join("").trimEnd()),
    );
    backend.destroy();
  });
});
