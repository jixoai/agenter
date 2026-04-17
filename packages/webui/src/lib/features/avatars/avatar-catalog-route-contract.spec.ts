import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const avatarCatalogRouteSource = readFileSync(resolve(import.meta.dirname, "avatar-catalog-route.svelte"), "utf8");

describe("Feature: Avatar catalog density contract", () => {
  test("Scenario: Given the fixed catalog route already has workbench tab and toolbar context When reading the source Then the extra page-toolbar title band stays gone", () => {
    expect(avatarCatalogRouteSource).toContain(
      "import HelpHint from '$lib/components/web-components/help-hint.svelte';",
    );
    expect(avatarCatalogRouteSource).not.toContain("WorkbenchPageToolbar");
    expect(avatarCatalogRouteSource).not.toContain("import { Badge } from '$lib/components/ui/badge/index.js';");
    expect(avatarCatalogRouteSource).not.toContain("hidden bg-background/70 text-[11px] sm:inline-flex");
    expect(avatarCatalogRouteSource).toContain("My avatars");
    expect(avatarCatalogRouteSource).toContain("Selected avatar");
    expect(avatarCatalogRouteSource).toContain("Canonical runtime");
  });

  test("Scenario: Given runtime lens chrome should stay factual instead of pill-heavy When reading the source Then status and default facts demote into text while only primary actions keep button chrome", () => {
    expect(avatarCatalogRouteSource).toContain("selectedStatusLabel");
    expect(avatarCatalogRouteSource).toContain("default");
    expect(avatarCatalogRouteSource).not.toContain(
      '<Badge variant="outline" class="bg-background/70">{selectedSession.status}</Badge>',
    );
    expect(avatarCatalogRouteSource).not.toContain('<Badge variant="secondary">Default</Badge>');
    expect(avatarCatalogRouteSource).not.toContain('variant="ghost"\n\t\t\t\t\t\thref={buildAvatarNewHref');
  });

  test("Scenario: Given compact avatar catalog should keep both surfaces readable When reading the source Then mobile renders a tighter natural list while desktop keeps a bounded measured rail without row cards", () => {
    expect(avatarCatalogRouteSource).toContain('class="avatar-catalog-list grid gap-0 md:hidden"');
    expect(avatarCatalogRouteSource).toContain('ScrollView class="max-h-52"');
    expect(avatarCatalogRouteSource).toContain("md:mx-auto md:w-full md:max-w-[53rem]");
    expect(avatarCatalogRouteSource).toContain("md:grid-cols-[minmax(12.5rem,14rem)_minmax(24rem,1fr)]");
    expect(avatarCatalogRouteSource).not.toContain("rounded-[0.95rem] border");
    expect(avatarCatalogRouteSource).toContain("class={`avatar-catalog-entry transition-colors ${");
    expect(avatarCatalogRouteSource).toContain(".avatar-catalog-entry + .avatar-catalog-entry::before");
    expect(avatarCatalogRouteSource).toContain(".avatar-catalog-layout__rail::after");
    expect(avatarCatalogRouteSource).toContain("bg-[color-mix(in_srgb,var(--accent),transparent_72%)]");
    expect(avatarCatalogRouteSource).toContain(
      "grid w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-2.5 px-2 py-2 text-left",
    );
    expect(avatarCatalogRouteSource).toContain('class="avatar-runtime-facts avatar-runtime-details grid gap-0"');
  });

  test("Scenario: Given the control tower should read like product UI When reading the source Then contextual handoffs dock to the selected identity and canonical facts use semantic labels", () => {
    expect(avatarCatalogRouteSource).toContain("Canonical runtime");
    expect(avatarCatalogRouteSource).toContain("Origin");
    expect(avatarCatalogRouteSource).toContain("avatar-runtime-primary-fact");
    expect(avatarCatalogRouteSource).toContain("avatar-runtime-origin-fact");
    expect(avatarCatalogRouteSource).toContain(".avatar-runtime-secondary-actions {");
    expect(avatarCatalogRouteSource).toContain("padding-inline-start: 4.25rem;");
    expect(avatarCatalogRouteSource).toContain(".avatar-runtime-overview::before,");
    expect(avatarCatalogRouteSource).toContain(".avatar-runtime-facts::before,");
    expect(avatarCatalogRouteSource).toContain("inset-inline-start: 8rem;");
  });

  test("Scenario: Given the first durable fact is product-facing When reading the source Then it uses distinct primary typography while lower details keep audit-style field labels", () => {
    expect(avatarCatalogRouteSource).toContain('class="avatar-runtime-fact-label avatar-runtime-fact-label--primary"');
    expect(avatarCatalogRouteSource).toContain('class="avatar-runtime-fact-value avatar-runtime-fact-value--primary break-all"');
    expect(avatarCatalogRouteSource).toContain(".avatar-runtime-fact-label--primary {");
    expect(avatarCatalogRouteSource).toContain("text-transform: none;");
    expect(avatarCatalogRouteSource).toContain(".avatar-runtime-fact-value--primary {");
    expect(avatarCatalogRouteSource).toContain('class="avatar-runtime-fact-label">Root workspace</div>');
    expect(avatarCatalogRouteSource).toContain('class="avatar-runtime-fact-label">Workspace slot</div>');
  });

  test("Scenario: Given the primary runtime fact should attach to the selected identity lane When reading the source Then it stays above the secondary branch actions and outside the runtime-details audit disclosure", () => {
    expect(avatarCatalogRouteSource.indexOf("avatar-runtime-primary-fact")).toBeLessThan(
      avatarCatalogRouteSource.indexOf("avatar-runtime-secondary-actions"),
    );
    expect(avatarCatalogRouteSource.indexOf("avatar-runtime-overview")).toBeLessThan(
      avatarCatalogRouteSource.indexOf("avatar-runtime-secondary-actions"),
    );
    expect(avatarCatalogRouteSource.indexOf("avatar-runtime-secondary-actions")).toBeLessThan(
      avatarCatalogRouteSource.indexOf('<Collapsible.Root bind:open={detailsOpen}>'),
    );
    expect(avatarCatalogRouteSource).toContain('class="avatar-runtime-facts avatar-runtime-details grid gap-0"');
    expect(avatarCatalogRouteSource).toContain(".avatar-runtime-primary-fact {");
  });

  test("Scenario: Given compact runtime lens should stay title-first When reading the source Then passive facts stack under the title and actions use the available mobile width", () => {
    expect(avatarCatalogRouteSource).toContain(
      'class="size-12 rounded-xl border-border/65 bg-background/70 md:size-14"',
    );
    expect(avatarCatalogRouteSource).toContain(
      'class="grid min-w-0 gap-0.5 md:flex md:flex-wrap md:items-baseline md:gap-x-2 md:gap-y-1"',
    );
    expect(avatarCatalogRouteSource).toContain(
      'class="flex flex-wrap items-center gap-x-1.5 text-[11px] font-medium text-muted-foreground md:text-xs"',
    );
    expect(avatarCatalogRouteSource).not.toContain("Origin · {selectedOriginLabel}");
    expect(avatarCatalogRouteSource).toContain('class="grid grid-cols-2 gap-1.5 md:flex md:flex-wrap md:justify-end"');
    expect(avatarCatalogRouteSource).toContain('class="w-full md:w-auto"');
  });

  test("Scenario: Given repeated operators should not see the same explanation everywhere When reading the source Then one restrained help hint and one secondary disclosure own the low-frequency detail", () => {
    expect(avatarCatalogRouteSource).toContain("Selected avatar");
    expect(avatarCatalogRouteSource).toContain("The selected-avatar lens stays bound to one installed avatar identity.");
    expect(avatarCatalogRouteSource).toContain("<Collapsible.Root bind:open={detailsOpen}>");
    expect(avatarCatalogRouteSource).toContain("<span>Runtime details</span>");
    expect(avatarCatalogRouteSource).toContain("Root workspace");
    expect(avatarCatalogRouteSource).toContain("Workspace slot");
    expect(avatarCatalogRouteSource).not.toContain("passiveOnFirstVisit={true}");
    expect(avatarCatalogRouteSource).not.toContain("The avatar catalog is the durable global identity surface.");
    expect(avatarCatalogRouteSource).not.toContain("Stable runtime identity across workspace handoffs.");
    expect(avatarCatalogRouteSource).not.toContain("Avatar runtime state stays global.");
  });

  test("Scenario: Given the catalog is an operational surface When reading the source Then scan-first identifiers stay compact while contextual branch actions stay secondary to runtime launch", () => {
    expect(avatarCatalogRouteSource).toContain("const compactRuntimeId = (runtimeId: string): string => {");
    expect(avatarCatalogRouteSource).toContain("const formatStatusLabel = (status: string): string => {");
    expect(avatarCatalogRouteSource).toContain("const catalogCountLabel = $derived(`${avatars.length} installed`);");
    expect(avatarCatalogRouteSource).toContain("const selectedOriginLabel = $derived(selectedEntry ? 'Local catalog' : null);");
    expect(avatarCatalogRouteSource).toContain("const openAvatarDraft = async (): Promise<void> => {");
    expect(avatarCatalogRouteSource).toContain("{compactRuntimeId(entry.runtimeId)}");
    expect(avatarCatalogRouteSource).toContain("Copy avatar");
    expect(avatarCatalogRouteSource).toContain("Open workspaces");
    expect(avatarCatalogRouteSource).toContain("Create draft from this avatar");
    expect(avatarCatalogRouteSource).toContain('class="avatar-runtime-secondary-actions flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] font-medium text-muted-foreground"');
    expect(avatarCatalogRouteSource).not.toContain("w-0.5 shrink-0 rounded-full");
  });
});
