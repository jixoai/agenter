## ADDED Requirements

### Requirement: WebUI state SHALL be classified by persistence and sync value before storage is chosen

The WebUI SHALL classify state in two steps: first decide whether the state is persistent at all, then decide whether cross-device sync has durable user value. Non-persistent state MUST remain memory-only. Persistent state with no meaningful cross-device value MUST remain client-local. Persistent state with meaningful cross-device value MUST move to a server-owned actor-private plane.

#### Scenario: Ephemeral display state stays memory-only

- **WHEN** a UI state only affects the current live reading mode for one mounted surface and does not need to survive navigation or refresh
- **THEN** the WebUI keeps that state in memory only
- **AND** it does not allocate client-local or server-side persistence for that state

#### Scenario: Device-specific persistence stays local

- **WHEN** a UI state should survive refresh on the current device but open another sensible projection on a different device class
- **THEN** the WebUI persists that state in a client-local store
- **AND** another device does not inherit that device-local projection automatically

#### Scenario: Cross-device preference sync uses the server plane

- **WHEN** a durable UI preference or collection has clear value when the same actor returns on desktop and mobile
- **THEN** the WebUI persists that state through the authenticated server-owned plane
- **AND** another device for the same actor can observe the updated state without needing shared browser storage

### Requirement: Server-synced simple UI state SHALL use auth-scoped KV instead of settings or runtime snapshots

Simple actor-private UI preferences and collections SHALL use the auth-scoped KV plane when they need cross-device sync but do not justify a first-class domain resource. These records MUST stay outside global settings files, workspace settings files, and runtime snapshot publication.

#### Scenario: Pinned running avatars sync through auth-scoped KV

- **WHEN** the operator pins or unpins a running avatar from the shell rail
- **THEN** the UI writes the pinned collection through the auth-scoped KV plane
- **AND** another device for the same authenticated actor can observe the updated pin set through KV replay or subscription

#### Scenario: Opaque synced UI state does not leak into settings truth

- **WHEN** a synced UI preference is only WebUI presentation state rather than a durable workspace or runtime rule
- **THEN** that state is stored in auth-scoped KV instead of the settings graph
- **AND** runtime publication does not need to mirror that state into session snapshots just to keep the UI coherent
