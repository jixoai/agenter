## MODIFIED Requirements

### Requirement: Context owns mutable attention state
The system MUST model each attention context as mutable state with a stable `contextId`, current content, current unresolved score map, `headCommitId`, and durable focus state. The current context score map SHALL project only unresolved positive scores; explicit zero-valued settlement patches SHALL remain part of immutable commit history instead of lingering in the current-state snapshot.

#### Scenario: Context content is replaced by update commit
- **WHEN** an `attention_commit` with `change.type = "update"` is applied
- **THEN** the context content becomes the provided value
- **AND** the context head advances to the new commit
- **AND** the context score map is updated using the commit score patch for unresolved positive scores

#### Scenario: Resolving patch clears the current-state key
- **WHEN** an `attention_commit` applies a score patch that resolves a previously active score key to `0`
- **THEN** the immutable commit ledger preserves that explicit zero-valued patch
- **AND** the current context score map omits that resolved key from the unresolved-state projection

#### Scenario: Context focus state changes without rewriting content
- **WHEN** the system changes an attention context from `focused` to `background`, `muted`, or back again
- **THEN** the context preserves its current content and unresolved score projection
- **AND** the updated context state records the new focus state as durable attention state
- **AND** later ingress routing uses that focus state as the canonical focus signal

### Requirement: Commit history is immutable
The system MUST preserve every attention commit as an immutable history entry linked to its context, including explicit zero-valued score patches that settle prior unresolved work.

#### Scenario: Commit history remains queryable after head advances
- **GIVEN** a context with multiple commits
- **WHEN** the head advances to a newer commit
- **THEN** older commits remain available in commit history
- **AND** the context head points only to the latest commit

#### Scenario: Settlement patches remain queryable after state pruning
- **GIVEN** a context with one unresolved score commit and a later resolving commit that sets the same score key to `0`
- **WHEN** a caller inspects commit history or widens an attention query to include resolved work
- **THEN** both the unresolved and resolving commits remain available as immutable history
- **AND** the current context score map does not need to retain the resolved zero-valued key
