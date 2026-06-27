## ADDED Requirements

### Requirement: App extension runtime SHALL expose APIs instead of owning app lifecycle reactions

The app runtime SHALL remain a public API and projection surface for products. It MAY expose resource binding, lifecycle subscription, and owner-system operation contracts. It SHALL NOT own app-specific lifecycle reactions such as shell-next terminal killed -> archive bound room.

#### Scenario: App code programs against public lifecycle APIs

- **WHEN** a app needs to react to terminal, room, or attention lifecycle
- **THEN** the app consumes public lifecycle/API contracts
- **AND** the app implements its app-specific reaction in its own package
- **AND** the app runtime does not become a bottom-layer reaction host for that app behavior

#### Scenario: Core remains app-agnostic when shell-next reaction exists

- **WHEN** shell-next implements terminal killed -> archive bound room
- **THEN** core terminal, room, attention, and app-extension runtime modules remain valid without importing shell-next code
- **AND** no core module contains a branch equivalent to "if app is shell-next"
