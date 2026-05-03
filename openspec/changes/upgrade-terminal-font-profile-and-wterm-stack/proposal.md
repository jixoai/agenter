## Why

The terminal presentation contract still stops at `rendererPreference + theme + cursor`, and the viewport stack still assumes every renderer looks like one xterm-style widget. That is no longer enough now that terminal presentation needs durable font control, a local config surface, and real `wterm` support where `@wterm/ghostty` is only a core and `@wterm/dom` is the actual browser host.

## What Changes

- **BREAKING** add a durable terminal `font` profile to terminal-system and thread it through app-server, client-sdk, WebUI, and terminal-view without compatibility aliases.
- Upgrade terminal-view's renderer law from “one widget adapter” to “one renderer stack adapter” so each adapter can privately own its runtime/core/DOM host split.
- Formally support a `wterm` renderer stack by composing `@wterm/ghostty` core loading with `@wterm/dom` hosting inside terminal-view, instead of leaking renderer-specific glue into host code.
- Add one shared terminal font resolver and renderer-specific mapping for `xterm`, `ghostty-web`, and `wterm`.
- Correct terminal viewport geometry law so `terminal-window` consumes renderer-measured native content metrics instead of treating one fallback cell-size formula as geometry truth for every engine.
- Narrow `wterm` and `ghostty-web` to viewport-primitive behavior by removing adapter-host chrome assumptions and by rebuilding from snapshot truth whenever font mutation cannot settle safely in place.
- Replace the titlebar config dropdown with a dialog-owned draft/apply flow so presentation changes are staged locally before they mutate terminal-system durable truth.
- Add adapter-owned presentation mutation policy plus one `terminal-view-presentation-ready` ack so hosts know when a renderer change, rebuild, or live-apply has actually settled.
- Keep `rendererPreference`, `theme`, `cursor`, and `font` owned by terminal-system durable config; keep `resolvedRenderer` front-end local; keep AI-facing terminal config mutation surfaces read-only for presentation fields.
- Write the `ghostty-web` / `wterm` rationale into OpenSpec, code comments, and durable specs so the next engineer can recover the design after context loss.

## Capabilities

### New Capabilities
- `terminal-font-profile`: Durable terminal font profile, default font law, and renderer-specific font mapping contract.

### Modified Capabilities
- `terminal-process-profiles`: Terminal process profiles now include durable font metadata and browser-authenticated presentation mutation while AI-facing mutation stays excluded.
- `terminal-renderer-adapter`: Renderer resolution and adapter law now explicitly covers renderer stacks such as `wterm(core + dom host)`, not only one widget instance.
- `terminal-view-component`: `terminal-view` now consumes the shared font profile, reports renderer-owned native viewport metrics, rebuilds safely from snapshot truth, and supports `wterm` through the same viewport primitive contract.
- `terminal-system-surface`: The terminal window titlebar now owns one dialog-based config surface for theme/font/renderer controls while preserving fit/cover chrome law and sizing the window from renderer-measured terminal content.

## Impact

- Affected packages:
  - `packages/terminal-system`
  - `packages/app-server`
  - `packages/client-sdk`
  - `packages/terminal-view`
  - `packages/webui`
- Affected durable fields:
  - add `profile.font`
  - expand browser-authenticated terminal config mutation to presentation fields
- Affected dependencies:
  - add `@wterm/dom`
  - add `@wterm/ghostty`
- Affected tests:
  - terminal-view unit tests
  - terminal renderer adapter unit tests for metrics/font settlement
  - terminal route / terminal surface projection tests
  - Storybook DOM coverage for terminal titlebar config behavior
