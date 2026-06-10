import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const readSource = (relativePath: string): string => readFileSync(resolve(import.meta.dirname, relativePath), "utf8");

describe("Feature: Studio MCP route contract", () => {
  test("Scenario: Given the MCP route When reading feature sources Then page tabs express configs and avatars", () => {
    const routeSource = readSource("mcp-route.svelte");
    const layoutSource = readSource("mcp-workbench-layout.svelte");

    expect(layoutSource).toContain("WorkbenchWindow");
    expect(layoutSource).toContain("label: 'MCP'");
    expect(routeSource).toContain("WorkbenchPageToolbar");
    expect(routeSource).toContain("WorkbenchPageTabs");
    expect(routeSource).toContain("WorkbenchPageContent");
    expect(routeSource).toContain("McpConfigList");
    expect(routeSource).toContain("McpAvatarOverview");
    expect(routeSource).toContain("label: 'Configs'");
    expect(routeSource).toContain("label: 'Avatars'");
  });

  test("Scenario: Given config ownership When reading feature sources Then install and exact-project actions stay on separate surfaces", () => {
    const routeSource = readSource("mcp-route.svelte");
    const configListSource = readSource("mcp-config-list.svelte");
    const configDetailSource = readSource("mcp-config-detail.svelte");
    const newFormSource = readSource("mcp-new-global-form.svelte");
    const inspectSource = readSource("mcp-config-inspect-panel.svelte");
    const appPreviewSource = readSource("mcp-app-resource-preview.svelte");
    const stateSource = readSource("mcp-workbench-state.ts");

    expect(routeSource).toContain("mcp_installed");
    expect(routeSource).toContain("mcp_enabled");
    expect(routeSource).toContain("buildMcpConfigCatalogRows");
    expect(routeSource).toContain("buildMcpConfigSelectionKey");
    expect(routeSource).toContain("listMcpConfigProjectRows");
    expect(configListSource).toContain("New config");
    expect(configListSource).toContain("ProfileAvatar");
    expect(configListSource).toContain("onOpenAvatar");
    expect(configDetailSource).toContain("Config");
    expect(configDetailSource).toContain("Instances");
    expect(newFormSource).toContain("Edit config");
    expect(newFormSource).toContain("Owner Avatar");
    expect(newFormSource).toContain("Form");
    expect(newFormSource).toContain("Code");
    expect(newFormSource).toContain("Inspect");
    expect(inspectSource).toContain("Visual");
    expect(inspectSource).toContain("Raw");
    expect(inspectSource).toContain("mcp probe");
    expect(inspectSource).toContain("formatProbeHelp");
    expect(inspectSource).toContain("action: 'open'");
    expect(inspectSource).toContain("action: 'ping'");
    expect(inspectSource).toContain("action: 'read-resource'");
    expect(inspectSource).toContain("Read Resource");
    expect(inspectSource).toContain("activeCapabilityTemplateHelp");
    expect(inspectSource).toContain("activeCapabilityTemplateFieldNames");
    expect(inspectSource).toContain("mcp-config-inspect-template-${fieldName}");
    expect(inspectSource).toContain("buildResourceTemplateUri");
    expect(inspectSource).toContain("McpAppResourcePreview");
    expect(inspectSource).toContain("line-clamp-2 min-w-0 break-words");
    expect(appPreviewSource).toContain("onAppServerStart");
    expect(appPreviewSource).toContain("onAppServerClose");
    expect(appPreviewSource).toContain("hostUrl");
    expect(appPreviewSource).toContain("hostPath");
    expect(appPreviewSource).not.toContain("sessionStorage");
    expect(appPreviewSource).not.toContain("registerMcpUiPreview");
    expect(appPreviewSource).not.toContain("Blob");
    expect(appPreviewSource).not.toContain("srcdoc");
    expect(inspectSource).toContain("buildAppServerStartInput");
    expect(inspectSource).toContain("activeMcpAppServerInput");
    expect(inspectSource).toContain("onAppServerStart");
    expect(inspectSource).toContain("protocolId");
    expect(inspectSource).toContain("Arguments");
    expect(inspectSource).toContain("Inspect capability dialog view");
    expect(inspectSource).toContain("mcp-inspect-capability-grid");
    expect(inspectSource).toContain("mcp-config-inspect-capability-dialog");
    expect(inspectSource).toContain("mcp-config-heavy-inspector-dialog");
    expect(inspectSource).toContain("mcp-config-heavy-inspector-fullscreen");
    expect(inspectSource).toContain("inspectorCompactViewport || inspectorFullscreenRequested");
    expect(inspectSource).toContain('interactOutsideBehavior="ignore"');
    expect(inspectSource).toContain("closeInspectorDialogImmediately");
    expect(inspectSource).toContain("inspectorSocketState === 'open' || inspectorSocketState === 'connecting'");
    expect(inspectSource).toContain("onInspectorStart");
    expect(inspectSource).toContain("onInspectorClose");
    expect(inspectSource).toContain("connectInspectorSocket(inspectorWsUrl)");
    expect(inspectSource).toContain("mcp-config-heavy-inspector-signal");
    expect(inspectSource).toContain("mcp-config-heavy-inspector-close");
    expect(inspectSource).not.toContain("onInspectorSubscribe");
    expect(inspectSource).toContain("bunx @modelcontextprotocol/inspector");
    expect(inspectSource).toContain("--config <avatar-tmp-config.json>");
    expect(inspectSource).toContain("equivalent direct shape");
    expect(inspectSource).toContain("seeded from inputSchema");
    expect(inspectSource).toContain("McpHelpHint");
    expect(inspectSource).not.toContain("HelpCircleIcon");
    expect(newFormSource).toContain("Override existing config?");
    expect(newFormSource).toContain("Install requires explicit override");
    expect(configDetailSource).toContain("Add project instance");
    expect(configDetailSource).toContain("onAddProject");
    expect(configDetailSource).toContain("onStartProject");
    expect(configDetailSource).toContain("onStopProject");
    expect(stateSource).toContain("McpConfigCatalogRow");
  });

  test("Scenario: Given Avatar-owned MCP When reading feature sources Then avatars tab stays a read-only ownership projection with jump affordances", () => {
    const routeSource = readSource("mcp-route.svelte");
    const avatarSource = readSource("mcp-avatar-overview.svelte");
    const configListSource = readSource("mcp-config-list.svelte");
    const newFormSource = readSource("mcp-new-global-form.svelte");

    expect(routeSource).toContain("avatar ownership overview");
    expect(routeSource).toContain("handleOpenAvatar");
    expect(avatarSource).toContain("Avatar ownership");
    expect(avatarSource).toContain("ProfileAvatar");
    expect(avatarSource).toContain("Configs");
    expect(avatarSource).toContain("Instances");
    expect(avatarSource).toContain("onOpenConfig");
    expect(avatarSource).toContain("onOpenProject");
    expect(configListSource).toContain("Open Avatar");
    expect(newFormSource).toContain("Open Avatar");
    expect(avatarSource).not.toContain("Start");
    expect(avatarSource).not.toContain("Stop");
  });

  test("Scenario: Given low-noise operator intent When reading MCP sources Then explanatory law stays behind contextual help", () => {
    const routeSource = readSource("mcp-route.svelte");
    const configDetailSource = readSource("mcp-config-detail.svelte");
    const newFormSource = readSource("mcp-new-global-form.svelte");

    expect(routeSource).toContain("HelpHint");
    expect(configDetailSource).toContain("HelpHint");
    expect(newFormSource).toContain("HelpHint");
    expect(routeSource).not.toContain("Avatar authority");
    expect(routeSource).not.toContain("What is MCP");
    expect(configDetailSource).not.toContain("Introduction");
    expect(newFormSource).not.toContain("Introduction");
  });

  test("Scenario: Given Studio projects Avatar-owned MCP facts When reading MCP sources Then app-server internals stay out of the browser route", () => {
    for (const source of [
      readSource("mcp-route.svelte"),
      readSource("mcp-config-list.svelte"),
      readSource("mcp-config-detail.svelte"),
      readSource("mcp-avatar-overview.svelte"),
      readSource("mcp-new-global-form.svelte"),
      readSource("mcp-workbench-state.ts"),
    ]) {
      expect(source).not.toContain("@agenter/app-server");
      expect(source).not.toContain("packages/app-server/src/mcp-system");
      expect(source).not.toContain("$lib/server");
    }
  });
});
