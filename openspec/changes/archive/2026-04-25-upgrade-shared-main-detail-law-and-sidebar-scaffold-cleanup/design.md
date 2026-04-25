## Context

The current repository already codified one durable idea: stateful `main + right detail` pages should use the shared split-detail law, while simple static shells should use a lighter scaffold family. The implementation never fully caught up. `WorkbenchSplitDetail` owns ratio math and compact detection, but desktop detail visibility still has no shared contract, so routes either cannot hide desktop detail at all or they fake visibility with page-local state that only works in compact mode. In parallel, `SplitView` still names a “generic split shell” even though only the `sidebar-content` variant is actually used, which keeps static sidebar pages and stateful detail pages conceptually blurred.

This change is cross-cutting: it affects `@agenter/svelte-components`, the shared WebUI navigation host, multiple product routes, durable docs, and the regression strategy. It also has a breaking API surface because `SplitView` will be removed once migration is complete.

## Goals / Non-Goals

**Goals:**
- Give split-detail pages one shared visibility law: the same `detailOpen` state must control desktop detail visibility and compact right-sheet visibility.
- Keep `WorkbenchSplitDetail` focused on geometry, ratio, and clamp math; move page/sheet ownership into a shared WebUI host instead of feature code.
- Replace the ambiguous `SplitView` family with one clearly named `SidebarScaffold` primitive for static sidebar shells.
- Remove all active `SplitView` code, exports, docs, tests, and route usage by the end of the change.
- Add regression coverage that blocks reintroduction of route-local pseudo split-detail logic and blocks `SplitView` resurrection.

**Non-Goals:**
- Rebuild unrelated route-specific content density, information architecture, or business workflows.
- Persist `detailOpen` across reloads; this change only persists split ratio.
- Introduce a second stateful split primitive inside `@agenter/svelte-components`.
- Expand `SidebarScaffold` into a new catch-all multi-pane API.

## Decisions

### 1. Remove `SplitView` instead of keeping a deprecated alias

`SplitView` has already become the wrong abstraction name. Leaving it in the package, even as a compatibility alias, preserves the same conceptual ambiguity that caused the residue in the first place. The repository has only one real static consumer pattern left: `sidebar + content`. The correct long-term API is therefore `SidebarScaffold.Root/Sidebar/Content`, and the old namespace is removed after all consumers migrate in this change.

Alternative considered:
- Keep `SplitView` as a deprecated alias for one more round. Rejected because the user explicitly wants final cleanup with no residue, and a live alias would continue to invite new usage.

### 2. Add desktop visibility as a geometry fact on `WorkbenchSplitDetail`

Desktop detail visibility changes the layout geometry. If the platform only hides the right panel by conditionally not rendering it in `WorkbenchPageContent`, the geometry primitive remains blind and routes keep compensating around it. The primitive will therefore learn one new neutral fact, `detailVisible`, so it can render a one-column desktop shell without pretending the page is compact.

Alternative considered:
- Keep `WorkbenchSplitDetail` unchanged and let `WorkbenchPageContent` rebuild hidden-detail layout itself. Rejected because it keeps geometry policy split across layers and recreates feature-local layout patches.

### 3. Put sheet/toolbar visibility orchestration in a shared WebUI host

`WorkbenchSplitDetail` should not learn about sheet components, toolbar takeover, or route snippets. Those are WebUI chrome concerns, not structural package concerns. A new shared host in the WebUI navigation layer will own:
- desktop vs compact visibility behavior
- compact-entry close behavior
- right-sheet mounting
- toolbar close takeover
- slot assembly for `main`, `bottom`, and `drawer`

`WorkbenchPageContent` becomes a thin consumer of that host instead of reimplementing split-detail policy inline.

Alternative considered:
- Move the full host into `@agenter/svelte-components`. Rejected because it would force the structural package to depend on WebUI-specific sheet and toolbar semantics.

### 4. Route selections that materially target the detail surface will reopen detail on both desktop and compact

Once desktop detail can be hidden, routes that select an entity specifically to inspect its detail must reopen detail explicitly. This keeps selection semantics intuitive and avoids a “selected but invisible” detail state. The migration will update affected routes and panels to call a shared local reopen helper whenever the user action clearly targets the detail surface.

Alternative considered:
- Preserve current “only open if compact” behavior. Rejected because it becomes incorrect once desktop detail can be intentionally hidden.

### 5. Final cleanup includes tests and docs, not just code migration

This change is not complete if only runtime code migrates. Final cleanup requires:
- no `SplitView` export or product usage
- no `SplitView` references in shared docs/specs except historical archived changes
- contract tests proving `SidebarScaffold` is the static shell law
- split-detail host tests covering desktop and compact visibility transitions

## Risks / Trade-offs

- [Risk] Desktop detail visibility changes could regress current route expectations and hide surfaces users previously always saw.
  Mitigation: update affected route actions to reopen detail when the action semantically targets detail, and add story-driven regression coverage for those interactions.

- [Risk] Removing `SplitView` in one round is a breaking package/API change.
  Mitigation: migrate all in-repo consumers in the same change and update durable specs/docs in lockstep so no internal caller remains on the removed API.

- [Risk] The new host can become another vague layer if it starts owning business logic.
  Mitigation: keep the host limited to visibility, sheet, toolbar close takeover, and slot assembly; business actions remain in routes.

- [Risk] Existing low-signal source-string tests may fight the refactor and create noisy maintenance.
  Mitigation: replace brittle string expectations with contract/stories that assert observable layout behavior and export surfaces.

## Migration Plan

1. Create and land the new OpenSpec change artifacts before code edits.
2. Add `SidebarScaffold` and remove `SplitView` from shared package exports and internal tests.
3. Upgrade `WorkbenchSplitDetail` plus the new shared host, then switch `WorkbenchPageContent` to the host.
4. Migrate WebUI routes, settings panel, dialogs, and stories.
5. Update durable docs/specs and remove remaining `SplitView` references.
6. Run targeted unit + Storybook DOM coverage, then perform real browser walkthroughs on the affected pages.

Rollback strategy:
- If regressions appear before merge, revert the upgrade change as one unit. Because this change removes `SplitView`, partial rollback is not desirable; the repository should not stay in a mixed API state.

## Open Questions

- None. The scope and cleanup bar are fixed for this round: no active `SplitView` residue may remain after the change lands.
