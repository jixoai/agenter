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
    const detailDrawerSource = readSource("apps/studio/src/lib/features/notes/notes-page-detail-drawer.svelte");
    const overviewSource = readSource("apps/studio/src/lib/features/notes/notes-overview-route.svelte");
    const resultListSource = readSource("apps/studio/src/lib/features/notes/notes-page-result-list.svelte");
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
    expect(avatarRouteSource).toContain("controller.runtimeStore.listNoteNotebooks");
    expect(avatarRouteSource).toContain("controller.runtimeStore.listNoteSections");
    expect(avatarRouteSource).toContain("controller.runtimeStore.listNoteSectionPages");
    expect(avatarRouteSource).toContain("controller.runtimeStore.readNotePage");
    expect(avatarRouteSource).toContain("controller.runtimeStore.searchNotes");
    expect(avatarRouteSource).toContain("controller.runtimeStore.listNoteTags");
    expect(avatarRouteSource).toContain("controller.runtimeStore.queryNotes");
    expect(avatarRouteSource).toContain("parseNotesSearchSyntax(searchQuery)");
    expect(avatarRouteSource).toContain("tags: parsed.tags");
    expect(avatarRouteSource).toContain("const defaultNoteSqlQuery");
    expect(avatarRouteSource).toContain("const sqlResultItems = $derived(mapNoteSqlResultItems(sqlOutput))");
    expect(avatarRouteSource).toContain("notebooksOutput && notebooksOutput.totalPages > 0");
    expect(avatarRouteSource).toContain("sqlOutput && sqlOutput.rows.length > 0");
    expect(avatarRouteSource).toContain(
      "const detailPending = $derived((mode === 'search' && searching) || (mode === 'query' && runningSql))",
    );
    expect(avatarRouteSource).toContain("mode === 'browse' ? firstNotePageListIdentity(nextPagesOutput) : null");
    expect(avatarRouteSource).toContain("mode !== 'query' ||");
    expect(avatarRouteSource).toContain("void runSql();");
    expect(avatarRouteSource).toContain(
      "const firstIdentity = sqlResultItems.find((item) => item.identity)?.identity ?? null",
    );
    expect(avatarRouteSource).toContain("selectedPage = firstIdentity");
    expect(avatarRouteSource).toContain("let detailOpen = $state(false)");
    expect(avatarRouteSource).toContain("detailOpen = Boolean(selectedPage)");
    expect(avatarRouteSource).toContain("detailLeftMin={560}");
    expect(avatarRouteSource).toContain("detailRightMin={360}");
    expect(avatarRouteSource).toContain("detailDefaultRatio={0.66}");
    expect(detailDrawerSource).toContain("textProjection: 'document'");
    expect(detailDrawerSource).toContain("import * as Empty from '$lib/components/ui/empty/index.js';");
    expect(detailDrawerSource).toContain("import * as Skeleton from '$lib/components/ui/skeleton/index.js';");
    expect(detailDrawerSource).toContain("pendingDetail?: boolean");
    expect(detailDrawerSource).toContain(
      "const shouldRenderSkeletonDetail = $derived((pendingDetail && !selectedPage) || (loadingPage && !selectedPageFact))",
    );
    expect(detailDrawerSource).toContain('data-testid="notes-detail-skeleton"');
    expect(detailDrawerSource).toContain('data-testid="notes-detail-empty"');
    expect(overviewSource).toContain("controller.runtimeStore.listNoteCatalog");
    expect(avatarRouteSource).not.toContain("controller.runtimeStore.listNoteCatalog");
    expect(resultListSource).toContain("type { NotePageIdentity, NotePageResultItem }");
    expect(resultListSource).toContain("import * as Skeleton from '$lib/components/ui/skeleton/index.js';");
    expect(resultListSource).toContain("loading?: boolean");
    expect(resultListSource).toContain("const loadingRows = [0, 1, 2, 3, 4]");
    expect(resultListSource).toContain('data-testid="notes-result-skeleton-row"');
    expect(searchSource).toContain('data-testid="notes-search-mode"');
    expect(searchSource).toContain('data-testid="notes-search-tags-accordion"');
    expect(searchSource).toContain("NotesPageResultList");
    expect(searchSource).toContain("loading={searching}");
    expect(searchSource).toContain("upsertNotesSearchTag");
    expect(searchSource).toContain("tagsFromSearchRows");
    expect(searchSource).toContain("shouldShowAllTags");
    expect(querySource).toContain("Read-only SQL");
    expect(querySource).toContain("import { SqlEditor } from '@jixo/codemirror';");
    expect(querySource).toContain("mapNoteSqlResultItems");
    expect(querySource).toContain("NotesPageResultList");
    expect(querySource).toContain("loading={runningSql}");
    expect(querySource).toContain(
      'class="grid h-full min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] gap-3 p-3 md:p-4"',
    );
    expect(querySource).toContain('viewportTestId="notes-query-scroll"');
    expect(querySource).not.toContain("WorkbenchScaffold");
    expect(querySource).not.toContain("JSON.stringify(sqlOutput.rows");
    expect(avatarRouteSource).toContain("<WorkbenchPageTabs");
    expect(avatarRouteSource).toContain("<NotesSearchMode");
    expect(avatarRouteSource).toContain("<NotesQueryMode");
    expect(avatarRouteSource).toContain("pendingDetail={detailPending}");
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
      detailDrawerSource,
    ]) {
      expect(source).not.toContain("@agenter/app-server");
      expect(source).not.toContain("@agenter/note-system");
      expect(source).not.toContain("packages/app-server/src/note-system");
    }
  });

  test("Scenario: Given Browse mode source When reviewers inspect list ownership Then the list pane owns notebook and sections-pages projections", () => {
    const browseSource = readSource("apps/studio/src/lib/features/notes/notes-browse-mode.svelte");

    expect(browseSource).toContain("type NotesBrowseListMode = 'sections-pages' | 'notebooks'");
    expect(browseSource).toContain(
      "const listHeaderLabel = $derived(listMode === 'notebooks' ? 'Notebooks' : selectedNotebookLabel)",
    );
    expect(browseSource).toContain("sortOptions");
    expect(browseSource).toContain("排序笔记本");
    expect(browseSource).toContain("排序章节");
    expect(browseSource).toContain("排序页面");
    expect(browseSource).toContain("DropdownMenuRadioGroup");
    expect(browseSource).toContain('data-testid="notes-browse-list-pane"');
    expect(browseSource).toContain('data-testid="notes-notebook-scope-toggle"');
    expect(browseSource).toContain('aria-controls="notes-browse-list-body"');
    expect(browseSource).toContain('data-testid="notes-notebooks-list"');
    expect(browseSource).toContain('data-testid="notes-sections-pages-list"');
    expect(browseSource).toContain('viewportTestId="notes-notebooks-scroll"');
    expect(browseSource).toContain('viewportTestId="notes-sections-scroll"');
    expect(browseSource).toContain('viewportTestId="notes-pages-scroll"');
    expect(browseSource).toContain("items: notebooks");
    expect(browseSource).toContain("items: sections");
    expect(browseSource).toContain("items: pages");
    expect(browseSource).toContain("shouldTriggerNotesScrollPaginationFromEvent");
    expect(browseSource).toContain("onViewportScroll={handleNotebookScroll}");
    expect(browseSource).toContain("onViewportScroll={handleSectionScroll}");
    expect(browseSource).toContain("onViewportScroll={handlePageScroll}");
    expect(browseSource).toContain("lg:grid-cols-[minmax(14rem,0.85fr)_minmax(18rem,1.35fr)]");
    expect(browseSource).toContain("添加笔记本");
    expect(browseSource).toContain("添加章节");
    expect(browseSource).toContain("添加页面");
    expect(browseSource).not.toContain("{pagesOutput?.totalPages ?? 0} pages");
    expect(browseSource).not.toContain("{notebooksOutput.totalNotebooks} notebooks");
    expect(browseSource).not.toContain('orientation="horizontal"');
    expect(browseSource).not.toContain("lg:grid-cols-[minmax(12rem,0.85fr)_minmax(12rem,0.9fr)_minmax(16rem,1.35fr)]");
    expect(browseSource).not.toContain("notebook.sections");
    expect(browseSource).not.toContain("section.pages");
  });

  test("Scenario: Given shared filePreviewer When Notes requests document projection Then Skills source preview remains available in the same iframe shell", () => {
    const filePreviewerSource = readSource("apps/studio/src/file-previewer-app/file-previewer-app.svelte");
    const filePreviewStateSource = readSource("apps/studio/src/lib/components/file-preview/file-preview-state.ts");

    expect(filePreviewStateSource).toContain('export type FilePreviewTextProjection = "source" | "document"');
    expect(filePreviewerSource).toContain("import { MarkdownPreviewContent } from '@jixo/codemirror';");
    expect(filePreviewerSource).toContain("import SkillTextViewer");
    expect(filePreviewerSource).toContain("shouldRenderDocumentTextProjection");
    expect(filePreviewerSource).toContain("textProjection === 'document'");
  });
});
