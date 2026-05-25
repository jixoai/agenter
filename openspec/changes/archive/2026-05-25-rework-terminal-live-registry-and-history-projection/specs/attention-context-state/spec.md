## ADDED Requirements

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
