## Why

The workspace shell still carries two headers and an optional bottom navbar. That splits navigation across layers, duplicates route context, and costs vertical space. The Chat composer also uses fixed-width controls, so helper content and button labels break down poorly as the container shrinks.

## What Changes

- Merge the global header and workspace header into one unified `TopHeader` surface with clear app-level vs workspace-level sections.
- Remove `BottomNavbar` entirely and keep workspace route switching in the top shell only.
- Preserve the rule that `GlobalSettings` belongs only to left-side global navigation, never to page-local header chrome.
- Add adaptive icon-button primitives using container queries plus `ResizeObserver` so button labels can appear or collapse based on available width.
- Refactor the Chat composer toolbar so helper hints collapse into a `?` rich-tooltip and Attach/Screenshot controls degrade to icon-only affordances in tight layouts.
- Add Storybook DOM coverage for the single-header shell and adaptive composer behavior.

## Capabilities

### New Capabilities
- `adaptive-affordance-controls`: Container-aware icon+label controls that can collapse into icon-only affordances while preserving tooltip accessibility.

### Modified Capabilities
- `webui-chat-navigation`: Workspace navigation moves fully into the unified top header and no longer uses a bottom navbar.
- `chat-surface-presentation`: The shared composer becomes container-aware and keeps help secondary to the send flow.
- `workspace-shell-session-rail`: Compact layouts still use the global drawer for running sessions and GlobalSettings, but workspace route tabs no longer move into a bottom navigation bar.

## Impact

- Affected code: `packages/webui/src/features/shell/*`, `packages/webui/src/features/chat/AIInputToolbar.tsx`, new adaptive affordance primitives, and related Storybook/DOM tests.
- Affected behavior: application header layout, compact workspace navigation, and chat composer responsiveness.
- No backend or transport contract changes.
