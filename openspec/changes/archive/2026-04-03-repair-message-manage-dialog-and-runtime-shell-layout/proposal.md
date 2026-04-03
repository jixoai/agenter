## Why

Two operator-facing surfaces currently violate the WebUI layout rules and degrade the professional workflow.

- The `Manage room` dialog in `Messages` assembles a sidebar inside a dialog without a coherent `header / rail / detail` shell, so the dialog body collapses into an oversized empty canvas while the actual management content occupies only a narrow strip.
- The runtime shell behind `Running Avatars`, especially `Attention` and its peer tabs, exposes weak information hierarchy: the main stage looks empty, the right rail is visually over-weighted, and the shell does not use clear semantic surfaces for primary versus secondary facts.

These are not isolated CSS bugs. They are feature-layer assembly problems that break the project's scroll ownership, sidebar, and information-architecture contracts.

## What Changes

- Rebuild the `Manage room` dialog as a true dialog-sidebar management shell with explicit rail, top summary, and detail stage ownership.
- Rebuild the runtime shell main stage so `Attention`, `Cycles`, `Systems`, `Observability`, and `Settings` use semantic primary surfaces and a quieter secondary facts rail.
- Add regression coverage for room-management dialog composition and runtime-shell layout-critical behaviors.

## Capabilities

### Modified Capabilities

- `message-system-surface`
- `workspace-runtime-shell`
- `scrollview-surface`

## Impact

- `packages/webui/src/lib/features/messages`
- `packages/webui/src/lib/features/runtime`
- `packages/webui/tests/e2e`
