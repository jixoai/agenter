## Why

Real browser walkthrough on mobile shows that the shared workbench tab strip can render a running tab whose visible label is tappable in theory but whose center hit target is actually occupied by the inline `Tab menu` action. In `Avatars > Settings`, this makes the visible `jane` running tab effectively unselectable on mobile.

## What Changes

- Repair the shared workbench tab strip so narrow mobile-sized containers preserve the primary tab hit target instead of letting inline tab actions cover it.
- Collapse inline close/menu affordances out of narrow tab chrome and restore the trigger padding those overlays previously consumed.
- Add focused regression coverage for the shared tab-strip narrow-layout law and re-run mobile/desktop browser walkthroughs.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `svelte-webui-platform`: Compact workbench tabs must keep their primary tap target free from secondary action overlays so running tabs remain selectable on mobile.

## Impact

- Affected code: `packages/webui/src/lib/features/navigation/workbench-tab-strip.svelte`, `packages/webui/src/lib/features/navigation/workbench-tab-strip-contract.spec.ts`
- Affected systems: Shared browser-style workbench tabs across Avatars, Messages, and Terminals
- Validation: focused WebUI unit coverage plus desktop/mobile browser walkthrough of running-tab selection
