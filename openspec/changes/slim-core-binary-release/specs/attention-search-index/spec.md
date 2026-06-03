## MODIFIED Requirements

### Requirement: Attention search SHALL use a rebuildable SQLite FTS5 projection

Attention commit search SHALL project persisted attention commits into a Bun SQLite sidecar index that uses FTS5 and can be rebuilt from durable attention facts.

#### Scenario: Missing index rebuilds from durable attention state
- **WHEN** a session has persisted attention commits but no search index yet
- **THEN** the runtime can rebuild the attention search index from the persisted attention snapshot
- **AND** search does not require a second canonical store

#### Scenario: Search index is not treated as durable truth
- **WHEN** the SQLite sidecar is deleted or stale
- **THEN** the runtime may rebuild it from persisted attention facts
- **AND** no attention commit is lost because the sidecar was only projection state

#### Scenario: Legacy DuckDB sidecar does not block search
- **WHEN** an older session root still contains a DuckDB search sidecar from a previous version
- **THEN** the runtime can ignore, replace, or remove that legacy sidecar without data migration
- **AND** the authoritative attention facts remain the rebuild source for the new SQLite projection

### Requirement: Attention search SHALL preserve graph controls while upgrading text retrieval

Text retrieval may use SQLite FTS5, but `hash`, `score`, `depth`, and `minscore` SHALL still respect attention graph semantics.

#### Scenario: Hash traversal still follows attention graph rules
- **WHEN** a caller queries `score:relay01 deep:2`
- **THEN** the runtime selects commits according to attention graph traversal semantics
- **AND** the result is not reduced to plain full-text matching on the hash string

#### Scenario: Text search narrows candidates without changing final logic
- **WHEN** a caller queries `context:ctx-chat-kzf weather`
- **THEN** SQLite FTS5 may be used to fetch text candidates
- **AND** the final result still respects the structured context filter and the compiled query logic
