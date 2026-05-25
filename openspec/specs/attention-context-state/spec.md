# attention-context-state Specification

## Purpose
TBD - created by archiving change attention-context-commit-kernel-vnext. Update Purpose after archive.
## Requirements
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

### Requirement: Attention commits SHALL separate item detail from context mutation
The attention system SHALL preserve each commit's immutable `change` payload as item/detail history independently from whether that payload mutates the current context summary. A commit without an explicit context-mutation intent SHALL keep the existing apply behavior for compatibility.

#### Scenario: Context-preserving commit keeps item detail
- **GIVEN** an attention context already contains an Avatar-authored summary
- **WHEN** a commit lands with context mutation set to preserve and a non-clean detail payload
- **THEN** the commit history preserves that detail payload
- **AND** current context content, slots, and content format remain unchanged
- **AND** the context score map and head commit advance using the committed scores

#### Scenario: Default commit still updates context
- **WHEN** a commit lands without an explicit context-mutation intent
- **THEN** the attention system applies the commit change to the current context as before

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

### Requirement: Context focus state SHALL be the single source of truth for attention engagement
The attention system MUST treat context focus state as the canonical engagement signal and SHALL project that state outward to source adapters instead of importing source-local focus as the durable truth.

#### Scenario: Source adapters consume focus from attention
- **WHEN** a source adapter needs to know whether an attention context is engaged
- **THEN** it reads the current focus state from the attention context or its derived hook output
- **AND** it does not become the durable owner of that focus state itself

### Requirement: Focus state SHALL define whether push debt remains active
The attention system SHALL interpret unresolved push scores through the context focus state. `focused` and `background` pushes remain active until they are consumed or resolved, while ordinary `muted` pushes stay dormant unless they carry notification-class semantics.

#### Scenario: Background push remains active without focus promotion
- **WHEN** a context in `background` receives a push with unresolved scores
- **THEN** the context still reports active debt
- **AND** the push remains separately queryable for notification projection until it is consumed

#### Scenario: Muted push stays dormant by default
- **WHEN** a context in `muted` receives a normal push with unresolved scores
- **THEN** the context does not report active debt from that push alone
- **AND** the push still remains in durable history for later inspection

### Requirement: Terminal death SHALL mute the bound attention context through durable lifecycle consequence
When a terminal instance that owns or anchors an attention context dies through the terminal killed flow, the system SHALL move the bound attention context to `muted` as a durable consequence of that lifecycle event rather than as an ad hoc product-side patch.

#### Scenario: Killed terminal mutes its bound attention context
- **WHEN** a terminal instance completes the killed flow
- **AND** that instance is bound to an attention context
- **THEN** the bound attention context is moved to `muted`
- **AND** later runtime scheduling treats that context according to normal muted law

#### Scenario: Unrelated attention contexts stay unchanged
- **WHEN** one terminal instance completes the killed flow
- **AND** other attention contexts are not bound to that terminal instance
- **THEN** those unrelated contexts keep their current focus state
- **AND** terminal death does not globally mute unrelated work

