## ADDED Requirements

### Requirement: Terminal-system live tabs SHALL consume only live projection
The Studio terminal-system workbench SHALL build its live terminal tabs from the live terminal projection only. Killed terminals SHALL appear only in explicit history, index, or archive surfaces and SHALL be removed from live tabs after explicit kill, natural exit, or daemon restart recovery.

#### Scenario: Restart cleanup removes killed terminal tabs
- **GIVEN** Studio had terminal tabs open before daemon restart
- **WHEN** daemon recovery moves those terminal instances through the killed flow
- **THEN** the live terminal tab strip removes those terminal tabs after projection refresh
- **AND** the operator can inspect them only through explicit history/index surfaces

#### Scenario: History/index surface does not imply live shell
- **WHEN** the operator opens terminal history or index
- **THEN** killed terminal rows are labeled and managed as dead evidence
- **AND** the UI does not present them as currently writable live shells

#### Scenario: Live route navigates away from killed terminal
- **WHEN** the currently selected terminal leaves the live projection
- **THEN** the live route navigates to another live terminal, the history/index surface, or new terminal creation
- **AND** it does not keep rendering the killed terminal through stale live route state
