## Why

The recent Chat and shell iterations exposed the same UI defects repeatedly: inconsistent loading states, duplicate desktop-only status affordances, icon-only controls without tooltip fallbacks, and chat metadata occupying layout rows that should stay available for content. These are not isolated page bugs; they are missing shared contracts.

## What Changes

- Promote shared async-surface treatment for list-style panels and route surfaces so first-load, empty, and refreshing states follow one visual language.
- Tighten the adaptive affordance contract so icon-only controls keep correct padding, tooltip coverage, and stable semantics when labels collapse.
- Remove the desktop-only chat/session status affordance divergence and keep desktop/mobile on one signal-driven pattern.
- Move chat-channel metadata out of a dedicated row and into a tab-adjacent signal disclosure with a dialog-based detail surface.
- Add Storybook-first layout and interaction contracts so these patterns become reusable best practices instead of route-local fixes.

## Capabilities

### New Capabilities
- `surface-signal-disclosure`: Reusable signal-button plus dialog disclosure for passive metadata and secondary details.

### Modified Capabilities
- `adaptive-affordance-controls`: Refine icon-only padding, tooltip fallback, and global adoption requirements for adaptive controls.
- `async-surface-states`: Extend the shared async-surface contract to list and panel loading treatments used by chat-adjacent views.
- `chatapp-surface`: Replace the dedicated metadata row with a signal disclosure pattern and keep desktop/mobile action surfaces aligned.
- `webui-chat-navigation`: Remove redundant desktop-only status chrome and keep passive state expressed through compact signals.
- `webui-layout-review-rubric`: Require component-first Storybook evidence for adaptive controls, passive signals, and loading-state surfaces.

## Impact

- Affected code: `packages/webui/src/components/ui/*`, `packages/webui/src/features/chat/*`, `packages/webui/src/features/shell/*`, `packages/webui/src/router.tsx`
- Affected tests: Storybook DOM contracts, WebUI unit tests, desktop/mobile browser walkthroughs
- Affected docs/specs: shared WebUI best-practice contracts used by future shell and chat work
