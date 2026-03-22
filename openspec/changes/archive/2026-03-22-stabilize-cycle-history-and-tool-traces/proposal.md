## Why

Recent lifecycle and runtime changes fixed some correctness issues but introduced new regressions in Devtools: stopping a session can blank out persisted cycle history, and tool-call/tool-result records still render as separate cards with incorrect loading state. The inspection experience now needs a dedicated stabilization pass.

## What Changes

- Preserve persisted chat/cycle inspection data when runtime state is cleared after pause or abort.
- Merge tool-call and tool-result records into one tool trace card in Cycle detail.
- Keep Cycle timeline/detail scrolling stable with one clear scroll owner per panel.
- Ensure stopped or paused sessions still render their persisted cycle history in Devtools.

## Capabilities

### Modified Capabilities
- `workspace-devtools-surface`: cycle inspection remains available after lifecycle transitions and renders merged tool traces.
- `overflow-layout-contract`: cycle timeline and detail keep stable independent scroll owners.

## Impact

- Affected code: `packages/client-sdk`, `packages/webui`.
- Affected APIs: runtime-store clearing behavior and cycle inspection view-model assembly.
- Affected tests: runtime-store tests, cycle detail DOM tests, and Storybook contract coverage.
