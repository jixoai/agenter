## Why

The current Svelte WebUI still places superadmin/profile management under `/avatars/settings`, leaves workspace settings without the old source/view provenance workbench, and duplicates running-avatar navigation through a secondary detail card that no longer adds unique value once runtime tabs already exist in the Avatars tab strip. At the same time, the current workbench tab strip is too weak to serve as a durable browser-like navigation law because it cannot express close, loading, tooltip, badge, or context-menu behavior, and it still leaves title, metadata, and page actions floating outside the tab chrome instead of below it in one Chrome-like toolbar row. Even after introducing the first window shell, several route bodies still render as detached cards inside that window, and the toolbar still reads like a metadata strip instead of a browser toolbar.

## What Changes

- Move the current superadmin/profile surface out of `/avatars/settings` into a dedicated auxiliary `/admin` route that is entered from the left footer `super admin` affordance.
- Rebuild `/avatars/settings` as a true workspace settings workbench with workspace master rail, effective/layer source tabs, schema-driven view mode, provenance jump, and source editing semantics.
- Remove the redundant `Running Avatars` right-side card and compact sheet from the Avatars workbench so running avatars live only as dynamic top-level tabs inside Avatars.
- Introduce a shared chrome-style workbench tabs primitive backed by the active Svelte shadcn-svelte / bits-ui composition law, including icon/avatar adornments, badge/loading state, rich tooltip, close actions, and context-menu extension points.
- Add a companion responsive toolbar row beneath the tabs so each workbench can mount page title, status metadata, and local actions into one reusable browser-like chrome surface.
- Fuse the tab content surface into that same shared chrome so each primary route renders as one Chrome-like window instead of a detached header plus body stack.
- Introduce a shared integrated workbench page/pane scaffold so route roots inside that window stop rendering as independent outer cards, while split panes still retain a quieter secondary surface.
- Refine the shared toolbar chrome so the lower row reads as a browser toolbar with clearer sectioning, denser rhythm, and a dedicated signal rail instead of generic badge stacking.
- Add explicit workbench open-tab state so closing a room, terminal, or running-avatar tab removes it from the current workbench without deleting the underlying durable resource or stopping a session.
- Update durable specs and WebUI verification so the Svelte platform, runtime shell, workspace settings, and workbench tabs all share the same navigation law.

## Capabilities

### New Capabilities

- `workbench-tabs`: Shared browser-style workbench chrome for Avatars, Messages, and Terminals, including route truth, rich tab affordances, a responsive toolbar companion, a fused content window surface, and close/context-menu semantics.

### Modified Capabilities

- `workspace-settings`: `/avatars/settings` becomes the workspace-scoped settings workbench, including the global workspace `~/` through the same model.
- `workspace-runtime-shell`: running avatars move from a secondary rail/detail-card law into dynamic Avatars workbench tabs while keeping runtime detail as reload-safe routes.
- `svelte-webui-platform`: top-level Svelte navigation keeps only `Avatars`, `Messages`, and `Terminals` as primary destinations, with `/admin` as an auxiliary footer entry instead of a primary route.

## Impact

- Affected code: `packages/webui` shell, routes, avatars/messages/terminals workbench layouts, settings features, tab/toolbar primitives, DOM tests, and browser/e2e coverage.
- Affected APIs: no new server protocol shape is required; the WebUI starts consuming the existing scoped settings graph contract more fully.
- Affected specs/docs: OpenSpec delta specs, `SPEC.md`, and `packages/webui/README.md`.
