## ADDED Requirements

### Requirement: Context owns mutable attention state
The system MUST model each attention context as mutable state with a stable `contextId`, current content, current score map, and a `headCommitId`.

#### Scenario: Context content is replaced by update commit
- **WHEN** an `attention_commit` with `change.type = "update"` is applied
- **THEN** the context content becomes the provided value
- **AND** the context head advances to the new commit
- **AND** the context score map is updated using the commit score patch.

### Requirement: Commit history is immutable
The system MUST preserve every attention commit as an immutable history entry linked to its context.

#### Scenario: Commit history remains queryable after head advances
- **GIVEN** a context with multiple commits
- **WHEN** the head advances to a newer commit
- **THEN** older commits remain available in commit history
- **AND** the context head points only to the latest commit.
