## MODIFIED Requirements

### Requirement: Context owns mutable attention state
The system MUST model each attention context as mutable state with a stable `contextId`, current content, current unresolved score map, `headCommitId`, and durable focus state. The current context score map SHALL project only unresolved positive scores; explicit zero-valued settlement patches SHALL remain part of immutable commit history instead of lingering in the current-state snapshot. These laws MUST hold whether commits are produced by a live `SessionRuntime` or by the independent attention control plane.

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

#### Scenario: Offline control-plane commit preserves the same context law
- **WHEN** an external system commits attention through the independent control plane while no runtime instance is live
- **THEN** the resulting context state follows the same head, content, score, and focus-state laws
- **AND** later runtime recovery does not need to reinterpret or migrate that commit
