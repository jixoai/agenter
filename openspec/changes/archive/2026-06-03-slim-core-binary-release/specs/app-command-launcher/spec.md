## ADDED Requirements

### Requirement: Retired core TUI command SHALL be unsupported

When the legacy core TUI package is retired, the core `agenter` launcher SHALL reject `tui` as an unsupported command. The launcher MUST NOT keep a hidden descriptor, workspace resolution path, or remote fallback path for the retired TUI surface once the package has been moved to `tui-bak` and removed from the live workspace graph.

#### Scenario: `agenter tui` is rejected after TUI retirement
- **WHEN** a user runs `agenter tui`
- **THEN** the launcher rejects `tui` as an unsupported command
- **AND** it does not import `@agenter/tui` or any backup replacement package
- **AND** it does not start a daemon for the removed core TUI surface

#### Scenario: `tui-bak` is not treated as a workspace app package
- **GIVEN** the repo still contains a non-workspace backup directory named `tui-bak`
- **WHEN** the launcher resolves first-party app commands from workspace or installed packages
- **THEN** it does not treat `tui-bak` as a descriptor-backed app package
- **AND** user command text cannot revive the retired TUI package through workspace fallback
