## MODIFIED Requirements

### Requirement: Terminal death SHALL mute the bound attention context through durable lifecycle consequence
When a terminal instance that owns or anchors an attention context dies through the terminal killed flow, the system SHALL move the bound attention context to `muted` as a durable consequence of that lifecycle event rather than as an ad hoc product-side patch. The lifecycle attention ingress or equivalent committed terminal-death fact SHALL be the auditable cause of the mute effect.

#### Scenario: Killed terminal mutes its bound attention context
- **WHEN** a terminal instance completes the killed flow
- **AND** that instance is bound to an attention context
- **THEN** the bound attention context is moved to `muted`
- **AND** later runtime scheduling treats that context according to normal muted law

#### Scenario: Lifecycle commit is the cause of terminal mute
- **WHEN** terminal death is applied to a bound attention context
- **THEN** the runtime first records or consumes a terminal lifecycle attention ingress for that death
- **AND** the focus-state change to `muted` is attributable to that committed lifecycle fact
- **AND** the system does not silently flip focus state as a product-local side effect before any auditable cause exists

#### Scenario: Cold-start killed replay mutes the same context
- **WHEN** daemon recovery replays killed flow for a stale running terminal
- **AND** that terminal is bound to an attention context
- **THEN** the same terminal-death attention consequence mutes the bound context
- **AND** the context is not left `focused` merely because the PTY died while the daemon was offline

#### Scenario: Unrelated attention contexts stay unchanged
- **WHEN** one terminal instance completes the killed flow
- **AND** other attention contexts are not bound to that terminal instance
- **THEN** those unrelated contexts keep their current focus state
- **AND** terminal death does not globally mute unrelated work
