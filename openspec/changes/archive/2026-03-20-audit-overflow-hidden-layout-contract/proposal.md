## Why

The WebUI currently overuses `overflow-hidden` as a layout escape hatch, especially across shell and panel wrappers. That hides real sizing and scrolling bugs, causes clipped content and broken mobile/detail layouts, and makes new surfaces regress unless the same accidental pattern is repeated.

## What Changes

- Audit every current `overflow-hidden` usage in `packages/webui` and classify it as layout, scroll, visual clip, or animation mask.
- Introduce shared overflow primitives so layout surfaces, scroll surfaces, and visual clipping surfaces stop reusing the same raw Tailwind class.
- Refactor shell and panel containers so each application surface has a single deliberate scroll container instead of nested hidden/auto combinations.
- Tighten `AsyncSurface` so it only models async states and no longer silently becomes a clipping wrapper.
- Add source-contract tests and update AGENTS best practices so new raw `overflow-hidden` usage fails review quickly.
- **BREAKING**: WebUI layout wrappers will no longer be allowed to use raw `overflow-hidden` except through approved primitives and explicit animation masks.

## Capabilities

### New Capabilities
- `overflow-layout-contract`: defines the allowed overflow roles for WebUI layout, scroll, clip, and animation surfaces

### Modified Capabilities
- `async-surface-states`: shared async surfaces now separate state rendering from clipping/scroll ownership
- `webui-chat-navigation`: workspace shell and master-detail layouts now enforce explicit scroll ownership instead of nested hidden wrappers

## Impact

- Affected code spans `packages/webui/src/components/ui`, `packages/webui/src/features/shell`, and the major workspace/chat/devtools panels.
- Shared UI interfaces change around async surface composition and new overflow primitives.
- Storybook DOM coverage and source-contract tests need to enforce the new layout rules.
