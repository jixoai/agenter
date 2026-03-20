## Why

The current WebUI still leaks cycle-oriented concepts into Chat, hides image input behind model capability gates, and lacks a first-class profile image system for sessions and avatars. At the same time, global settings, typography, and overflow ownership are still too implicit, which keeps producing layout regressions and inconsistent surfaces.

## What Changes

- **BREAKING** Refocus Chat on message bubbles, time dividers, avatars, attachment previews, and expert actions hidden behind per-message context menus instead of cycle-first presentation.
- **BREAKING** Separate "attachment upload is available" from "the current model accepts image input", so Chat and Quick Start always support image paste/drop/pick while surfacing compatibility feedback at send time.
- Add a profile image system with deterministic fallback icons plus upload APIs for session icons and avatar icons.
- Add a dedicated global Settings route for user settings and avatar catalog management while keeping workspace settings workspace-scoped.
- Strengthen layout, overflow, background, typography, and color contracts so Chat, Devtools, and Cycles keep one explicit scroll owner and consistent visual density.

## Capabilities

### New Capabilities
- `profile-image-system`: Session icon fallback generation, icon upload APIs, avatar catalog data, avatar icon upload APIs, and global profile-settings surfaces.

### Modified Capabilities
- `chat-surface-presentation`: Chat becomes bubble-first, hides cycle details behind contextual expert actions, and adds restrained time dividers.
- `chatapp-surface`: The reusable ChatApp surface adds avatars, context menus, and richer attachment-first transcript rendering.
- `multimodal-ai-input`: Image affordances stay available independently from model image-input compatibility, with clearer attachment and compatibility feedback.
- `overflow-layout-contract`: Scroll, clip, and background ownership rules expand to require explicit scroll surfaces after removing raw clipping.
- `workspace-settings`: Workspace settings stay workspace-scoped while a separate global settings surface owns user-level settings and avatar management.
- `webui-chat-navigation`: The shell gains a dedicated global settings route and keeps primary navigation limited to Quick Start and Workspaces.
- `cycles-devtools-timeline`: Cycles remain expert-only, with normalized density, typography, and color use that no longer competes with Chat.

## Impact

- Affected code: `packages/webui`, `packages/client-sdk`, `packages/app-server`, `packages/cli`, `packages/settings`, `packages/avatar`
- New/changed APIs: session icon upload/get, avatar icon upload/get, global settings read/save, avatar catalog list/update
- New tests: Storybook DOM coverage for Chat transcript, AI input attachments, global settings avatar management, and scroll-layout contracts
