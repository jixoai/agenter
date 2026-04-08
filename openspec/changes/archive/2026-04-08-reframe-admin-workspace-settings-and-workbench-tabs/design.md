## Context

The repository already has the data-plane needed for this change: app-server exposes scoped settings graphs with schema metadata, provenance chains, and jump targets; the client runtime store already exposes `listScopedSettings`, `readScopedSettingsLayer`, and `saveScopedSettingsLayer`; and the previous React WebUI contains mature `SettingsPanel` / schema-view / source-editor behavior that can be ported. The current Svelte assembly is the missing piece: `/avatars/settings` still renders the superadmin/profile page, Avatars still renders a redundant `Running Avatars` secondary card, and the shared `workbench-tab-strip` is only a scrollable link list rather than a durable tabs primitive. Even after the first round of tab work, page title, metadata, and local actions still live outside the tab chrome, which keeps the interaction noticeably short of the browser-style workbench law the user requested.

This change is cross-cutting but stays within the existing platform law. It does not require a new back-end protocol; it requires reassigning responsibilities at the shell layer and reifying tabs plus workspace settings as shared WebUI primitives.

## Goals / Non-Goals

**Goals:**

- Move superadmin/profile management into `/admin` without promoting it into the left primary navigation set.
- Reintroduce workspace settings source/view + provenance semantics in the active Svelte WebUI.
- Make Avatars, Messages, and Terminals all consume one durable chrome-style workbench tabs primitive.
- Add a shared responsive toolbar companion below the tab row so workbench-local information and actions are mounted into one consistent chrome surface.
- Make the workbench body belong to that same chrome surface so the visible result is one window, not tabs floating above detached content.
- Remove detached route-card shells inside the shared window by introducing a shared integrated page/pane scaffold for route roots and split panes.
- Refine the toolbar surface so it reads as browser chrome rather than a generic status strip.
- Define workbench-tab close behavior as UI presence management, not durable resource deletion.
- Remove the redundant running-avatar secondary card while preserving runtime deep-link routes.

**Non-Goals:**

- Introduce a brand-new settings API shape or rewrite the settings cascade back end.
- Replace runtime-stage tabs (`Attention`, `Cycles`, `Systems`, `Observability`, `Settings`) with the new chrome-tabs law in this change.
- Bind tab close to destructive actions such as deleting rooms, deleting terminals, or stopping avatar sessions.
- Expand `/admin` into a full general-purpose admin center beyond the migrated superadmin/profile surface.

## Decisions

1. **Use `/admin` as an auxiliary route, not a primary system destination**
   - The left primary navigation remains `Avatars`, `Messages`, and `Terminals`.
   - The footer profile/superadmin affordance becomes the entry point to `/admin`.
   - Rationale: this keeps global administration separate from system browsing while still making the route explicit and reload-safe.

2. **Treat `/avatars/settings` as workspace-scoped settings, including `~/`**
   - The workspace settings page will mirror the existing `/avatars/workspace` master-detail structure: left workspace rail, right settings workbench.
   - The global workspace `~/` continues to use the same workspace settings model rather than a separate global-settings route shape.
   - Rationale: this matches the existing scoped settings contract and the user’s requested mental model.

3. **Port the legacy settings workbench into Svelte instead of designing a new settings UI**
   - Recreate the React-era `SettingsPanel`, `SettingsSchemaView`, and `SettingsSourceEditor` as Svelte feature primitives.
   - Keep the proven semantics: `Effective` vs `Layer Sources`, nested `Source` / `View`, provenance jump, split detail on desktop, sheet detail on compact.
   - Rationale: the old interaction model already encodes the correct cascade/provenance law and avoids inventing a weaker replacement.

4. **Replace `workbench-tab-strip` with a shared bits-ui-backed chrome workbench primitive**
   - Keep `WorkbenchTabStrip` as the route-selection primitive, but upgrade it into a full chrome shell that can render a companion toolbar directly beneath the tab row.
   - Tabs expose explicit slots/props for icon/avatar/adornments, tooltip content, close affordance, and context menu.
   - Rationale: tabs are becoming a durable navigation law across three primary workbenches and need stronger structure than plain links.

5. **Model open tabs separately from durable resources**
   - Messages and Terminals currently derive all tabs from the full resource list. This change introduces a small client-side open-tab model per workbench.
   - Closing a tab removes it from the workbench open set and reroutes to a fallback tab or page. Reopening can happen from context or direct navigation.
   - Rationale: a close affordance is meaningless if every durable resource instantly reappears because list truth equals tab truth.

6. **Running avatars remain route-driven runtime shells, but their discoverability moves into Avatars tabs**
   - Runtime detail routes stay reload-safe under `/avatars/runtime/[sessionId]/...`.
   - Avatars fixed tabs remain `workspace`, `history`, and `settings`; running sessions append as dynamic tabs and replace the old secondary card/sheet.
   - Rationale: this keeps runtime deep links stable while aligning navigation with the user’s requested browser-tab workbench.

7. **Mount page-local information and actions through a responsive toolbar companion**
   - Introduce a reusable `WorkbenchToolbar` primitive with structured regions for primary identity, metadata, and local actions.
   - `Avatars`, `Messages`, and `Terminals` move their current page title/description rows into this toolbar instead of hand-rolling workbench-specific headers.
   - Rationale: browser-like tabs without the lower toolbar still fragment page chrome and force each workbench to rebuild layout rules independently.

8. **Render tab content through one fused workbench window shell**
   - Introduce a `WorkbenchWindow` primitive that composes `WorkbenchTabStrip`, the responsive toolbar, and the body surface into one continuous bordered window.
   - Primary workbench layouts render this primitive directly, so the left sidebar behaves as a window switcher and each selected route reads as a coherent Chrome-like window.
   - Rationale: if the body remains visually detached from the top chrome, the user still perceives “a page below tabs” rather than “a switched window”.

9. **Model route interiors through shared integrated surfaces**
   - Introduce a shared `WorkbenchScaffold` primitive with `page` and `pane` tones.
   - `page` is the canonical route-root surface for create flows, history views, and transcript pages mounted directly inside `WorkbenchWindow`.
   - `pane` is the quieter secondary surface for split-view rails and subpanels such as workspace lists, quick-start panes, and terminal side panels.
   - Rationale: the window shell only solves the outer frame; without an interior law, feature code keeps recreating detached cards inside the window.

10. **Treat the toolbar as browser chrome with an explicit signal rail**

- Keep `WorkbenchToolbar` as the composition point, but refine its default layout into a primary/action row plus a separated metadata rail.
- Route-level metadata should sit in that lower rail, while primary identity and actions share the top line.
- Rationale: a Chrome-like tab strip still feels incomplete if the lower row looks like a stack of unrelated badges instead of one toolbar.

## Risks / Trade-offs

- **[Risk] Porting legacy settings view into Svelte may introduce DOM regressions** → Mitigation: port the old Storybook DOM scenarios first and keep provenance jump/sheet behavior under direct contract tests.
- **[Risk] New open-tab state can drift from route truth** → Mitigation: keep route navigation authoritative for selection, and only use open-tab state for membership plus close fallback decisions.
- **[Risk] Chrome-style tabs may become too feature-heavy for the current iteration** → Mitigation: implement a strict minimal API that covers icon/avatar, badge/loading, tooltip, close, and menu extension only.
- **[Risk] Responsive toolbar content may overflow or duplicate route-level chrome** → Mitigation: centralize toolbar layout into one primitive, keep it metadata-first, and migrate existing per-route title rows into that single slot instead of layering extra headers around it.
- **[Risk] Existing uncommitted repo changes touch nearby shell files** → Mitigation: keep edits scoped to the approved surfaces and avoid reverting unrelated changes.
- **[Risk] A shared integrated scaffold may over-constrain route composition** → Mitigation: keep the primitive slot-based (`header/body/footer`) and expose only the two durable tones actually needed (`page`, `pane`).
