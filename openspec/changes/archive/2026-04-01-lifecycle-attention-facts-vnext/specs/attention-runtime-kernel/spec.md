## MODIFIED Requirements

### Requirement: Runtime SHALL keep unresolved attention active across cycles

Lifecycle facts MAY be committed as passive history or active debt depending on event type. Structural room and terminal changes that can affect later model routing or execution SHALL remain active until the runtime or model settles them.

#### Scenario: Structural lifecycle change becomes active attention debt
- **WHEN** session runtime commits a room create, room update, room archive, terminal create, terminal delete, or terminal control-plane config change
- **THEN** the resulting lifecycle commit carries an unresolved score
- **AND** the related attention context appears in the active attention set until a later commit settles it

#### Scenario: Passive lifecycle fact does not create debt
- **WHEN** session runtime commits a room focus, terminal focus, or terminal unfocus lifecycle fact
- **THEN** the resulting commit remains queryable in attention history
- **AND** it does not appear in the active attention set by default
