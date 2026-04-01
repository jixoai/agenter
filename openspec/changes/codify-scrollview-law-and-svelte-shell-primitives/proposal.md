## Why

The current frontend still contains raw `overflow-*` scrolling and multiple bespoke virtualized list implementations spread across feature code. We need one explicit scrolling law and one primitive that owns scrolling behavior, so layout bugs stop reappearing during the Svelte replatform.

## What Changes

- **BREAKING** ban raw scroll ownership in WebUI feature code; scrolling must go through a shared `ScrollView` primitive.
- Add a `ScrollView` primitive that supports both regular scrolling and virtualized rendering.
- Normalize shell-level composition around shadcn-svelte primitives instead of ad hoc containers.
- Add verification that prevents new feature code from reintroducing raw `overflow-auto/scroll` patterns.
- Update durable best-practice documents so the scroll law is explicit and framework-agnostic.

## Capabilities

### New Capabilities
- `scrollview-surface`: Define the shared scroll primitive, ownership rules, and verification contract for the new WebUI.

### Modified Capabilities
None.

## Impact

- Affected packages: `@agenter/webui`
- Affected durable docs: `AGENTS.md`, `TESTING.md`, package-level UI specs
- Affected UI behavior: dialogs, sheets, transcripts, lists, inspector surfaces, horizontal code/data viewers
