## MODIFIED Requirements

### Requirement: The system SHALL provide a standalone terminal-view WebComponent

The system SHALL provide a standalone `terminal-view` WebComponent implemented with a shared terminal controller contract and renderer stack adapter contract. The component SHALL consume backend-neutral terminal transport and snapshot truth, and renderer hosts SHALL be able to embed it as a pure terminal viewport without depending on WebUI-local terminal internals, renderer-private DOM internals, or Agenter-private backend package identity.

#### Scenario: Embed terminal-view in a host surface

- **WHEN** a host page instantiates `terminal-view` with a valid terminal transport target
- **THEN** the component renders the terminal viewport and manages its own renderer lifecycle
- **THEN** the host does not need direct access to WebUI-specific terminal internals
- **AND** the host does not depend on renderer-private DOM classes or hidden metric objects

#### Scenario: Explicit wterm still embeds through the same element contract

- **WHEN** a host selects resolved renderer `wterm`
- **THEN** it still mounts the same `terminal-view` element
- **AND** no host-local special case is required for `GhosttyCore` loading or `WTerm` hosting

#### Scenario: Host does not pass Agenter-private backend identity into terminal-view

- **WHEN** a host binds `terminal-view` to a running terminal
- **THEN** the host passes transport, snapshot, and shared presentation facts
- **AND** it does not need to pass or infer an Agenter-private backend package identity just to render the terminal
