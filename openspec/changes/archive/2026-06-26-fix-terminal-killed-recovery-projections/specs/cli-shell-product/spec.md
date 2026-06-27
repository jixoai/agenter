## ADDED Requirements

### Requirement: Cli-shell startup navigation SHALL list only live terminal bindings
Cli-shell startup navigation SHALL list only live cli-shell terminal bindings as selectable Shells. Killed cli-shell bindings MAY be read from history or index only for non-selection purposes such as avoiding app resource-key reuse or explaining historical evidence.

Selectable Shells SHALL be a app-level projection, not a direct alias for the TerminalSystem live projection. A selectable existing Shell MUST be a canonical cli-shell Shell root, such as `shell-N`, and MUST have a running TerminalSystem instance. Terminal rows that are live from the platform perspective but are `not_started`, legacy sub-bindings such as `shell-N:terminal-M`, archived, killed, or non-canonical verification/test resource keys MUST NOT be shown as existing Shell choices.

#### Scenario: Killed cli-shell binding is not selectable
- **GIVEN** a cli-shell app binding exists for `shell-5`
- **AND** its TerminalSystem terminal has completed the killed flow
- **WHEN** the user opens cli-shell startup navigation
- **THEN** `shell-5` is not listed as a selectable live Shell
- **AND** selecting an existing Shell cannot target that killed terminal id

#### Scenario: Killed history may reserve resource numbering
- **GIVEN** killed cli-shell bindings exist for `shell-1` and `shell-2`
- **AND** live cli-shell binding exists for `shell-3`
- **WHEN** cli-shell offers a new Shell action
- **THEN** it may choose the next unused app resource key such as `shell-4`
- **AND** it still does not list killed bindings as reusable live Shells

#### Scenario: Dirty platform-live rows are not selectable Shells
- **GIVEN** TerminalSystem live projection contains a cli-shell row with `processPhase=not_started`
- **AND** it contains an old cli-shell resource key like `shell-3:terminal-1`
- **AND** it contains a non-canonical verification resource key like `shell-verify-shell-frame`
- **AND** it contains a running canonical resource key like `shell-14`
- **WHEN** cli-shell builds startup navigation
- **THEN** only `shell-14` is listed as a selectable existing Shell
- **AND** the non-selectable known root `shell-3` may still reserve numbering so the New Shell action does not reuse it

#### Scenario: Re-entering killed session creates clean terminal binding
- **GIVEN** the last app resource key points only to a killed terminal binding
- **WHEN** the user re-enters that cli-shell session for normal work
- **THEN** cli-shell creates or binds a clean live TerminalSystem terminal for that app resource
- **AND** it does not silently bootstrap the killed terminal unless an explicit killed-history recovery action is used

#### Scenario: Startup chooser uses core projections only
- **WHEN** cli-shell builds the startup Shell list
- **THEN** it consumes client-sdk live/history/index projection APIs
- **AND** it does not scan tmux panes, route-local caches, or all terminal records as substitute lifecycle truth
