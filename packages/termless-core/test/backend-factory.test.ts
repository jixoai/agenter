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
});
