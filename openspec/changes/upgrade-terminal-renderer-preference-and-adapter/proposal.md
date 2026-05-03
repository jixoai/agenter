## Why

The terminal viewport is still built around one concrete renderer implementation (`xterm`) and leaks renderer-private assumptions into durable profile fields, WebComponent host logic, CSS selectors, DOM tests, and AI-facing config mutation surfaces. That blocks the current product goal of defaulting desktop WebUI to `ghostty-web`, and it would make future `wterm` experiments repeat the same coupling failure instead of composing through one stable renderer law.

This change is needed now because terminal-window fit/cover stabilization has already exposed that renderer behavior is a first-class product concern: `ghostty-web` is preferred for desktop due to better rendering architecture and scale-safe text selection, while `wterm` is a future candidate for web/mobile accessibility. Without a renderer-preference contract plus adapter layer, every new renderer would force another host rewrite.

## What Changes

- Introduce durable terminal renderer preference plus declarative terminal `theme` and `cursor` identities as terminal-system owned profile facts instead of AI-managed mutable knobs.
- Replace the single concrete `rendererEngine` assumption with a two-stage contract:
  - `rendererPreference`: actor-configured durable preference (`auto | ghostty-web | wterm | xterm`)
  - `resolvedRenderer`: front-end resolved concrete renderer (`ghostty-web | wterm | xterm`)
- Add a shared terminal renderer adapter contract in `@agenter/terminal-view` so renderer-specific DOM, input, fit, metrics, theme, and scroll behavior are encapsulated behind one viewport primitive.
- Default front-end renderer resolution to `auto -> ghostty-web` for current desktop WebUI, while keeping room for future `auto -> wterm` on mobile/touch-first environments.
- Remove renderer/theme mutation authority from AI-facing runtime terminal config descriptors; those fields remain terminal-system durable truth but are no longer model-managed.
- Replace xterm-private host assumptions (`.xterm-*` selectors, `_core` metric reads, xterm-only helper textarea selectors) with adapter-owned behavior and public viewport facts.
- Define a shared terminal theme surface where top-level configuration is declarative (`theme` name + `cursor` style), while each renderer adapter maps those declarations to its own supported background/foreground/selection/cursor capabilities with room for renderer-specific tolerance and partial support.
- Persist the decision rationale itself in spec/design/comment guidance so future work can recover why:
  - desktop currently prefers `ghostty-web`
  - web/mobile may later prefer `wterm`
  - `auto` exists to let the front-end resolve that policy without pushing renderer choice into AI or back-end lifecycle code

## Capabilities

### New Capabilities
- `terminal-renderer-adapter`: Shared renderer preference, resolution, and adapter law for terminal viewport implementations.
- `terminal-theme-profile`: Durable terminal theme identity and resolved theme projection owned by terminal-system and consumed by viewport hosts.

### Modified Capabilities
- `terminal-process-profiles`: Terminal profile metadata now includes durable renderer preference plus declarative theme/cursor identities instead of one renderer-specific field.
- `terminal-surface-projection`: Terminal projection now carries durable renderer/theme/cursor facts for client-side resolution.
- `terminal-view-component`: The viewport primitive now resolves renderers through a shared adapter contract and must not depend on one renderer's private DOM or metric internals.
- `client-runtime-store`: Normalized global terminal entries now preserve renderer preference plus theme/cursor metadata, while front-end state derives resolved renderer facts locally.
- `runtime-json-tool-descriptor-surface`: AI-facing runtime terminal config mutation no longer owns renderer/theme mutation authority.
- `webui-terminal-surface`: WebUI terminal surfaces resolve `auto` renderer preference locally, default to `ghostty-web` on current desktop WebUI, and consume shared theme background instead of feature-local renderer assumptions.

## Impact

- Affected packages:
  - `packages/terminal-system`
  - `packages/terminal-view`
  - `packages/client-sdk`
  - `packages/app-server`
  - `packages/webui`
- Affected durable/profile fields:
- replace `rendererEngine` directly
- add `rendererPreference`, `theme`, `cursor`, and resolved theme projection where appropriate
- Affected external dependencies:
  - add `ghostty-web` as a real renderer dependency in the shared terminal viewport package
  - preserve `xterm` as a supported adapter implementation
- Affected tests:
  - terminal-view unit tests
  - client runtime store normalization tests
  - WebUI terminal stories / DOM tests / e2e selectors
- Migration note:
  - This change is intentionally allowed to be breaking. It does not preserve long-term dual-write or compatibility aliases as an architectural goal; implementation should move directly to the target contract.
- Recovery note:
  - If implementation work pauses or the next engineer loses context, resume from this change by reading `proposal.md` for the objective, `design.md` for the layering rules, `specs/*` for contracts, and `tasks.md` for the execution order. The first implementation checkpoint is to establish the new durable data model before any renderer swap in feature code.
  - The reasoning behind `ghostty-web`, `wterm`, and `auto` is part of the change itself and must not remain conversation-only context.
