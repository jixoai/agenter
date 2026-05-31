## Why

The backend already knows how to load or generate the root auth key, but the app still behaves like auth is optional setup trivia. At the same time, room and terminal collaboration surfaces still synthesize people from freeform labels and copied tokens instead of flowing through auth-backed actor identity, icon, and status projection.

## What Changes

- Add a first-run superadmin onboarding contract that can discover root-auth bootstrap state, explicitly generate or reveal the backend-managed root private key, and bind a superadmin session before the rest of the workbench becomes the primary path.
- Add an auth actor catalog projection so WebUI and app-server can list durable auth actors and stable public identity metadata without treating room or terminal grants as the source of profile truth.
- Route collaboration-facing actor labels and icons through auth-backed projections instead of ad-hoc participant strings.
- Keep message-system and terminal-system token issuance local to their own control planes, while using auth actor ids as the shared identity key.
- **BREAKING** room and terminal management flows stop treating arbitrary `label + id` pairs as durable human actors for admin UX.

## Capabilities

### New Capabilities
- `superadmin-onboarding`: first-run root-auth discovery, backend key generation/reveal, and explicit superadmin binding UX.
- `auth-actor-catalog`: list and resolve canonical auth actors, display metadata, and icon projections for collaboration surfaces.

### Modified Capabilities
- `profile-service-child-runtime`: app-server bootstrap must surface root-auth readiness and reveal/generate actions without taking ownership away from profile-service.
- `profile-image-system`: actor-facing room and terminal surfaces must resolve icons through auth-backed media endpoints instead of local synthetic placeholders.

## Impact

- Affected code: `packages/profile-service`, `packages/app-server`, `packages/client-sdk`, `packages/webui`.
- Affected UX: startup flow, global settings auth area, room user list, terminal user list, actor pickers.
- Cross-change dependency: this change establishes the identity foundation that later room/terminal collaboration changes consume.
