## Why

The active Svelte WebUI still leaks obsolete shell chrome, lacks a generic entity icon authority for room-first navigation, and ships a stripped-down room chat surface that regressed from the richer React-era composer and bubble behavior. Global rooms also still stop at text-only send because room-owned attachment transport was never finished, which now blocks the room experience the product is already trying to present.

## What Changes

- Remove the redundant global top bar and refresh affordances so each primary workbench owns its own window chrome.
- Keep the left application shell limited to `Avatars`, `Messages`, and `Terminals`, while exposing `/admin` from the footer superadmin entry and moving running avatars into Avatars workbench tabs instead of separate shell chrome.
- Normalize workspace labels so compact surfaces show objective short paths, `~/` is rendered as `~/.agenter`, and detail titles use the full objective path.
- Extend the icon platform from profile/session-only ownership to a typed entity authority, with room icons implemented first and the same contract reserved for terminal/task entities.
- Upgrade `@agenter/web-chat-view` into the shared rich room/chat primitive with canonical avatars, richer bubbles, hover/context actions, attachment rendering, and a CodeMirror-based composer toolbar.
- Complete the missing global room media transport so room attachments and screenshots can be uploaded, sent, rendered, and reloaded without session-runtime-only hacks.

## Capabilities

### New Capabilities
- `room-media-assets`: Durable upload, retrieval, and lifecycle contract for room-owned media assets used by global room messages.

### Modified Capabilities
- `svelte-webui-platform`: Primary shell navigation, local window chrome ownership, and objective workspace path presentation change.
- `profile-image-system`: Typed entity icon fallback and upload behavior expands beyond profile/session-only ownership.
- `identity-media-assets`: Semantic media URL separation expands to typed entity icon spaces such as rooms.
- `message-chat-control-plane`: Global room send semantics now preserve attachment references from room-owned assets.
- `message-system-surface`: Room workbench tabs, transcript chrome, and management/chat assembly adopt room icons and richer shared chat behavior.
- `multimodal-ai-input`: The shared CodeMirror AI input now covers message-system rooms in addition to Quick Start and session chat.
- `web-chat-view`: Shared chat surface upgrades to richer composer, message action, avatar, and attachment presentation semantics.

## Impact

- Affected code: `packages/webui`, `packages/web-chat-view`, `packages/client-sdk`, `packages/app-server`, `packages/profile-service`, `packages/message-system`, and CLI HTTP asset routes.
- Affected APIs: typed entity icon URLs/upload bridges, room media upload/retrieval endpoints, and global room send semantics for `assetIds`.
- Affected systems: WebUI shell/navigation law, profile-service icon authority, shared chat primitive, and global room media transport.
