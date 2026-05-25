## Why

The current `agenter-ext-shell` product has no product-facing way to select an official non-default terminal backend, so users cannot explicitly request `ghostty-native` even though the platform law already reserves that backend ownership slot for Termless. At the same time, cli-shell still treats `bottom` as a multi-row dialogue placement, which violates the terminal-first law now required for this product: the shell-terminal bottom surface must remain exactly one rendered line.

## What Changes

- Add explicit `--backend=<name>` grammar to `agenter-ext-shell`, keeping the current default backend as xterm while allowing opt-in `ghostty-native`.
- Plumb backend launch truth through product-extension runtime, terminal control-plane, and runtime terminal config surfaces so product code can create, inspect, and reuse terminals without collapsing backend identity into renderer preference.
- Adopt official `@jixo/ghostty-native` as the opt-in backend implementation for cli-shell while keeping xterm as the default backend until a later verified promotion change.
- Redefine cli-shell bottom rendering as a one-line markdown projection: constrain width, render with OpenTUI `MarkdownRenderable`, and display only the last rendered line.
- Remove the multi-row bottom dialogue panel contract; explicit transcript chrome remains separate from the single-line bottom projection.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `cli-shell-product`: add explicit backend selection and replace bottom multi-row dialogue behavior with a single-line markdown projection law.
- `product-extension-runtime`: let product terminal-binding contracts carry durable backend launch truth independently from renderer preference.
- `runtime-terminal-contract`: expose explicit backend launch truth through runtime terminal config reads and writes.
- `terminal-control-plane`: persist explicit terminal backend launch truth across create/list/get-config/set-config without mixing it with renderer preference.
- `termless-backend-adoption`: adopt official `@jixo/ghostty-native` as an opt-in backend without promoting it to the default slot.

## Impact

- `packages/cli-shell/src/argv.ts`
- `packages/cli-shell/src/bootstrap.ts`
- `packages/cli-shell/src/tui/*`
- `packages/client-sdk/src/product-extension-runtime.ts`
- `packages/client-sdk/src/runtime-store.ts`
- `packages/product-extension-runtime/src/*`
- `packages/terminal-system/src/terminal-control-plane.types.ts`
- `packages/terminal-system/src/terminal-control-plane.ts`
- `packages/terminal-system/src/terminal-db.ts`
- `packages/termless-core/src/*`
- `openspec/specs/cli-shell-product/spec.md`
- `openspec/specs/product-extension-runtime/spec.md`
- `openspec/specs/runtime-terminal-contract/spec.md`
- `openspec/specs/terminal-control-plane/spec.md`
- `openspec/specs/termless-backend-adoption/spec.md`
