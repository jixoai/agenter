## ADDED Requirements

### Requirement: Built-in terminal skill SHALL prefer clean terminal creation over killed reuse
The built-in terminal skill SHALL teach that killed terminals are dead evidence by default. For normal new work, the guidance SHALL prefer creating or selecting a live terminal instead of bootstrapping a killed terminal. Recovering a killed terminal SHALL be framed as explicit forensic or continuity recovery.

#### Scenario: Skill teaches killed terminals are not normal live candidates
- **WHEN** the runtime renders built-in terminal skill guidance
- **THEN** the guidance states that killed terminals leave `terminal list`
- **AND** it does not tell the AI to treat killed terminals as normal paused shells

#### Scenario: Skill prefers a clean terminal for normal work
- **WHEN** the AI needs an interactive terminal and the previous candidate is killed
- **THEN** the guidance tells the AI to create or select a live terminal for normal work
- **AND** it reserves killed recovery for an explicit user or operator intent

#### Scenario: Skill keeps history management explicit
- **WHEN** the guidance mentions killed terminal evidence
- **THEN** it points inspection to `terminal history` or terminal index surfaces
- **AND** it keeps archive and delete as explicit history-management actions
