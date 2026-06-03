# attention-search-index Specification

## Purpose
Define the attention full-text search projection and query behavior.

## Requirements

### Requirement: Attention search SHALL use a rebuildable SQLite FTS5 projection

Attention commit search SHALL project persisted attention commits into a Bun SQLite sidecar index that uses FTS5 and can be rebuilt from durable attention facts.

#### Scenario: Missing index rebuilds from durable attention state
- **WHEN** a session has persisted attention commits but no search index yet
- **THEN** the runtime can rebuild the attention search index from the persisted attention snapshot
- **THEN** search does not require a second canonical store

#### Scenario: Search index is not treated as durable truth
- **WHEN** the SQLite sidecar is deleted or stale
- **THEN** the runtime may rebuild it from persisted attention facts
- **THEN** no attention commit is lost because the sidecar was only projection state

#### Scenario: Legacy DuckDB sidecar does not block search
- **WHEN** an older session root still contains a DuckDB search sidecar from a previous version
- **THEN** the runtime can ignore, replace, or remove that legacy sidecar without data migration
- **THEN** the authoritative attention facts remain the rebuild source for the new SQLite projection

### Requirement: Attention search SHALL preserve graph controls while upgrading text retrieval

Text retrieval may use SQLite FTS5, but `hash`, `score`, `depth`, and `minscore` SHALL still respect attention graph semantics.

#### Scenario: Hash traversal still follows attention graph rules
- **WHEN** a caller queries `score:relay01 deep:2`
- **THEN** the runtime selects commits according to attention graph traversal semantics
- **THEN** the result is not reduced to plain full-text matching on the hash string

#### Scenario: Text search narrows candidates without changing final logic
- **WHEN** a caller queries `context:ctx-chat-kzf weather`
- **THEN** SQLite FTS5 may be used to fetch text candidates
- **THEN** the final result still respects the structured context filter and the compiled query logic

### Requirement: Attention search SHALL default to active work unless explicitly widened

Without an explicit override, attention search SHALL still hide all-zero work by default.

#### Scenario: Default query hides resolved-only commits
- **WHEN** a caller runs `weather`
- **THEN** commits whose related current score hashes are all zero stay excluded by default

#### Scenario: Explicit minscore widens the result
- **WHEN** a caller runs `minscore:0 weather`
- **THEN** resolved commits may appear in the result
- **THEN** the query still respects the remaining query clauses

### Requirement: Explicit score/hash lookup SHALL behave like historical fact lookup unless narrowed

Direct `score:` / `hash:` clauses identify attention graph facts. When the caller explicitly asks for one of those hashes and does not provide `minscore`, the runtime SHALL include matching historical commits instead of silently filtering them away just because the hash is currently resolved.

#### Scenario: Resolved score lookup still returns its history
- **WHEN** a caller runs `context:ctx-chat-main score:ba7902 deep:2`
- **THEN** commits that introduced and later resolved `ba7902` may both appear
- **THEN** the result still follows attention graph traversal semantics rather than plain text matching
