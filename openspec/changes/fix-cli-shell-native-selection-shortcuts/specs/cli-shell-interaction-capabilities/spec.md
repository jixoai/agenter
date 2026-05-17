## ADDED Requirements

### Requirement: Cli-shell SHALL cover common editing shortcut parity in backend interaction recommendations

cli-shell interaction recommendations SHALL explicitly cover Home/End line movement and Option+Shift word selection extension for supported terminal backends.

#### Scenario: Recommendation includes line movement fallback
- **WHEN** cli-shell resolves the interaction profile for a supported backend
- **THEN** the profile SHALL make Home/End fallback behavior explicit
- **AND** focused tests SHALL fail if that decision is removed accidentally

#### Scenario: Recommendation includes word selection extension
- **WHEN** cli-shell resolves the interaction profile for a supported backend
- **THEN** the profile SHALL make word navigation and word selection extension behavior explicit
- **AND** focused tests SHALL fail if Option+Shift word selection loses the backend-owned path

#### Scenario: Repeated Option+Shift movement preserves selection anchor
- **WHEN** a user presses Option+Shift+Left or Option+Shift+Right repeatedly
- **THEN** cli-shell SHALL keep the original selection anchor fixed
- **AND** each later keypress SHALL update only the selection focus endpoint after moving the backend cursor

#### Scenario: Option+Shift range uses scrollback row while scrolled
- **WHEN** the shell viewport is scrolled and a user presses Option+Shift+Left or Option+Shift+Right
- **THEN** cli-shell SHALL send the backend absolute scrollback row in the selection range
- **AND** it SHALL NOT treat the visible screen row as the backend row
