## Why

The current workspace shell still mixes shell chrome ownership with route content ownership, which is why padding, duplicate headers, and broken scrolling keep resurfacing across Chat, Devtools, and Settings. We now need one adaptive scaffold contract that decides navigation placement by viewport class plus orientation, while letting each route keep its own deliberate scroll model.

## What Changes

- **BREAKING** Replace the current compact-only shell decision with an adaptive viewport model based on width class plus orientation.
- **BREAKING** Reduce `AppHeader` to a passive global status bar and move workspace route title, route navigation, and session actions into a dedicated workspace header.
- Show `BottomNavBar` only for workspace routes on portrait compact/medium layouts; desktop and landscape workspace routes use top route navigation instead.
- Keep Chat conversation-first with a single transcript scroll owner and a fixed composer, while moving the session action surface out of the chat body card.
- Present Devtools Cycles and workspace Settings layers as split panes on desktop/landscape and as right-side detail sheets on portrait compact layouts.
- Tighten shell layout and overflow contracts so route wrappers size content without becoming accidental clipping or scrolling layers.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `webui-chat-navigation`: workspace shell navigation becomes adaptive by width class plus orientation, and route headers stop duplicating global chrome.
- `chat-surface-presentation`: Chat keeps one conversation viewport and fixed composer while route-level session controls move into workspace-local header chrome.
- `workspace-devtools-surface`: Devtools uses route-owned tabs and adaptive split-pane or right-sheet detail presentation instead of one layout for every viewport.
- `workspace-settings`: workspace settings adopt the same adaptive split-pane or right-sheet detail model for layer inspection.
- `overflow-layout-contract`: shell wrappers must preserve explicit scroll ownership per route and stop using shared padding stacks that break compact and desktop scrolling differently.

## Impact

- Affected code: `packages/webui/src/features/shell/*`, `packages/webui/src/features/chat/*`, `packages/webui/src/features/process/*`, `packages/webui/src/features/settings/*`, and `packages/webui/src/router.tsx`.
- Affected tests: shell/navigation DOM contracts, route layout tests, and desktop/mobile browser walkthrough coverage.
- No backend API changes.
