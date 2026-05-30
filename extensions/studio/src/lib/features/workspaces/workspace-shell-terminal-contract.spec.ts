import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const workspaceShellTerminalSource = readFileSync(
  resolve(import.meta.dirname, "workspace-shell-terminal.svelte"),
  "utf8",
);

describe("Feature: Workspace shell terminal contract", () => {
  test("Scenario: Given shell output can exceed one mobile viewport When reading the terminal source Then WTerm keeps scrollback ownership while the shell only supplies geometry", () => {
    expect(workspaceShellTerminalSource).toContain("resolveTerminalGeometry(currentShell, currentHost");
    expect(workspaceShellTerminalSource).toContain("resizeObserver.observe(currentShell)");
    expect(workspaceShellTerminalSource).toContain("overflow-x: auto;");
    expect(workspaceShellTerminalSource).not.toContain("overflow-y: auto !important;");
    expect(workspaceShellTerminalSource).toContain("overscroll-behavior-x: contain;");
    expect(workspaceShellTerminalSource).toContain("overscroll-behavior-y: contain;");
    expect(workspaceShellTerminalSource).toContain("scrollbar-gutter: stable both-edges;");
    expect(workspaceShellTerminalSource).toContain("-webkit-overflow-scrolling: touch;");
    expect(workspaceShellTerminalSource).toContain("touch-action: pinch-zoom pan-x pan-y;");
    expect(workspaceShellTerminalSource).toContain("resolveTerminalViewportSize(shellElement)");
    expect(workspaceShellTerminalSource).toContain("resolveTerminalViewportFrame(shellElement)");
    expect(workspaceShellTerminalSource).toContain("parentElement.dataset.layoutRole === 'clip-surface'");
    expect(workspaceShellTerminalSource).toContain("resizeObserver.observe(viewportFrame)");
    expect(workspaceShellTerminalSource).toContain("height: 100% !important;");
    expect(workspaceShellTerminalSource).toContain("padding: 0;");
    expect(workspaceShellTerminalSource).toContain("padding: 0.9rem 1rem max(1.1rem, var(--term-row-height));");
    expect(workspaceShellTerminalSource).not.toContain("block-size: 100% !important;");
    expect(workspaceShellTerminalSource).not.toContain("max-block-size: 100% !important;");
    expect(workspaceShellTerminalSource).toContain("inline-size: max-content;");
    expect(workspaceShellTerminalSource).toContain("--workspace-shell-terminal-grid-min-inline-size");
    expect(workspaceShellTerminalSource).toContain("MIN_WORKSPACE_SHELL_TERMINAL_COLUMNS = 80");
    expect(workspaceShellTerminalSource).toContain("white-space: pre;");
    expect(workspaceShellTerminalSource).toContain("radial-gradient(circle at 18% 0%");
    expect(workspaceShellTerminalSource).toContain("--term-brightBlue");
  });

  test("Scenario: Given WTerm already owns DOM rendering and input internals When reading the terminal source Then the shell uses the shared renderer adapter instead of hand-rolling renderer internals", () => {
    expect(workspaceShellTerminalSource).toContain("wtermRendererAdapter.createSession");
    expect(workspaceShellTerminalSource).toContain("TerminalRendererSession");
    expect(workspaceShellTerminalSource).not.toContain("new Renderer");
    expect(workspaceShellTerminalSource).not.toContain("new InputHandler");
    expect(workspaceShellTerminalSource).not.toContain("className = 'term-grid'");
  });
});
