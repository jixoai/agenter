# workspace-resource-ownership Specification

## Purpose
TBD - created by archiving change workspace-resource-ownership-vnext. Update Purpose after archive.
## Requirements
### Requirement: Session-scoped workspace resources SHALL be owned by lifecycle handles instead of route-local component state
Workspace route surfaces SHALL consume session-scoped resources from lifecycle-owned shared state so route remounts do not reintroduce cold-loading behavior for warm data.

#### Scenario: Chats route re-enters after the channel catalog is warm
- **GIVEN** a session-scoped chat-channel catalog has already been loaded for a workspace session
- **WHEN** the user switches away from `Chats` and later returns to the same route
- **THEN** the route reuses the shared session resource instead of creating a new route-local fetch state
- **THEN** the UI does not show a cold `Loading chat channels...` state again

#### Scenario: Systems panel inspects the same session catalog
- **GIVEN** `Chats` has already warmed the message-channel catalog for a session
- **WHEN** Devtools `Systems` reads channel metadata for that same session
- **THEN** it consumes the same shared resource snapshot
- **THEN** it does not trigger an additional route-owned bootstrap fetch for the same catalog

### Requirement: Shared workspace resources SHALL distinguish cold ensure from warm refresh
Workspace/session resource APIs SHALL expose `ensure` semantics for cold ownership and SHALL preserve warm data during explicit refresh flows.

#### Scenario: Ensuring a cold session resource
- **GIVEN** a session has no cached message-channel resource yet
- **WHEN** the route requests the session resource with `ensure`
- **THEN** the resource enters a cold loading state once
- **THEN** the loaded snapshot is published into shared runtime state for later reuse

#### Scenario: Refreshing a warm session resource
- **GIVEN** a session resource already has loaded data
- **WHEN** the application requests a refresh
- **THEN** the previously loaded data remains visible while the refresh runs
- **THEN** the resource reports a warm refresh state instead of reverting to a cold empty-loading state

### Requirement: Workspace settings route entry SHALL use warm ensure semantics
Workspace settings route entry SHALL avoid treating already-loaded settings layers as a first-load every time the route remounts.

#### Scenario: Settings route re-enters after layers are loaded
- **GIVEN** workspace settings layers have already been loaded for a workspace path
- **WHEN** the user leaves and returns to `Settings`
- **THEN** the route uses ensure semantics for the same workspace path
- **THEN** existing layers remain available without replaying the first-load empty state

