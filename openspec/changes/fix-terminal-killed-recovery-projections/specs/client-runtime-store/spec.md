## ADDED Requirements

### Requirement: Client runtime store SHALL name terminal projections by semantics
The client runtime store SHALL expose terminal projection methods and cached resources whose names match their projection semantics. Live catalog, killed history, combined index, and archive SHALL be distinct resource families so app callers cannot accidentally treat history/index data as live candidates.

#### Scenario: Live terminal catalog is live-only
- **WHEN** a caller hydrates or lists global live terminals
- **THEN** the returned data excludes `processPhase = killed` entries
- **AND** killed entries are removed from the live cache when lifecycle updates arrive

#### Scenario: Killed terminal history is killed-only
- **WHEN** a caller hydrates killed terminal history
- **THEN** the returned data includes killed non-archived terminals
- **AND** it does not include running or `not_started` live terminals

#### Scenario: Terminal index is explicitly combined
- **WHEN** a caller needs the combined terminal index
- **THEN** it uses an explicitly named index projection
- **AND** that projection may contain live entries first followed by killed non-archived entries

#### Scenario: Projection invalidation refreshes the correct families
- **WHEN** terminal lifecycle changes move an entry between live, history, index, or archive
- **THEN** the store refreshes or reconciles each affected projection family by its own semantic name
- **AND** a live-only consumer does not need a route-local killed filter to remain correct
