import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const terminalsRootRouteSource = readFileSync(
  resolve(import.meta.dirname, "../../../routes/(app)/terminals/+page.svelte"),
  "utf8",
);

describe("Feature: Terminal root route contract", () => {
  test("Scenario: Given /terminals is the live-only entrypoint When reading the source Then it redirects to the first visible live terminal or to the history index when none remain", () => {
    expect(terminalsRootRouteSource).toContain("readDismissedWorkbenchTabIds('terminals')");
    expect(terminalsRootRouteSource).toContain("controller.runtimeState.globalTerminals.data.find(");
    expect(terminalsRootRouteSource).toContain("controller.runtimeState.globalTerminalHistory.loaded");
    expect(terminalsRootRouteSource).toContain("'/terminals/history'");
    expect(terminalsRootRouteSource).toContain("'/terminals/new'");
  });
});
