import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "bun:test";

const readSource = (relativePath: string): string =>
  readFileSync(resolve(import.meta.dirname, "../src", relativePath), "utf8");

const terminalSemanticTokens = [
  "createTerminalHostInputController",
  "selectWordAt",
  "selectLineAt",
  "selectRange",
  "startSelection",
  "updateSelection",
  "endSelection",
] as const;

describe("Feature: shell-next terminal input ownership boundary", () => {
  test("Scenario: Given ShellNextApp handles product keys When auditing source Then terminal input semantics stay below the app layer", () => {
    const appSource = readSource("app/shell-next-app.ts");

    for (const token of terminalSemanticTokens) {
      expect(appSource).not.toContain(token);
    }
    expect(appSource).toContain("#handleTerminalKeypress");
    expect(appSource).toContain("source.handleKey?.(key)");
  });

  test("Scenario: Given terminal frame code handles mouse events When auditing source Then it only forwards terminal pointer intent", () => {
    const paneSource = readSource("terminal-projection/framebuffer-terminal-pane.ts");
    const terminalViewSource = readSource("opencompose/terminal-frame/terminal-view-renderable.ts");

    expect(paneSource).not.toContain("createTerminalHostInputController");
    expect(terminalViewSource).not.toContain("createTerminalHostInputController");
    expect(paneSource).toContain("pointerDown: (input) => this.#source.pointerDown?.(input)");
    expect(paneSource).toContain("pointerDrag: (input) => this.#source.pointerDrag?.(input)");
    expect(paneSource).toContain("pointerUp: (input) => this.#handlePointerUp(input)");
  });

  test("Scenario: Given terminal sources own backend input When auditing source Then host input controllers live in those sources", () => {
    for (const relativePath of [
      "sources/bun-terminal-protocol-source.ts",
      "sources/shell-next-live-terminal-source.ts",
    ]) {
      const source = readSource(relativePath);
      expect(source).toContain("createTerminalHostInputController");
      expect(source).toContain("#hostInput.handleKey");
      expect(source).toContain("#hostInput.handlePointerDown");
      expect(source).toContain("#hostInput.handlePointerDrag");
      expect(source).toContain("#hostInput.handlePointerUp");
    }
  });
});
