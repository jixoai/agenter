## Why

The WebUI currently pays too much render cost for hot runtime updates because large parts of the application subscribe to one broad runtime snapshot and heavy surfaces mount rich renderers inside fast-changing scroll regions. At the same time, the existing overflow cleanup still lacks a strict ownership contract for clipping and background surfaces, so layout fixes regress whenever rounded containers and ad-hoc backgrounds get mixed again.

## What Changes

- Add a runtime-to-WebUI publication contract that isolates session-scoped updates, coalesces hot event bursts, and prevents unrelated shell surfaces from rerendering on every runtime event.
- Refactor WebUI runtime consumption so route surfaces subscribe to narrow selectors instead of mirroring the full runtime snapshot through `App.tsx`.
- Tighten the overflow contract with a companion surface/background contract that separates layout wrappers, scroll owners, clipping surfaces, and semantic background surfaces.
- Audit existing `bg-*` usage alongside `overflow-hidden` and move shell/panel composition onto approved surface primitives.
- Add regression coverage for render isolation, hot-event batching, and overflow/background source contracts.
- **BREAKING**: WebUI layout wrappers will no longer be allowed to own raw background or clipping behavior outside the approved surface primitives.

## Capabilities

### New Capabilities
- `runtime-ui-publication`: defines how runtime clients publish scoped, coalesced updates so hot session activity does not destabilize unrelated UI surfaces

### Modified Capabilities
- `overflow-layout-contract`: extend overflow ownership with companion surface/background ownership rules
- `async-surface-states`: shared async surfaces remain state-only primitives and do not silently become clipping or background-owning wrappers
- `webui-chat-navigation`: shell and route surfaces keep one explicit scroll owner per region while global shell chrome stays insulated from route-local hot updates

## Impact

- Affected code spans `packages/client-sdk`, `packages/webui`, and the runtime selector plumbing in the application shell.
- WebUI internal composition changes around runtime state access, surface primitives, and layout contracts.
- Unit, Storybook DOM, and browser-performance verification all need to be updated to prove the new render and layout guarantees.
