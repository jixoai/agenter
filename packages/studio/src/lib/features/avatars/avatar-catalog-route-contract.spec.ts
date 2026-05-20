import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const avatarCatalogRouteSource = readFileSync(resolve(import.meta.dirname, "avatar-catalog-route.svelte"), "utf8");

describe("Feature: Avatar catalog shared list-detail contract", () => {
  test("Scenario: Given the avatars catalog is a list-detail page When reading the source Then it adopts the shared split-detail page-content primitive instead of a bespoke two-column shell", () => {
    expect(avatarCatalogRouteSource).toContain(
      "import WorkbenchPageContent from '$lib/features/navigation/workbench-page-content.svelte';",
    );
    expect(avatarCatalogRouteSource).toContain(
      "import WorkbenchDetailDrawer from '$lib/features/navigation/workbench-detail-drawer.svelte';",
    );
    expect(avatarCatalogRouteSource).toContain('detailLayout="split-detail"');
    expect(avatarCatalogRouteSource).toContain("bind:detailCompact");
    expect(avatarCatalogRouteSource).toContain("bind:detailOpen");
    expect(avatarCatalogRouteSource).toContain('detailRatioPersistence="avatars:catalog-detail"');
    expect(avatarCatalogRouteSource).not.toContain('class="avatar-catalog-layout grid');
    expect(avatarCatalogRouteSource).not.toContain("avatar-catalog-layout__rail");
    expect(avatarCatalogRouteSource).not.toContain("avatar-catalog-layout__lens");
  });

  test("Scenario: Given shared split-detail owns the available canvas When reviewing the route wrapper Then avatar-catalog-route stays a neutral host instead of shrinking page-content with route-level padding", () => {
    expect(avatarCatalogRouteSource).toContain('class="h-full min-w-0"');
    expect(avatarCatalogRouteSource).toContain('data-testid="avatar-catalog-route"');
    expect(avatarCatalogRouteSource).not.toContain("px-2 pb-2 pt-2 md:p-5");
  });

  test("Scenario: Given compact list-detail needs the same ownership law as workspaces When an avatar row is selected Then the route opens the shared detail drawer instead of stacking a second inline detail column", () => {
    expect(avatarCatalogRouteSource).toContain("const selectAvatar = (nickname: string): void => {");
    expect(avatarCatalogRouteSource).toContain("detailOpen = true;");
    expect(avatarCatalogRouteSource).toContain('<PanelRightOpenIcon class="size-4" />');
    expect(avatarCatalogRouteSource).toContain("Open detail");
    expect(avatarCatalogRouteSource).not.toContain("Collapsible.Root");
    expect(avatarCatalogRouteSource).not.toContain("detailsOpen");
  });

  test("Scenario: Given selected avatar identity should stay URL-addressable When the source is reviewed Then selection sync is owned by the catalog route instead of remaining local-only state", () => {
    expect(avatarCatalogRouteSource).toContain("import { goto, replaceState } from '$app/navigation';");
    expect(avatarCatalogRouteSource).toContain("import { onMount } from 'svelte';");
    expect(avatarCatalogRouteSource).toContain("let routeSyncReady = $state(false);");
    expect(avatarCatalogRouteSource).toContain("const syncRoute = (): void => {");
    expect(avatarCatalogRouteSource).toContain(
      "buildAvatarCatalogHref({ avatar: selectedEntry?.nickname ?? selectedAvatar })",
    );
    expect(avatarCatalogRouteSource).toContain("replaceState(nextHref, page.state);");
    expect(avatarCatalogRouteSource).toContain("routeSyncReady = true;");
  });

  test("Scenario: Given the main pane is the catalog rail When reading the source Then the page uses one scroll owner and keeps a scan-first list instead of separate mobile and desktop list implementations", () => {
    expect(avatarCatalogRouteSource).toContain("<Card.Title>My avatars</Card.Title>");
    expect(avatarCatalogRouteSource).toContain(
      "{catalogCountLabel}. Select one installed avatar to inspect its runtime identity and operational handoffs.",
    );
    expect(avatarCatalogRouteSource).toContain("src={entry.iconUrl ?? null}");
    expect(avatarCatalogRouteSource).toContain("src={selectedEntry.iconUrl ?? null}");
    expect(avatarCatalogRouteSource).toContain('<ScrollView class="h-full" contentClass="divide-y divide-border/50">');
    expect(avatarCatalogRouteSource).toContain("aria-pressed={isSelected}");
    expect(avatarCatalogRouteSource).toContain("bg-accent/45");
    expect(avatarCatalogRouteSource).not.toContain('class="avatar-catalog-list grid gap-0 md:hidden"');
    expect(avatarCatalogRouteSource).not.toContain('ScrollView class="max-h-52"');
  });

  test("Scenario: Given the detail pane is now a real drawer surface When reading the source Then selected avatar actions and runtime facts live inside one dedicated detail panel", () => {
    expect(avatarCatalogRouteSource).toContain("<WorkbenchDetailDrawer");
    expect(avatarCatalogRouteSource).toContain('description="Preview before runtime entry."');
    expect(avatarCatalogRouteSource).toContain("Canonical runtime");
    expect(avatarCatalogRouteSource).toContain("Catalog state");
    expect(avatarCatalogRouteSource).toContain("Actions");
    expect(avatarCatalogRouteSource).toContain("Runtime details");
    expect(avatarCatalogRouteSource).toContain("Status:");
    expect(avatarCatalogRouteSource).toContain("Catalog:");
    expect(avatarCatalogRouteSource).toContain("Runtime:");
    expect(avatarCatalogRouteSource).toContain("Create draft from this avatar");
    expect(avatarCatalogRouteSource).toContain("Open workspaces");
    expect(avatarCatalogRouteSource).toContain("Copy avatar");
    expect(avatarCatalogRouteSource).toContain("Runtime home");
    expect(avatarCatalogRouteSource).toContain("Root workspace");
    expect(avatarCatalogRouteSource).toContain("Workspace slot");
  });

  test("Scenario: Given the avatar catalog should still avoid a duplicate page-toolbar title band When reading the source Then the fixed workbench tabs remain the only outer chrome owner", () => {
    expect(avatarCatalogRouteSource).not.toContain("WorkbenchPageToolbar");
    expect(avatarCatalogRouteSource).not.toContain("<WorkbenchToolbar");
    expect(avatarCatalogRouteSource).not.toContain("toolbar={avatarsToolbar}");
  });
});
