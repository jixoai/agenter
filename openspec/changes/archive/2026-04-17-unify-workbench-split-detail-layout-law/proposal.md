## Why

The WebUI already has durable `tabs + page-toolbar + page-content` chrome, but the right-side detail region still behaves as feature-local layout code. Fixed drawer widths, viewport breakpoints, and per-route `detailMode` patches keep recreating the same problem: desktop detail panes do not share one resize law, compact fallback behavior drifts by page, and `page-toolbar` cannot temporarily take over as the guaranteed close affordance for a compact right sheet.

This is now a platform-law gap, not a single page bug. The repository needs one shared split-detail workbench layout that owns ratio persistence, width clamping, compact collapse, and toolbar takeover instead of letting each route re-implement them.

## What Changes

- Introduce a shared workbench split-detail layout primitive for `main + right detail` page-content shells.
- Persist the desktop split position as a percentage-based ratio instead of a fixed pixel width.
- Add a configurable ratio source contract:
  - default global persistence via `idb + BroadcastChannel`
  - optional per-layout string key
  - optional custom provider for read/write/subscribe
- Enforce LTR split math with configurable minimum widths, defaulting to `left >= 380px` and `right >= 280px`.
- Derive compact mode from available container width instead of viewport media queries, and collapse the right detail into a shared `rightSheet` once both sides would otherwise violate their minimum widths.
- Add a shared `page-toolbar` takeover contract for compact right-detail mode:
  - `page-toolbar` remains responsible for view switching only
  - when `rightSheet` is open, the toolbar temporarily becomes `close-only`
  - view-specific actions stay in the left-side surface, primarily its `bottom-area`, instead of migrating into toolbar chrome
- Migrate the highest-risk workbench detail surfaces away from route-local `detailMode + Sheet` patches onto the shared primitive.

## Capabilities

### New Capabilities

- `workbench-split-detail-layout`: Shared `main + right detail` workbench layout law covering percentage ratio persistence, min-width clamp, compact `rightSheet` fallback, and `page-toolbar` close takeover.

### Modified Capabilities

- `svelte-components-platform`: The shared structural package will export and own the durable split-detail primitive plus its ratio-source contract instead of leaving this law in feature code.
- `svelte-webui-platform`: Workbench routes will derive compact right-detail collapse and toolbar takeover from the shared layout law rather than page-local breakpoint logic.
- `workspace-system-workbench`: Workspace detail surfaces will keep `page-toolbar` focused on view switching while `bottom-area` remains the action surface and the right detail follows the shared split-detail contract.

## Impact

- `packages/svelte-components/src/layout/*`
- `packages/webui/src/lib/features/navigation/*`
- `packages/webui/src/lib/features/settings/*`
- `packages/webui/src/lib/features/workspaces/*`
- Storybook DOM / contract coverage for shared layout behavior
- `openspec/specs/svelte-components-platform/spec.md`
- `openspec/specs/svelte-webui-platform/spec.md`
- `openspec/specs/workspace-system-workbench/spec.md`
