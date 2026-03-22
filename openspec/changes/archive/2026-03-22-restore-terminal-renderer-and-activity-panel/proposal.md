## Why

The terminal extraction work landed the renderer as a WebComponent, but the integrated Terminal page regressed: missing color fidelity, missing fit/cover affordances, unstable resize behavior, and no terminal-centric inspection view. The product now needs a dedicated recovery change focused on renderer quality and terminal-id-based inspection.

## What Changes

- Restore terminal renderer quality, including ANSI color fidelity and stable fit-driven sizing.
- Reintroduce terminal page affordances such as `fit` / `cover` view modes and visible geometry/state controls.
- Prevent transport/snapshot feedback loops that cause jitter or backward resets.
- Add a terminal activity inspector that filters related tool calls, reads/writes, attention activity, and API/model facts by `terminalId`.

## Capabilities

### Modified Capabilities
- `terminal-view-component`: renderer supports stable fit/cover presentation without losing live transport behavior.
- `workspace-devtools-surface`: terminal surfaces provide terminal-id-centered inspection, not just raw rendering.

### New Capabilities
- `terminal-activity-inspector`: terminal pages aggregate related runtime facts by terminal id.

## Impact

- Affected code: `packages/terminal-view`, `packages/client-sdk`, `packages/webui`.
- Affected APIs: terminal-view host props, terminal page view-model selectors, and terminal activity filtering logic.
- Affected tests: terminal-view package tests, terminal panel DOM tests, and browser regression coverage.
