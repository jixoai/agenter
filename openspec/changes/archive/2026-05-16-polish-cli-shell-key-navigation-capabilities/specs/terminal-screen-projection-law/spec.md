## ADDED Requirements

### Requirement: Offscreen terminal interaction enhancements SHALL be configurable

The offscreen terminal projection layer SHALL expose configurable interaction enhancements for behavior that a backend may not provide natively. Product runtime SHALL enable an enhancement only when the backend recommendation says the backend is missing that behavior.

#### Scenario: Backend recommendation enables only missing behavior
- **WHEN** cli-shell resolves the interaction profile for a backend
- **THEN** each enhancement SHALL be enabled only when the backend recommendation marks that behavior as missing
- **AND** capable backend-native behavior SHALL NOT be overridden by default

#### Scenario: Enhancement profile stays product-local
- **WHEN** cli-shell configures offscreen interaction behavior
- **THEN** the configuration SHALL remain inside `@agenter/cli-shell`
- **AND** core terminal-system modules SHALL NOT import cli-shell product policy

### Requirement: Offscreen terminal key input SHALL follow backend cursor after successful navigation

When shell key input is accepted by the backend through the offscreen projection bridge, cli-shell SHALL request the backend cursor-follow bridge for printable text and supported navigation keys.

#### Scenario: Printable input follows cursor
- **WHEN** the user has scrolled away from the cursor and types printable shell text
- **THEN** cli-shell SHALL send the encoded input bytes to the backend
- **AND** it SHALL request backend cursor follow

#### Scenario: Navigation input follows cursor
- **WHEN** the user presses an arrow key, Home, End, Delete, Backspace, Tab, Enter, or supported Ctrl-letter input in the shell region
- **THEN** cli-shell SHALL send the encoded input bytes to the backend
- **AND** it SHALL request backend cursor follow

#### Scenario: Failed navigation input does not move viewport
- **WHEN** the backend does not accept the encoded shell input bytes
- **THEN** cli-shell SHALL NOT request backend cursor follow
- **AND** cli-shell SHALL NOT create a frontend-owned viewport override

### Requirement: Offscreen terminal word navigation SHALL reuse semantic word segmentation

When word-navigation enhancement is enabled, Option+Left and Option+Right SHALL use the same terminal word-boundary helper as double-click semantic word selection.

#### Scenario: Option Left navigates to previous word boundary
- **WHEN** word-navigation enhancement is enabled and the user presses Option+Left in the shell region
- **THEN** cli-shell SHALL resolve the previous word boundary using ICU word segmentation
- **AND** it SHALL send backend input that moves the shell cursor toward that boundary
- **AND** it SHALL request backend cursor follow after successful input

#### Scenario: Option Right navigates to next word boundary
- **WHEN** word-navigation enhancement is enabled and the user presses Option+Right in the shell region
- **THEN** cli-shell SHALL resolve the next word boundary using ICU word segmentation
- **AND** it SHALL send backend input that moves the shell cursor toward that boundary
- **AND** it SHALL request backend cursor follow after successful input

#### Scenario: Option Up and Option Down stay backend native
- **WHEN** the user presses Option+Up or Option+Down
- **THEN** cli-shell SHALL NOT invent product-specific word navigation semantics
- **AND** it SHALL pass through backend/native terminal input when a native sequence is available

### Requirement: Supported terminal key behavior SHALL be covered by BDD matrix tests

cli-shell SHALL maintain a BDD key matrix for supported terminal key encoding and cursor-follow behavior. Unknown keys MAY remain unsupported, but they MUST NOT be silently treated as verified behavior.

#### Scenario: Supported key matrix is tested
- **WHEN** cli-shell changes terminal input encoding
- **THEN** tests SHALL cover printable text, arrows, Home, End, Delete, PageUp, PageDown, Backspace, Tab, Enter, Escape, and Ctrl-letter input
- **AND** the tests SHALL verify whether each supported key routes to backend input and cursor follow

#### Scenario: Unknown keys remain explicit
- **WHEN** cli-shell receives a key outside the supported matrix and no native sequence is available
- **THEN** cli-shell SHALL return no encoded terminal input
- **AND** the key SHALL NOT be counted as covered behavior by the supported key matrix
