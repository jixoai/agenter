import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const terminalHistoryRouteSource = readFileSync(resolve(import.meta.dirname, "terminal-history-route.svelte"), "utf8");

describe("Feature: Terminal history index route contract", () => {
  test("Scenario: Given the history route now doubles as the index When reading the source Then live and killed terminals use a compact list-detail layout", () => {
    expect(terminalHistoryRouteSource).toContain("const liveHistoryTerminals = $derived(");
    expect(terminalHistoryRouteSource).toContain("const killedHistoryTerminals = $derived(");
    expect(terminalHistoryRouteSource).toContain("const selectedTerminal = $derived(");
    expect(terminalHistoryRouteSource).toContain("terminal.processPhase !== 'killed'");
    expect(terminalHistoryRouteSource).toContain("terminal.processPhase === 'killed'");
    expect(terminalHistoryRouteSource).toContain("<WorkbenchSplitDetailHost");
    expect(terminalHistoryRouteSource).toContain('viewportTestId="terminal-history-list-viewport"');
    expect(terminalHistoryRouteSource).toContain('viewportTestId="terminal-history-detail-viewport"');
    expect(terminalHistoryRouteSource).toContain("selectTerminal(terminal.terminalId)");
    expect(terminalHistoryRouteSource).toContain("Open detail");
    expect(terminalHistoryRouteSource).toContain("Archive");
    expect(terminalHistoryRouteSource).toContain("Delete");
  });
});
