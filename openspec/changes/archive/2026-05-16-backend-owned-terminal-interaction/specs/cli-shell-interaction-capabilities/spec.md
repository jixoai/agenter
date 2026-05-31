## MODIFIED Requirements

### Requirement: Cli-shell SHALL provide backend interaction capability recommendations

cli-shell SHALL consume backend interaction capability facts and MAY provide app-local recommendations only as routing policy. The recommendation map SHALL describe which backend interaction enhancements are required for a backend, but it SHALL NOT make OpenTUI projection code the owner of terminal selection, copy, scrollback, cursor-follow, wrapping, or selected-text extraction.

#### Scenario: Recommendation map resolves a supported backend
- **WHEN** cli-shell resolves interaction recommendations for a supported backend
- **THEN** it SHALL return a complete enhancement profile
- **AND** the profile SHALL include semantic word selection, semantic row selection, word navigation, cursor-follow input, and Home/End fallback decisions
- **AND** each recommendation SHALL indicate whether the behavior is backend-native, backend-adapter-owned, or unavailable

#### Scenario: Recommendation map has a stable fallback
- **WHEN** cli-shell cannot determine a backend-specific recommendation
- **THEN** it SHALL use the conservative default profile
- **AND** the default profile SHALL avoid overriding backend-native behavior unless the behavior is required for cli-shell correctness

#### Scenario: Recommendation does not authorize host-local selection truth
- **WHEN** a backend lacks a native interaction behavior
- **THEN** cli-shell SHALL route the behavior to a backend interaction adapter when the behavior is required
- **AND** it SHALL NOT treat OpenTUI host-local selection simulation as the durable terminal interaction owner

### Requirement: Cli-shell SHALL test backend interaction recommendations

cli-shell SHALL include focused tests that verify backend interaction recommendations remain explicit and stable.

#### Scenario: Recommendation changes require test updates
- **WHEN** a backend recommendation changes
- **THEN** the focused recommendation test SHALL fail until the expected profile is updated
- **AND** the update SHALL document which interaction behavior is now provided by the backend, by a backend interaction adapter, or by no supported path

#### Scenario: Ghostty-native recommendation prefers backend-native selection
- **WHEN** cli-shell resolves recommendations for `ghostty-native`
- **THEN** shell selection and copy SHALL be marked backend-native once the wrapper exposes Ghostty terminal-core selection APIs
- **AND** OpenTUI semantic selection simulation SHALL NOT be enabled as the default owner for that backend

## ADDED Requirements

### Requirement: Cli-shell SHALL use backend-owned selection for shell and dialogue owners

cli-shell SHALL route shell-region selection and dialogue-region selection to their respective backend interaction owners. The app MAY use OpenTUI focus/click primitives as native controls, but those controls SHALL only project interaction events and visible results.

#### Scenario: Shell selection routes to shell backend
- **WHEN** the user starts dragging inside the shell region
- **THEN** cli-shell SHALL route selection events to the shell backend interaction owner
- **AND** copy SHALL read selected shell text from that owner

#### Scenario: Dialogue selection routes to dialogue backend
- **WHEN** the user starts dragging inside the dialogue region
- **THEN** cli-shell SHALL route selection events to the dialogue backend interaction owner
- **AND** copy SHALL read selected dialogue text from that owner

#### Scenario: Scroll does not detach selection from content
- **WHEN** the user selects text and then scrolls the same owner region
- **THEN** cli-shell SHALL render the backend-published selection overlay for the new viewport
- **AND** it SHALL NOT keep the selected background fixed to old host rows
