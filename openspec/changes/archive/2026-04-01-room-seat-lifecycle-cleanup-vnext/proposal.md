## Why

The current room collaboration flow still leaks legacy modeling into the new global message-system:

- room creation auto-seeds too many session seats, which makes old runtime session residue look like valid room membership
- room participant rows still expose `avatar|user|system`, which confuses actor identity with room permission
- room admin UI only archives channels through a misleading delete path and cannot truly dissolve a room
- auth-backed avatars currently render as black fallback icons because the profile fallback raster path is not producing usable artwork

These issues block realistic dogfooding of the room app and keep legacy assumptions alive in the new orthogonal architecture.

## What Changes

- Add a true room dissolve/delete path in message-system, app-server, client-sdk, and WebUI, while keeping archive as an explicit optional action.
- Simplify room participant editing so it only models seat membership (`actorId` + optional label), not fake identity roles like `avatar|user|system`.
- Stop pre-populating room creation with every discovered session seat, and tighten actor option projection so legacy or archived session residue does not flood the picker.
- Fix profile-service fallback icon rendering so auth-backed avatars no longer collapse to black raster output.
- Strip legacy participant identity-role fields from quickstart room bootstrap persistence and room editing flows.

## Capabilities

### Modified Capabilities
- `message-chat-control-plane`: rooms need distinct archive vs dissolve semantics, and participant membership must stop pretending to be actor-kind role data.
- `chat-surface-presentation`: room creation and metadata editing must present seats and permissions cleanly, without legacy role selectors or session floods.
- `auth-actor-catalog`: actor pickers must expose durable auth actors plus valid session seats without drowning in stale session residue.
- `profile-image-system`: deterministic fallback avatars must render usable colors through the default raster path.
- `quickstart-workspace-bootstrap`: chat-main bootstrap participants should persist seat ids and labels, not deprecated identity-role markers.

## Impact

- Affected code: `packages/message-system`, `packages/app-server`, `packages/client-sdk`, `packages/webui`, `packages/profile-service`, `packages/settings`
- Affected UX: global Chats create/edit room flows, room lifecycle actions, room users panel, Quick Start room config, actor avatar rendering
