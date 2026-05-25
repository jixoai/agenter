## ADDED Requirements

### Requirement: Runtime recovery SHALL consume terminal killed replay after subscriptions are active
The runtime SHALL not rely on constructor-time terminal storage normalization as the source of terminal death consequences. After terminal-system event bindings are active, runtime recovery SHALL consume or request terminal-owned killed replay for stale running terminals and apply the same attachment, publication, and attention consequences as live-observed terminal death.

#### Scenario: Runtime observes daemon recovery killed flow
- **WHEN** app-server starts and terminal-system identifies stale running terminal records
- **THEN** runtime recovery observes a lifecycle-class killed consequence for each recovered terminal
- **AND** the runtime removes those terminals from live attached and focused sets
- **AND** the runtime does not republish those terminals as live after recovery

#### Scenario: Runtime recovery mutes bound terminal context
- **WHEN** runtime recovery consumes a recovered killed terminal that is bound to an attention context
- **THEN** the runtime applies the terminal-death attention consequence for that context
- **AND** the context becomes `muted` through the same path as explicit terminal death

#### Scenario: Runtime recovery invalidates terminal projections
- **WHEN** runtime recovery completes killed post-workflow for one or more terminals
- **THEN** runtime terminal publications invalidate live and history/index terminal projections
- **AND** clients do not have to infer the catalog change from terminal status or snapshot ticks

### Requirement: Runtime terminal recovery SHALL not resurrect dead terminals from caches
Runtime-local terminal caches, focused-terminal refs, and attachment facts SHALL be reconciled against terminal-system live projection after killed recovery. A killed terminal MAY remain queryable through history/index surfaces, but runtime live state MUST NOT resurrect it from stale caches.

#### Scenario: Stale focused terminal ref is removed
- **GIVEN** runtime state contains a focused terminal id from before daemon restart
- **WHEN** terminal-system recovery moves that terminal to killed history
- **THEN** runtime focused terminal refs drop that id
- **AND** the runtime snapshot no longer lists it as a live terminal

#### Scenario: History inspection does not reattach terminal
- **WHEN** a caller inspects a killed terminal through history or index
- **THEN** runtime does not create a live attachment for that terminal
- **AND** the caller must use explicit killed-history recovery intent to bring it back to live state
