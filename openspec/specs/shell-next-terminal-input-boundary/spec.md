# shell-next-terminal-input-boundary Specification

## Purpose
TBD - created by archiving change fix-shell-next-background-run-lifecycle-and-input-boundary. Update Purpose after archive.
## Requirements
### Requirement: Shell-next terminal input handling SHALL be source-owned

Mouse and keyboard semantics for terminal panes SHALL remain owned by the terminal source or backend utility layer, not by the Shell/OpenCompose view layer.

#### Scenario: View code only forwards terminal input intent
- **WHEN** the user clicks, drags, presses keys, or pastes inside a terminal pane
- **THEN** the Shell/OpenCompose view path only translates coordinates and forwards intent
- **AND** the terminal source owns the durable selection, paste, and follow-cursor behavior

#### Scenario: App code does not own scroll-aware terminal selection
- **GIVEN** terminal selection depends on viewport and scrollback truth
- **WHEN** shell-next processes terminal mouse or keyboard selection gestures
- **THEN** the scroll-aware selection state is owned below the app layer
- **AND** the app layer remains a app router only

#### Scenario: Terminal-specific behavior is not duplicated in multiple layers
- **WHEN** the terminal input audit runs
- **THEN** there is one semantic owner for terminal mouse and keyboard behavior
- **AND** any stray duplicate ownership above that boundary is removed
