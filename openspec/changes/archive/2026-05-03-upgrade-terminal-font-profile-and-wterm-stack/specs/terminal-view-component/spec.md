## MODIFIED Requirements

### Requirement: The system SHALL provide a standalone terminal-view WebComponent

The system SHALL provide a standalone `terminal-view` WebComponent implemented with a shared terminal controller contract and renderer stack adapter contract, and renderer hosts SHALL be able to embed it as a pure terminal viewport without depending on WebUI-local terminal internals or renderer-private DOM internals.

#### Scenario: Embed terminal-view in a host surface
- **WHEN** a host page instantiates `terminal-view` with a valid terminal transport target
- **THEN** the component renders the terminal viewport and manages its own renderer lifecycle
- **THEN** the host does not need direct access to WebUI-specific terminal internals
- **AND** the host does not depend on renderer-private DOM classes or hidden metric objects

#### Scenario: Explicit wterm still embeds through the same element contract
- **WHEN** a host selects resolved renderer `wterm`
- **THEN** it still mounts the same `terminal-view` element
- **AND** no host-local special case is required for `GhosttyCore` loading or `WTerm` hosting

## ADDED Requirements

### Requirement: Terminal-view SHALL consume one shared terminal presentation profile

The standalone `terminal-view` component SHALL consume shared declarative `rendererPreference`, `theme`, `cursor`, and `font` inputs and apply them through the resolved renderer stack.

#### Scenario: Adapter policy decides between live-apply and rebuild
- **WHEN** the host updates terminal theme, cursor, or font while the resolved renderer stays the same
- **THEN** `terminal-view` asks the resolved renderer adapter whether the mutation can settle through `live-apply` or requires `rebuild-session`
- **AND** it does not fabricate a new PTY or second terminal id

#### Scenario: Renderer preference change rebuilds only the local renderer stack
- **WHEN** the host updates renderer preference or the resolved renderer changes
- **THEN** `terminal-view` disposes and recreates only the local renderer stack
- **AND** the websocket transport, terminal id, and durable snapshot truth remain attached to the same terminal session

### Requirement: Terminal-view SHALL emit an explicit presentation-ready fact

After a presentation mutation settles, `terminal-view` SHALL emit one renderer-settled event so hosts can distinguish durable config writes from visible renderer completion.

#### Scenario: Live-apply mutation emits ready event
- **WHEN** the resolved renderer settles a presentation mutation through `live-apply`
- **THEN** `terminal-view` emits `terminal-view-presentation-ready`
- **AND** the event includes the terminal id, resolved renderer, settle reason, and current screen metrics

#### Scenario: Stable resolved renderer preference still emits ready event
- **WHEN** the durable renderer preference changes but the resolved renderer stays the same and no rebuild is required
- **THEN** `terminal-view` still emits `terminal-view-presentation-ready`
- **AND** host apply state can terminate without guessing

### Requirement: Terminal-view SHALL restore the current snapshot after renderer rebuild

When `terminal-view` rebuilds its local renderer stack, it SHALL restore the current snapshot truth into the fresh renderer session even if the snapshot sequence has not advanced.

#### Scenario: Rebuild does not leave the viewport blank
- **WHEN** a renderer mutation requires `rebuild-session`
- **AND** the current durable snapshot sequence stays unchanged
- **THEN** the fresh renderer session still hydrates from the current snapshot
- **AND** the visible viewport does not remain blank while waiting for future PTY output

### Requirement: Terminal-view SHALL report renderer-native content metrics

The standalone `terminal-view` component SHALL report renderer-owned native content metrics that hosts can use as geometry truth for fit/cover projection.

#### Scenario: Renderer-native metrics survive fit projection
- **WHEN** the host renders `terminal-view` inside a fit projection smaller than native scale
- **THEN** the component still reports native content metrics for the current renderer session
- **AND** the host does not need to reconstruct intrinsic size by dividing projected dimensions
