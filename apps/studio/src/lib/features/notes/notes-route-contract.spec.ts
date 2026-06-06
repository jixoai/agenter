import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const repoRoot = resolve(import.meta.dirname, "../../../../../..");
const readSource = (path: string): string => readFileSync(resolve(repoRoot, path), "utf8");

describe("Feature: Studio Notes route contract", () => {
  test("Scenario: Given app shell navigation When notes is available Then the Notes item routes to /notes and owns active state through the shared nav list", () => {
    const appShellSource = readSource("apps/studio/src/lib/features/shell/app-shell.svelte");

    expect(appShellSource).toContain("import NotebookTextIcon from '@lucide/svelte/icons/notebook-text';");
    expect(appShellSource).toContain("{ href: '/notes', label: 'Notes', icon: NotebookTextIcon }");
    expect(appShellSource).toContain(
      "page.url.pathname === item.href || page.url.pathname.startsWith(`${item.href}/`)",
    );
    expect(existsSync(resolve(repoRoot, "apps/studio/src/routes/(app)/notes/+page.svelte"))).toBe(true);
    expect(existsSync(resolve(repoRoot, "apps/studio/src/routes/(app)/notes/+layout.svelte"))).toBe(true);
    expect(
      existsSync(resolve(repoRoot, "apps/studio/src/routes/(app)/notes/avatar/[avatarNickname]/+page.svelte")),
    ).toBe(true);
    expect(
      existsSync(resolve(repoRoot, "apps/studio/src/routes/(app)/notes/avatar/[avatarNickname]/search/+page.svelte")),
    ).toBe(true);
    expect(
      existsSync(resolve(repoRoot, "apps/studio/src/routes/(app)/notes/avatar/[avatarNickname]/query/+page.svelte")),
    ).toBe(true);
  });

  test("Scenario: Given Notes route source When reviewers inspect boundaries Then avatar scope and modes are route-owned without body selectors", () => {
    const layoutSource = readSource("apps/studio/src/lib/features/notes/notes-workbench-layout.svelte");
    const locationSource = readSource("apps/studio/src/lib/features/notes/notes-workbench-location.ts");
    const avatarTabSource = readSource("apps/studio/src/lib/features/notes/notes-avatar-tabs-state.ts");
    const avatarRouteSource = readSource("apps/studio/src/lib/features/notes/notes-avatar-route.svelte");
    const overviewSource = readSource("apps/studio/src/lib/features/notes/notes-overview-route.svelte");
    const searchSource = readSource("apps/studio/src/lib/features/notes/notes-search-mode.svelte");
    const querySource = readSource("apps/studio/src/lib/features/notes/notes-query-mode.svelte");
    const pageSource = readSource("apps/studio/src/routes/(app)/notes/+page.svelte");
    const nestedSearchSource = readSource(
      "apps/studio/src/routes/(app)/notes/avatar/[avatarNickname]/search/+page.svelte",
    );
    const nestedQuerySource = readSource(
      "apps/studio/src/routes/(app)/notes/avatar/[avatarNickname]/query/+page.svelte",
    );

    expect(pageSource).toContain("import NotesOverviewRoute from '$lib/features/notes/notes-overview-route.svelte';");
    expect(layoutSource).toContain("readNotesRouteScope(page.url.pathname)");
    expect(layoutSource).toContain("notes-avatar:");
    expect(avatarTabSource).toContain("agenter:studio:notes:avatar-tabs");
    expect(locationSource).toContain("/notes/avatar/");
    expect(nestedSearchSource).toContain('mode="search"');
    expect(nestedQuerySource).toContain('mode="query"');
    expect(avatarRouteSource).toContain("controller.runtimeStore.listNoteCatalog");
    expect(avatarRouteSource).toContain("controller.runtimeStore.readNotePage");
    expect(avatarRouteSource).toContain("controller.runtimeStore.searchNotes");
    expect(avatarRouteSource).toContain("controller.runtimeStore.listNoteTags");
    expect(avatarRouteSource).toContain("controller.runtimeStore.queryNotes");
    expect(overviewSource).toContain("controller.runtimeStore.listNoteCatalog");
    expect(searchSource).toContain("Catalog browsing stays in Browse mode.");
    expect(querySource).toContain("Read-only SQL");
    expect(avatarRouteSource).toContain("<WorkbenchPageTabs");
    expect(avatarRouteSource).toContain("<NotesSearchMode");
    expect(avatarRouteSource).toContain("<NotesQueryMode");
    expect(avatarRouteSource).not.toContain("Notes avatar");
    expect(overviewSource).not.toContain("Notes avatar");
    expect(searchSource).not.toContain("Notes avatar");
    expect(querySource).not.toContain("Notes avatar");
    expect(avatarRouteSource).not.toContain("<select");
    expect(overviewSource).not.toContain("<select");
    for (const source of [
      layoutSource,
      locationSource,
      avatarTabSource,
      avatarRouteSource,
      overviewSource,
      searchSource,
      querySource,
    ]) {
      expect(source).not.toContain("@agenter/app-server");
      expect(source).not.toContain("@agenter/note-system");
      expect(source).not.toContain("packages/app-server/src/note-system");
    }
  });
});
