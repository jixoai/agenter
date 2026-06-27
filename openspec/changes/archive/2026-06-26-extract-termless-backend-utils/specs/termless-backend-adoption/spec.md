## ADDED Requirements

### Requirement: Agenter backend utility packages SHALL remain opt-in and non-authoritative

Agenter MAY publish backend utility packages for reusable adapters or optional behavior composition, but those packages SHALL remain opt-in utilities. They SHALL NOT redefine backend identity, backend capability truth, or global behavior that every backend must inherit.

#### Scenario: Core does not own optional input policy

- **WHEN** reviewers inspect `@agenter/termless-core`
- **THEN** it exposes terminal contracts and backend adapters
- **AND** it does not export optional host input controllers
- **AND** it does not force every backend to share one host input policy

#### Scenario: Utility package does not become backend authority

- **WHEN** reviewers inspect `@agenter/termless-backend-utils`
- **THEN** the package depends on `@agenter/termless-core` contracts
- **AND** it does not define backend names, backend registry entries, or default backend selection
- **AND** consumers must explicitly import and compose each utility they want

#### Scenario: Future backend can combine only needed utilities

- **GIVEN** a future backend such as a wezterm backend ships some of its own input handling
- **WHEN** it needs one missing behavior from Agenter utilities
- **THEN** it can compose that utility without also taking unrelated keyboard, pointer, selection, or clipboard policy
