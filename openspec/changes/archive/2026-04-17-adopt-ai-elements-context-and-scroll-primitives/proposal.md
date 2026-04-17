## Why

The current Svelte Heartbeat footer still uses a bespoke local Context widget that does not follow the shared ai-elements Context contract the user asked for. At the same time, the shared virtual conversation stack still loses bottom anchoring when a measured group is appended or when the last mounted group grows after async disclosure or remeasurement.

These are both platform-law gaps rather than one-off feature bugs:

- the shared ai-elements Context surface is not modeled as a reusable primitive
- bottom-stick behavior is not part of the shared scroll/virtualization contract
- Heartbeat can accidentally reuse pre-compact usage facts even after a compact cycle resets the active prompt window

If these rules stay route-local, every long transcript surface will keep rediscovering the same drift and every footer-like usage surface will keep reimplementing incompatible context UI.

## What Changes

- Adopt the shared ai-elements `Context / ContextTrigger / ContextContent` composition in Svelte WebUI with the same trigger/content law the user referenced, backed by shared HoverCard and Progress primitives instead of a route-local dropdown state machine.
- Add a durable bottom-anchor contract to `ScrollView` and `VirtualConversation` so appended or remeasured rows can keep the latest visible items pinned without treating programmatic scrolling as user intent.
- Reset Heartbeat footer context after a compact cycle so compact becomes a hard boundary for visible usage math instead of reusing the previous non-compact call.
- Extract reusable variant/type helpers needed by the new primitives so feature code stops importing types from component implementation files.

## Capabilities

### Modified Capabilities

- `scrollview-surface`: shared virtual scrolling gains an explicit bottom-anchor remeasurement law
- `workspace-runtime-shell`: Heartbeat footer context now follows the shared ai-elements Context contract and resets across compact boundaries

## Impact

- `packages/svelte-components/src/scroll-view*`
- `packages/webui/src/lib/components/ai-elements/context/*`
- `packages/webui/src/lib/components/ai-elements/conversation/*`
- `packages/webui/src/lib/components/ai-elements/message/*`
- `packages/webui/src/lib/components/ai-elements/tool/*`
- `packages/webui/src/lib/components/ui/{alert,badge,button,hover-card,progress}/*`
- `packages/webui/src/lib/features/runtime/runtime-heartbeat-status-context.svelte`
- `packages/webui/src/lib/features/runtime/runtime-heartbeat-statusbar-state.ts`
- `packages/webui/src/lib/features/runtime/runtime-heartbeat-statusbar-state.spec.ts`
- `packages/webui/src/lib/features/runtime/runtime-shell-layout-contract.spec.ts`
- `openspec/specs/scrollview-surface/spec.md`
- `openspec/specs/workspace-runtime-shell/spec.md`
