## ADDED Requirements

### Requirement: Offscreen terminal line navigation SHALL support Home and End

When shell focus is active, the offscreen terminal input path SHALL support common Home and End editing behavior. Native key sequences SHALL be preserved when provided by the terminal host; otherwise cli-shell SHALL use a backend-accepted shell line movement fallback.

#### Scenario: Home moves to line start
- **WHEN** the user presses Home in the shell region
- **THEN** cli-shell SHALL send a backend-accepted line-start input to the shell owner
- **AND** it SHALL request backend cursor follow after the input is accepted

#### Scenario: End moves to line end
- **WHEN** the user presses End in the shell region
- **THEN** cli-shell SHALL send a backend-accepted line-end input to the shell owner
- **AND** it SHALL request backend cursor follow after the input is accepted

### Requirement: Offscreen terminal word selection SHALL support Option Shift arrows

When word navigation enhancement is enabled, Option+Shift+Left and Option+Shift+Right SHALL extend backend-owned selection from the current cursor to the nearest previous or next terminal word boundary.

#### Scenario: Option Shift Left extends selection to previous word
- **WHEN** the user presses Option+Shift+Left in the shell region
- **THEN** cli-shell SHALL compute the previous word boundary using the shared backend-aware terminal word helper
- **AND** it SHALL route a backend selection range to the shell owner
- **AND** it SHALL NOT store selected text in OpenTUI projection state

#### Scenario: Option Shift Right extends selection to next word
- **WHEN** the user presses Option+Shift+Right in the shell region
- **THEN** cli-shell SHALL compute the next word boundary using the shared backend-aware terminal word helper
- **AND** it SHALL route a backend selection range to the shell owner
- **AND** it SHALL NOT store selected text in OpenTUI projection state

#### Scenario: Option Shift selection preserves one anchor until ordinary input
- **WHEN** a user extends selection by word with Option+Shift and repeats or reverses direction
- **THEN** cli-shell SHALL preserve the original selection anchor
- **AND** it SHALL move only the focus endpoint to the latest backend cursor target
- **AND** ordinary terminal input SHALL reset that keyboard selection anchor before routing bytes

#### Scenario: Ordinary input clears backend-owned selection before typing
- **WHEN** shell focus is active and ordinary terminal input is routed
- **THEN** cli-shell SHALL ask the terminal backend owner to clear active selection before sending input bytes
- **AND** this behavior SHALL use the backend interaction bridge so supported xterm and ghostty-native owners share the same interaction law
- **AND** Option+Shift selection-extension cursor movement SHALL preserve selection instead of clearing it

### Requirement: Offscreen terminal selection overlay rows SHALL remain backend absolute rows

When terminal-system projects a scrolled viewport frame, backend-owned selection overlay rows SHALL remain in backend scrollback coordinates. Projection may filter overlays to the visible viewport, but it MUST NOT rewrite overlay row numbers into screen-local rows.

#### Scenario: Selection overlay row survives viewport projection
- **WHEN** backend selection covers row 5 and the projected viewport starts at row 2
- **THEN** the projected frame SHALL still publish the selection overlay row as 5
- **AND** the view renderer SHALL be responsible for mapping that backend row onto the visible screen row using its selection source metadata
