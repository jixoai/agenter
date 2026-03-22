# client-runtime-store Specification

## Purpose
TBD - created by archiving change propagate-terminal-contract-to-clients. Update Purpose after archive.
## Requirements
### Requirement: Client runtime store SHALL normalize the terminal contract without losing set semantics
The client runtime store SHALL treat `focusedTerminalIds` and terminal read representation metadata as first-class fields and SHALL not collapse them into legacy single-value assumptions.

#### Scenario: Store receives multiple focused terminals
- **WHEN** the runtime store ingests a snapshot or event containing several focused terminal ids
- **THEN** the store preserves the full ordered id set
- **THEN** selectors can derive a primary terminal view without discarding the rest of the set

#### Scenario: Store receives a terminal diff representation
- **WHEN** the runtime store ingests a terminal read result marked as `representation = diff`
- **THEN** it keeps that representation metadata in state
- **THEN** UI selectors can distinguish compact diff reads from full snapshots

