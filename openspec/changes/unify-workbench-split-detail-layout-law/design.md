## Context

The current workbench shell already has a durable outer chrome:

- `tabs`
- `page-toolbar`
- `page-content`

Inside `page-content`, however, the `main + right detail` relationship is still not governed by one shared primitive. The repository currently mixes:

- static drawer widths in `WorkbenchPageContent`
- static `SplitView` variants in `@agenter/svelte-components`
- feature-local `detailMode = 'split' | 'sheet'` state in route code
- viewport media queries to decide compact fallback

This creates four recurring failures:

1. Desktop right-detail width is not reusable across routes.
2. Ratio intent is lost because pages persist pixels or do not persist anything.
3. Compact fallback is decided by viewport breakpoints instead of the actual width available to the split container.
4. `page-toolbar` cannot act as the guaranteed close affordance for compact right detail because takeover is not part of the shared shell contract.

The user decision for this change is now clear:

- shared split-detail law is required
- ratio persistence must be configurable
- the default ratio store is global and syncs through `idb + BroadcastChannel`
- compact mode must be derived from `leftMin + handle + rightMin`, not viewport breakpoints
- `page-toolbar` becomes `close-only` while the compact right sheet is open
- toolbar remains responsible for view switching, not detail-local functional actions
- detail-local actions remain in the left surface, primarily the `bottom-area`

## Goals / Non-Goals

**Goals:**

- Introduce one shared `main + right detail` workbench primitive instead of repeating `split + sheet` state in feature code.
- Persist desktop split width as a percentage ratio that survives resize and can sync across windows.
- Make ratio persistence configurable through either a string key or a custom provider.
- Use container width plus min-width clamp to decide whether the route stays in split mode or collapses to compact `rightSheet`.
- Provide one toolbar takeover contract so compact right detail always has a stable close affordance.
- Migrate the highest-risk route(s) away from feature-local `detailMode + Sheet` patches.

**Non-Goals:**

- Introduce a new three-column `sidebar + main + detail` page-content primitive.
- Move detail-local save/reload/edit actions into toolbar chrome.
- Replace the outer workbench shell (`tabs + page-toolbar + page-content`) with a new runtime layout engine.
- Generalize this first release into arbitrary nested splitter trees.

## Decisions

### Build one dedicated split-detail primitive, not another generic `SplitView` variant

The repository already has `SplitView`, but it is currently a static shell family. Extending it with one more variant would hide a stateful layout law inside an API that was designed around CSS-only topology.

Instead, this change will add a dedicated workbench split-detail primitive with explicit responsibilities:

- split ratio state
- drag handle
- min-width clamp
- compact-collapse computation
- compact right-sheet open state
- toolbar takeover metadata

This keeps the new law discoverable and prevents `SplitView` from becoming a vague “everything layout” wrapper.

Alternative considered:

- Add `resizable-content-detail` as another `SplitView` variant.
  - Rejected because the stateful persistence and toolbar contract would remain implicit and would keep leaking into feature code.

### Model ratio persistence as a provider boundary

The layout needs one durable interface for ratio persistence:

- `string` input uses the default global provider
- `provider` input fully overrides read/write/subscribe behavior

The default provider will store ratios in IndexedDB and fan out updates with `BroadcastChannel`, because the user explicitly wants global shared behavior by default. The primitive itself will only depend on the provider contract, not directly on `idb` APIs.

This keeps the law orthogonal:

- layout owns ratio semantics
- provider owns persistence transport

Alternative considered:

- Hard-code `localStorage` inside the layout.
  - Rejected because it cannot satisfy the requested default sync contract and would couple structural layout directly to a storage implementation.

### Derive compact mode from container math, not viewport media queries

The split shell will observe its own container width and compute:

- `minimumRequiredWidth = leftMin + handleWidth + rightMin`
- if available width is below that threshold, the layout enters compact mode

Desktop split math remains LTR:

- the ratio represents the left area share of the available split width
- resolved widths are clamped against `leftMin` and `rightMin`
- if clamp makes both sides hit minimums and width is still insufficient, compact mode wins

This matches the user's rule and prevents pages from behaving differently just because the browser viewport is wide while the actual page-content region is narrow.

Alternative considered:

- Keep breakpoint-driven `matchMedia('(max-width: ...)')`.
  - Rejected because it measures the wrong surface and reintroduces per-route heuristic drift.

### Treat compact right detail as a `page-content` concern with toolbar takeover

Compact mode does not remove the detail surface. It translates the right detail into a `rightSheet` that still belongs to the same `page-content` law.

The shared primitive therefore exposes two coupled states:

- `isCompact`
- `detailOpen`

When `isCompact && detailOpen`:

- the shared `page-toolbar` host hides normal route-local toolbar content
- the toolbar renders a shared `close-only` affordance
- closing the sheet restores the original toolbar content

This keeps close ownership outside the sheet body and matches the existing workbench chrome hierarchy.

Alternative considered:

- Let each feature place its own close button inside the sheet header only.
  - Rejected because it fails the “always closable from toolbar position” law and keeps takeover behavior inconsistent by route.

### Keep functional actions in the left surface, not the toolbar

The toolbar contract is explicitly scoped to:

- page identity
- mode/view switching
- compact visibility toggles

Detail-local functional actions such as save, reload, apply, create, or delete remain in the page body, usually the left surface `bottom-area`. This preserves the existing workspace law and avoids turning compact toolbar takeover into a dumping ground for random route actions.

Alternative considered:

- Hoist sheet-local actions into toolbar while the sheet is open.
  - Rejected because it changes action ownership instead of only changing view ownership.

### Migrate feature-local adopters incrementally

This change will not rewrite every right-detail route at once. It will:

1. introduce the shared primitive and provider contract
2. wire toolbar takeover into shared workbench chrome
3. migrate the highest-risk route(s) that currently use local `detailMode + Sheet`
4. leave other routes to adopt the primitive in follow-up changes if needed

The first target should be the route that already demonstrates the problem most clearly, namely workspace/admin settings. Workspace workbench surfaces are the next natural adopter because they already rely on `main-area + bottom-area + right-drawer` law.

## Risks / Trade-offs

- [Risk] The new primitive may overlap conceptually with existing `SplitView`. -> Mitigation: keep `SplitView` as a static topology primitive and document the new primitive as the only stateful `main + right detail` law.
- [Risk] Toolbar takeover could break existing route-local toolbar composition. -> Mitigation: implement takeover through the shared toolbar host/registry so routes opt in through one contract instead of DOM hacks.
- [Risk] Global ratio persistence can leak unwanted coupling between unrelated surfaces. -> Mitigation: make the provider configurable and require an explicit key; the default global provider is shared, but consumers can scope or replace it.
- [Risk] Container observers plus drag state could introduce flicker around the compact threshold. -> Mitigation: compute widths from one measured container, clamp before mode switching, and treat compact threshold as a single canonical formula.
- [Risk] Incremental migration may leave mixed behavior in untouched routes for a while. -> Mitigation: codify the new law in specs first and migrate the current highest-risk route in this change so follow-up adoption has a stable reference implementation.

## Migration Plan

1. Add the new structural primitive and ratio-provider contract to `@agenter/svelte-components`.
2. Add the default global ratio store implementation using `idb + BroadcastChannel`.
3. Extend shared workbench toolbar chrome with a takeover slot for compact right-detail close state.
4. Rebuild one existing route from route-local `detailMode + Sheet` to the shared primitive.
5. Add story / DOM / contract coverage for split drag, compact collapse, and toolbar takeover.
6. Update durable specs (`svelte-components-platform`, `svelte-webui-platform`, `workspace-system-workbench`) before implementation is declared complete.

Rollback is straightforward because the new primitive is additive at first. An adopter route can temporarily return to its previous route-local `detailMode + Sheet` path if a regression is discovered, while the shared primitive continues to evolve behind specs and stories.

## Open Questions

- Whether `Messages` and `Terminals` should adopt the new primitive immediately after the first route migration, or after one round of visual validation on desktop and compact viewports.
- Whether the compact right-sheet takeover should eventually evolve from `close-only` into a richer semantic toolbar model. This change intentionally does not solve that future redesign.
