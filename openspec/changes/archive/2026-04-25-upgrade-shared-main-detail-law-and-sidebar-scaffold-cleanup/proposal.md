## Why

The repository now has two conflicting layout laws: route-level `main + right detail` pages are documented as shared split-detail surfaces, but the actual platform only unifies compact sheet behavior while desktop detail visibility is still reimplemented or missing. At the same time, `SplitView` still carries an ambiguous “generic split shell” name that keeps static sidebar shells and stateful main-detail shells mentally mixed together.

## What Changes

- Upgrade the shared split-detail law so one `detailOpen` state drives desktop persistent detail visibility and compact right-sheet visibility without route-local hacks.
- Add a dedicated shared host for split-detail page assembly so `WorkbenchPageContent` and feature routes stop half-implementing visibility, close ownership, and compact transitions on their own.
- Introduce `SidebarScaffold` as the only static `sidebar + content` shell and migrate all remaining `SplitView` consumers to it.
- **BREAKING** Remove the `SplitView` export, its unused multi-variant API, and all app/test/doc references after consumers are migrated.
- Update durable docs and OpenSpec contracts so the repository has one explicit law for stateful main-detail surfaces and one explicit law for static sidebar shells.
- Add regression coverage that prevents `SplitView` from reappearing and locks `SidebarScaffold` plus unified split-detail visibility into place.

## Capabilities

### New Capabilities
- `sidebar-scaffold-layout`: Shared static `sidebar + content` scaffold law with package-owned responsive behavior and no pseudo detail semantics.

### Modified Capabilities
- `workbench-split-detail-layout`: Shared split-detail routes now support one desktop+compact visibility source of truth instead of only compact-sheet visibility.
- `svelte-components-platform`: The shared structural package replaces `SplitView` with `SidebarScaffold` and tightens the split-detail primitive boundary around geometry/persistence only.
- `svelte-webui-platform`: WebUI routes consume `SidebarScaffold` for static sidebar shells and the shared split-detail host for every `main + right detail` surface.
- `overflow-layout-contract`: The package-owned responsive split-shell contract now belongs to `SidebarScaffold`, not `SplitView`.

## Impact

- `packages/svelte-components`: layout exports, static sidebar scaffold primitive, split-detail primitive contract tests.
- `packages/webui`: workbench navigation host, route/page assemblies, settings panel, dialogs, stories, and DOM/contract tests.
- Durable repository docs: `SPEC.md`, `DESIGN.md`, `packages/svelte-components/SPEC.md`, and related OpenSpec capability specs.
