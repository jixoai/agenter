## Why

The terminal route still uses the older `SplitView` shell while newer workbench surfaces already use `WorkbenchSplitDetail` for durable `main + detail` behavior. This leaves the terminal page without shared ratio persistence, without the shared resize handle law, and with a layout contract that diverges from the rest of the WebUI workbench.

## What Changes

- Replace the terminal surface root layout from `SplitView` to the shared split-detail workbench shell.
- Persist the desktop `main/detail` ratio through the shared split-detail persistence contract instead of using a fixed detail width.
- Keep compact terminal flows reachable through the same right-sheet fallback used by shared `WorkbenchPageContent` split-detail adopters instead of inventing a terminal-only stacked fallback.
- Add terminal-specific layout regressions for the shared split-detail adoption and compact sheet behavior.
- Move terminal route-local identity and detail-view switching into the shared `page-toolbar` host instead of leaving static shell copy in `terminals-workbench-layout` and local view tabs inside the detail pane.
- Remove the outer giant `WorkbenchWindow` body card treatment from the terminal route so the stage pane and detail pane own their own surfaces without being wrapped by a second rounded shell.
- Extract a shared actor selector primitive so terminal `Call tool as`, terminal `Grant actor`, and the message-room viewer chooser reuse the same avatar + nickname (+ optional second line) contract.
- Keep terminal help copy inside the shared `HelpHint` affordance, and make the help-hint primitive layer above compact shell chrome so the popup stays readable on mobile.
- Render terminal action facts through the same structured tool invocation viewer stack used by Heartbeat instead of keeping a terminal-only legacy preview path, while suppressing viewer-mode chrome that does not fit the narrow terminal rail.
- Rebuild the terminal action composer around `InputGroup` so write and read both live inside the stage body instead of reviving a second footer surface, with compact single-line actor selection and inline call actions living in the shared addon row.
- Surface authoritative terminal runtime status in the page-toolbar `status` slot, while explicitly deferring PTY lifecycle buttons such as `bootstrap` and `kill pty` until the shared backend/client contract exists.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `terminal-system-surface`: the terminal route layout contract changes from generic split primitives to the shared split-detail shell with persistent desktop rails and a shared compact right-sheet fallback.
- `terminal-system-surface`: the terminal route now owns its page-toolbar content, keeps an actions-only detail rail in the page, opens terminal user management from a dedicated toolbar dialog affordance, and reuses the shared actor selector contract for identity-bearing seat pickers.
- `terminal-system-surface`: the terminal page-toolbar now treats `Actions` as the stateful current-detail toggle, while `Users` remains a plain dialog-opening action.
- `terminal-system-surface`: the toolbar help affordance now uses the shared help-hint primitive correctly and stays readable above compact shell chrome.
- `terminal-system-surface`: terminal action facts now reuse the same structured preview surface as Heartbeat, but stay in plain/static viewer mode inside the terminal action rail.
- `terminal-system-surface`: the write/read composer now uses one shared `InputGroup`-driven layout with compact inline selectors and addon-row call actions instead of a detached scaffold footer row.
- `terminal-system-surface`: the selected-terminal toolbar now publishes authoritative `running/stopped` and `busy/idle` runtime facts through the shared status slot instead of leaving terminal state buried inside the stage body.
- `messages-workbench`: the room viewer chooser reuses the same shared actor selector primitive instead of hand-rolling another avatar select surface.

## Impact

- `packages/webui/src/lib/features/terminals/terminal-system-surface.svelte`
- `packages/webui/src/lib/features/terminals/terminal-page-toolbar-content.svelte`
- `packages/webui/src/lib/features/terminals/terminal-system-surface.story-harness.svelte`
- `packages/webui/src/lib/features/terminals/terminal-system-surface-layout.spec.ts`
- `packages/webui/src/lib/features/terminals/terminal-system-surface.stories.ts`
- `packages/webui/test/storybook/terminal-system-surface.stories.test.ts`
- `packages/webui/src/lib/features/terminals/terminals-workbench-layout.svelte`
- `packages/webui/src/lib/features/messages/room-page-toolbar-content.svelte`
- `packages/webui/src/lib/features/collaboration/actor-select.svelte`
- `packages/webui/src/lib/features/collaboration/actor-select.types.ts`
- `packages/web-components/src/help-hint-element.ts`
- `packages/webui/src/lib/components/web-components/tool-invocation-card.svelte`
- No backend, transport, or terminal-core API changes
- PTY lifecycle buttons remain out of scope for this change because the shared app-kernel / TRPC / client-sdk stack does not yet expose explicit bootstrap or kill mutations
