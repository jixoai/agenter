## Why

The current WebUI shell still repeats the same location, status, and action facts across the app header, workspace chrome, chat surface, and mobile drawer. That duplication makes the interface feel noisy, creates confusing Start/Stop affordances, and breaks the intended hierarchy between global navigation, workspace navigation, and route-local actions.

## What Changes

- Rebuild the workspace shell so the app header only handles global location and global navigation.
- Move the session run control into the Chat route as a single state-driven action instead of separate Start and Stop buttons in the header and menu.
- Simplify the mobile drawer so it only exposes global navigation and running-session entry points, without duplicating workspace-local tabs or session actions.
- Rework the workspace shell structure so the workspace context bar and the mobile bottom navigation have distinct layout ownership and do not stack redundant padding.
- Add Apple-style information-architecture guidance to `AGENTS.md` so future WebUI work follows the same hierarchy and disclosure rules.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `webui-chat-navigation`: refine the app header, workspace shell, bottom navigation, and Chat route so each layer owns only one level of navigation, context, and actions.
- `workspace-shell-session-rail`: simplify the compact navigation drawer and running-session entry points so they do not duplicate workspace-local route actions or session controls.

## Impact

- Affected code is concentrated in `packages/webui`, especially the shell frame, header, drawer, bottom navigation, and Chat route toolbar.
- Storybook DOM tests and WebUI integration tests must be updated to lock the new hierarchy and the single-button session control behavior.
- `AGENTS.md` will gain a new design-guidance section for Apple-style information architecture and action hierarchy.
