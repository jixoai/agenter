## Why

`terminal-view` still emits Lit's `change-in-update` warning in the real Storybook browser run. The terminal surface remains functional, but this warning is objective evidence that the WebComponent schedules a redundant update during its own update lifecycle. Given the terminal renderer is already a hot path with resize, snapshot hydration, and xterm DOM work, we should not leave an avoidable extra update cycle in place.

## What Changes

- Eliminate the `change-in-update` warning from `terminal-view` during real browser rendering.
- Tighten the initialization and geometry-sync path between the WebComponent and its React host so terminal props, snapshot hydration, and DOM measurement do not schedule redundant updates.
- Add an explicit regression contract proving the terminal story renders without Lit update-cycle warnings.

## Capabilities

### Modified Capabilities
- `terminal-view-webcomponent`: terminal-view mounts and hydrates without update-in-update warnings or redundant host-driven rerender churn.
- `workspace-terminals-route`: the WebUI terminal host keeps the same terminal behavior while using a stable mount/update boundary for the WebComponent.

## Impact

- Affected code: `packages/terminal-view`, `packages/webui/src/features/terminal/TerminalViewHost.tsx`, terminal Storybook/DOM tests.
- Affected UX: terminal renderer stability, resize/hydration overhead, and developer-facing browser diagnostics.
