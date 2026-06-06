import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const readSource = (relativePath: string): string => readFileSync(resolve(import.meta.dirname, relativePath), "utf8");

describe("Feature: Studio MCP route contract", () => {
  test("Scenario: Given the first MCP page slice When reading feature sources Then the page uses Studio workbench primitives", () => {
    const routeSource = readSource("mcp-route.svelte");
    const layoutSource = readSource("mcp-workbench-layout.svelte");

    expect(layoutSource).toContain("WorkbenchWindow");
    expect(layoutSource).toContain("label: 'MCP'");
    expect(routeSource).toContain("WorkbenchPageToolbar");
    expect(routeSource).toContain("WorkbenchPageTabs");
    expect(routeSource).toContain("WorkbenchPageContent");
    expect(routeSource).toContain("getAppControllerContext");
    expect(routeSource).toContain("McpServerList");
    expect(routeSource).toContain("McpServerDetail");
    expect(routeSource).toContain("McpNewGlobalForm");
    expect(routeSource).toContain("controller.runtimeStore.queryMcp");
    expect(routeSource).toContain("label: 'List'");
    expect(routeSource).toContain("label: 'New'");
    expect(routeSource).toContain("Runtime authority");
    expect(routeSource).toContain("No running AvatarRuntime");
    expect(routeSource).toContain("Exact-project projection");
  });

  test("Scenario: Given MCP global and project ownership When reading feature sources Then the surface keeps those projections visible", () => {
    const routeSource = readSource("mcp-route.svelte");
    const listSource = readSource("mcp-server-list.svelte");
    const detailSource = readSource("mcp-server-detail.svelte");
    const newFormSource = readSource("mcp-new-global-form.svelte");

    expect(routeSource).toContain("Exact-project projection");
    expect(routeSource).toContain("Global-only");
    expect(routeSource).toContain("mapInstalledMcpRows");
    expect(routeSource).toContain("mapEnabledMcpRows");
    expect(routeSource).toContain("mcp_installed");
    expect(routeSource).toContain("mcp_enabled");
    expect(listSource).toContain("Global config");
    expect(listSource).toContain("Exact-project projection");
    expect(listSource).toContain("Latest fact");
    expect(detailSource).toContain("Global config");
    expect(detailSource).toContain("Runtime projection matrix");
    expect(detailSource).toContain("Exact-project projection");
    expect(newFormSource).toContain("New global config");
    expect(newFormSource).toContain("Project availability");
    expect(newFormSource).toContain("01 Global config");
    expect(newFormSource).toContain("02 Project availability");
    expect(newFormSource).toContain("mcp add");
    expect(newFormSource).toContain("mcp enable");
    expect(newFormSource).toContain("onSubmit");
  });

  test("Scenario: Given MCP actions When reading feature sources Then lifecycle remove and test-call flows stay explicit", () => {
    const routeSource = readSource("mcp-route.svelte");
    const detailSource = readSource("mcp-server-detail.svelte");

    expect(routeSource).toContain("addMcpGlobal");
    expect(routeSource).toContain("enableMcpProject");
    expect(routeSource).toContain("disableMcpProject");
    expect(routeSource).toContain("startMcpProject");
    expect(routeSource).toContain("stopMcpProject");
    expect(routeSource).toContain("restartMcpProject");
    expect(routeSource).toContain("removeMcpGlobal");
    expect(routeSource).toContain("callMcpTool");
    expect(detailSource).toContain("Stop running project instances before removing");
    expect(detailSource).toContain("autoEnable is off unless explicitly selected");
    expect(detailSource).toContain("StructuredValueViewer");
  });

  test("Scenario: Given low-noise operator intent When reading MCP sources Then explanatory MCP law is collapsed into contextual help", () => {
    const routeSource = readSource("mcp-route.svelte");
    const detailSource = readSource("mcp-server-detail.svelte");
    const newFormSource = readSource("mcp-new-global-form.svelte");

    expect(routeSource).toContain("HelpHint");
    expect(detailSource).toContain("HelpHint");
    expect(newFormSource).toContain("HelpHint");
    expect(routeSource).not.toContain("What is MCP");
    expect(detailSource).not.toContain("What is MCP");
    expect(newFormSource).not.toContain("What is MCP");
    expect(detailSource).not.toContain("Introduction");
    expect(newFormSource).not.toContain("Introduction");
  });

  test("Scenario: Given Studio projects runtime MCP facts When reading MCP sources Then app-server internals stay out of the browser route", () => {
    for (const source of [
      readSource("mcp-route.svelte"),
      readSource("mcp-server-list.svelte"),
      readSource("mcp-server-detail.svelte"),
      readSource("mcp-new-global-form.svelte"),
      readSource("mcp-workbench-state.ts"),
    ]) {
      expect(source).not.toContain("@agenter/app-server");
      expect(source).not.toContain("packages/app-server/src/mcp-system");
      expect(source).not.toContain("$lib/server");
    }
  });
});
