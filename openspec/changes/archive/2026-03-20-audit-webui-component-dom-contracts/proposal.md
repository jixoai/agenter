## Why

The current WebUI surface already has a healthy Storybook DOM baseline, but several high-interaction components in the active dirty area still rely on coarse route-level coverage or oversized files. That makes regressions harder to isolate and slows down iteration as chat and Devtools continue to grow.

## What Changes

- Refactor the current dirty Chat surface into smaller reusable transcript and attachment components instead of continuing to grow route-sized files.
- Refactor the current dirty LoopBus/Devtools surface into smaller panel sections with clearer scroll ownership and tab responsibilities.
- Add independent Storybook stories and Vitest browser contracts for the newly isolated high-interaction components.
- Keep shell-only integration surfaces on route/browser verification instead of forcing stories for components that are not meaningful in isolation.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `chatapp-surface`: tighten the reusable ChatApp contract around independently composable transcript, bubble, and attachment surfaces.
- `workspace-devtools-surface`: tighten the Devtools contract around independently operable technical panels with stable tab and scroll behavior.
- `overflow-layout-contract`: require explicit scroll ownership when transcript and Devtools internals are decomposed into smaller surfaces.

## Impact

- Affected code: `packages/webui/src/features/chat/*`, `packages/webui/src/features/loopbus/*`, and related Storybook tests.
- Affected tests: `packages/webui/test/storybook/*` plus focused unit coverage for refactored panels.
- No backend or transport API changes.
