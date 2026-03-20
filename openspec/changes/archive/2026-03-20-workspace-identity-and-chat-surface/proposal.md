## Why

The current WebUI still misses several product-level behaviors from the original target: Chat media input is incomplete, Session and Avatar identity surfaces are inconsistent, Devtools typography and scrolling remain uneven, and navigation boundaries between global entry points and page-local headers are still blurred. These gaps now block the app from feeling like a coherent workspace product rather than a collection of partially aligned panels.

## What Changes

- Add a dedicated identity-media capability for stable Session icons and Avatar images, including default generation, upload endpoints, and explicit separation between session media and avatar media.
- Add a global user-settings capability so global settings and avatar management live in application navigation instead of being mixed into workspace-local headers.
- Move the GlobalSettings entry into the left navigation and tighten the shell rule that `TopHeader` only expresses the current page's location and local navigation, never global app entry points.
- Upgrade the Chat surface so it keeps a conversation-first bubble flow, hides cycle-level expert affordances behind message context menus, and restores working image upload / preview behavior.
- Normalize Cycles / Devtools typography, color usage, tooltip usage, and overflow ownership so compact and desktop layouts remain scrollable and legible down to small mobile viewports.

## Capabilities

### New Capabilities
- `identity-media-assets`: stable Session icon and Avatar media generation, fallback rendering, upload, and retrieval contracts.
- `global-user-settings`: application-level user settings and avatar management that remain separate from workspace settings.

### Modified Capabilities
- `workspace-shell-session-rail`: the global navigation rail now owns the GlobalSettings entry and continues to own running-session entry points without polluting page-local chrome.
- `workspace-settings`: workspace settings remain workspace-scoped while global user settings and avatar management move out of this surface.
- `chatapp-surface`: Chat gains complete media input behavior and keeps cycle-oriented expert actions behind bubble-level context menus.
- `chat-surface-presentation`: Chat continues to be conversation-first, with centered time dividers and without global-entry pollution in the page header.
- `workspace-devtools-surface`: Devtools keeps technical inspection local to Devtools while adopting normalized type, color, tooltip, and scroll behavior.
- `cycles-devtools-timeline`: cycle timeline typography and color density are tightened for readable technical inspection.
- `overflow-layout-contract`: overflow, background ownership, and small-viewport fallback rules expand to cover Chat, Devtools, and shell navigation boundaries.

## Impact

- Affected code: `packages/webui/src/features/chat/*`, `packages/webui/src/features/cycles/*`, `packages/webui/src/features/loopbus/*`, `packages/webui/src/features/shell/*`, `packages/webui/src/features/settings/*`, related navigation primitives, and app-server media routes.
- Affected APIs: new Session icon and Avatar media endpoints, plus global user-settings read/write surfaces.
- Affected tests: Storybook DOM coverage for chat/media/navigation components, focused unit tests for identity-media generation and layout contracts, and browser walkthrough updates for desktop/mobile navigation.
