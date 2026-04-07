## Why

Real browser walkthrough now shows that `Terminals > New terminal` creates the terminal but leaves the operator focused on the previously selected terminal. The new tab appears in the workbench, but the create flow breaks the expected create-and-focus handoff.

## What Changes

- Repair the terminal creation flow so a successful create operation lands on the newly created terminal route instead of falling back to the previously selected terminal.
- Make the terminal route handoff wait for the created terminal to become addressable before fallback logic can override it.
- Add focused regression coverage for the create-and-focus handoff.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `webui-terminal-surface`: Terminal creation from the fixed `New terminal` tab must focus the newly created terminal instead of leaving the previous terminal selected.

## Impact

- Affected code: `packages/webui/src/lib/features/terminals/terminal-create-route.svelte`, `packages/webui/src/lib/features/terminals/terminal-route.svelte`, terminal route regression coverage
- Affected systems: WebUI terminal workbench tab handoff, route fallback semantics after terminal creation
- Validation: focused WebUI typecheck/unit coverage plus browser walkthrough for terminal creation on desktop/mobile
