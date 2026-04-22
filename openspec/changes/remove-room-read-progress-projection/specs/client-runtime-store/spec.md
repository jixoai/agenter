## MODIFIED Requirements

### Requirement: Client runtime store SHALL keep room read truth message-native

The client runtime store SHALL preserve room read truth in the same shape it is durably stored: on room message rows. When room catalog entries and room snapshots refresh on different schedules, the store MAY update room/channel metadata independently, but it SHALL NOT synthesize or rewrite latest-visible read arrays from a room-level summary projection.

#### Scenario: Room catalog refresh does not rewrite the latest message

- **WHEN** the browser already holds a warm room snapshot with message `m9`
- **AND** a later room catalog refresh updates room metadata before the next forced room snapshot refresh completes
- **THEN** the cached snapshot keeps `m9.readActorIds` and `m9.unreadActorIds` exactly as they came from the snapshot
- **AND** the store does not patch `m9` from any room-level latest-visible summary fields

#### Scenario: Realtime room invalidation refreshes snapshot instead of synthesizing progress

- **WHEN** a realtime room update indicates that a watched room snapshot changed
- **THEN** the runtime store invalidates or refreshes that room snapshot through the room snapshot API
- **AND** the browser learns new read truth from the refreshed message rows rather than from catalog-side room progress synthesis
