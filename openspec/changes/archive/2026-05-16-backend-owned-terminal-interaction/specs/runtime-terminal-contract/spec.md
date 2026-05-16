## ADDED Requirements

### Requirement: Runtime terminal publications SHALL carry backend interaction projection state

Runtime terminal publications that feed projection hosts SHALL carry backend-owned interaction projection state when visible rendering requires it. This includes selection overlays, selected owner identity, cursor-follow result facts, and active cursor ownership facts. Runtime SHALL publish these facts as backend truth, not as host-local UI state.

#### Scenario: Runtime frame includes backend selection overlay
- **WHEN** backend selection intersects the visible viewport for a projected terminal
- **THEN** runtime terminal publication SHALL include selection overlay data sufficient for the projection host to draw selected cells
- **AND** selected-text extraction SHALL still be owned by backend interaction APIs

#### Scenario: Runtime publication clears stale selection overlay
- **WHEN** backend selection is cleared or no longer visible
- **THEN** runtime terminal publication SHALL make that cleared state observable to projection hosts
- **AND** hosts SHALL clear stale selection paint instead of preserving host-local highlights

### Requirement: Runtime terminal operations SHALL expose backend-owned cursor-follow

Runtime terminal operations SHALL expose cursor-follow as a backend-owned operation. Products and projection hosts SHALL request cursor-follow through runtime or transport semantics and SHALL wait for runtime-published viewport truth to observe the result.

#### Scenario: Runtime follow cursor uses backend truth
- **WHEN** a projection host requests cursor-follow for a terminal
- **THEN** runtime SHALL apply the operation against backend cursor and viewport truth
- **AND** runtime SHALL publish the resulting viewport through terminal publication

#### Scenario: Runtime does not accept frontend follow as truth
- **WHEN** a projection host computes a viewport from its last rendered cursor frame
- **THEN** runtime SHALL NOT treat that frontend value as the authoritative cursor-follow result
- **AND** backend cursor-follow remains the primary operation

### Requirement: Runtime terminal contract SHALL keep interaction truth separate from product chrome truth

Runtime SHALL distinguish backend terminal interaction truth from product chrome state. Product chrome may route events and display results, but terminal selection, copy, cursor-follow, scrollback, and viewport truth SHALL stay attached to the backend or offscreen renderer owner.

#### Scenario: Product action does not become terminal selection truth
- **WHEN** cli-shell product chrome receives a click or shortcut
- **THEN** runtime MAY update product state for that action
- **AND** runtime SHALL NOT mutate terminal selection unless the event targets a backend interaction owner

#### Scenario: Terminal selection does not become product-local state
- **WHEN** shell backend selection changes
- **THEN** runtime SHALL publish that selection as terminal interaction projection state
- **AND** cli-shell product state SHALL NOT store a second authoritative selected range
