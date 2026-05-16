## Purpose

Define product-local cli-shell interaction capability recommendations for offscreen terminal projection. These recommendations describe which terminal-like interaction enhancements cli-shell should provide when a backend does not supply the behavior at the projected surface.

## Requirements

### Requirement: Cli-shell SHALL provide backend interaction capability recommendations

cli-shell SHALL provide a backend interaction capability recommendation map for supported terminal backends. The recommendation map SHALL describe which offscreen interaction enhancements are required for that backend.

#### Scenario: Recommendation map resolves a supported backend
- **WHEN** cli-shell resolves interaction recommendations for a supported backend
- **THEN** it SHALL return a complete enhancement profile
- **AND** the profile SHALL include semantic word selection, semantic row selection, word navigation, cursor-follow input, and Home/End fallback decisions

#### Scenario: Recommendation map has a stable fallback
- **WHEN** cli-shell cannot determine a backend-specific recommendation
- **THEN** it SHALL use the conservative default profile
- **AND** the default profile SHALL avoid overriding backend-native behavior unless the behavior is required for cli-shell correctness

### Requirement: Cli-shell SHALL test backend interaction recommendations

cli-shell SHALL include focused tests that verify backend interaction recommendations remain explicit and stable.

#### Scenario: Recommendation changes require test updates
- **WHEN** a backend recommendation changes
- **THEN** the focused recommendation test SHALL fail until the expected profile is updated
- **AND** the update SHALL document which interaction behavior is now provided by the backend or by cli-shell enhancement
