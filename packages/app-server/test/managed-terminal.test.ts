import { describe, expect, test } from "bun:test";

import { ManagedTerminal } from "../src/managed-terminal";

describe("Feature: managed terminal lifecycle", () => {
  test("Scenario: Given missing command When starting terminal Then it fails without leaving running state", async () => {
    const terminal = new ManagedTerminal({
      terminalId: "missing-bin",
      command: ["__agenter_missing_binary__"],
      cwd: process.cwd(),
      cols: 80,
      rows: 24,
      gitLog: false,
    });

    expect(() => terminal.start()).toThrow(/failed to start terminal|Executable not found/);
    expect(terminal.isRunning()).toBe(false);

    await expect(terminal.stop()).resolves.toBeUndefined();
  });
});
