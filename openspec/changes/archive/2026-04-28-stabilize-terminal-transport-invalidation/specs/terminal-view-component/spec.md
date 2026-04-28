## MODIFIED Requirements

### Requirement: Terminal-view SHALL preserve stable live rendering

The terminal renderer SHALL preserve ANSI rendering fidelity and stable fit-driven resizing while live transport is active. Once live transport has hydrated the viewport, redundant same-geometry fallback snapshots SHALL NOT trigger another reactive rehydration cycle.

#### Scenario: Redundant live snapshots do not retrigger fallback hydration

- **WHEN** live websocket transport is already connected and a new snapshot arrives with the same terminal geometry
- **THEN** the component does not reset or rehydrate the viewport from that redundant snapshot
- **AND** live output remains the primary render source

#### Scenario: Geometry change still allows fallback rehydration

- **WHEN** a new snapshot arrives with a changed terminal geometry
- **THEN** the component may rehydrate from that snapshot to realign the viewport
- **AND** the live transport stays connected through that recovery
