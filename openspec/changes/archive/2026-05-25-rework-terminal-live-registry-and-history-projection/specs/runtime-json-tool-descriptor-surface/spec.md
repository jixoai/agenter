## ADDED Requirements

### Requirement: Runtime terminal descriptors SHALL expose explicit history-management verbs
Descriptor-backed runtime terminal CLI and loopback-local API routes SHALL expose `terminal history` and `terminal archive` as explicit JSON-first commands over dead terminal-instance evidence. The descriptor surface SHALL keep history inspection separate from final destructive deletion.

#### Scenario: Terminal history is descriptor-backed
- **WHEN** the AI runs `terminal history`
- **THEN** the shared descriptor registry validates and dispatches that request through the runtime-local API
- **AND** the result describes dead terminal-instance history rather than the live terminal list

#### Scenario: Terminal archive is descriptor-backed
- **WHEN** the AI runs `terminal archive` for an eligible dead terminal instance
- **THEN** the shared descriptor registry validates and dispatches that request through the runtime-local API
- **AND** the command archives the history instance without pretending it is deleted

## MODIFIED Requirements

### Requirement: Runtime terminal descriptors SHALL expose explicit lifecycle verbs
Descriptor-backed runtime terminal CLI and loopback-local API routes SHALL expose lifecycle and history control using explicit `bootstrap`, `stop`, `history`, `archive`, and `delete` verbs that match the terminal truth model. `stop` moves a live terminal into history through the killed flow; `delete` is reserved for final destructive removal.

#### Scenario: Runtime terminal bootstrap is explicit
- **WHEN** the AI runs `terminal bootstrap` for a runtime-visible terminal whose `processPhase` is `not_started`
- **THEN** the shared descriptor registry validates and dispatches that lifecycle request through the runtime-local API
- **AND** the PTY only starts because of that explicit bootstrap command

#### Scenario: Runtime terminal stop removes the instance from live status inspection
- **WHEN** the AI runs `terminal stop` for a running runtime-visible terminal
- **THEN** the shared descriptor registry validates and dispatches that lifecycle request through the runtime-local API
- **AND** the command routes the terminal through the killed flow without deleting its durable history evidence
- **AND** later `terminal list` no longer returns it as a live terminal

#### Scenario: Runtime terminal delete is final
- **WHEN** the AI runs `terminal delete` for a terminal instance that still has durable evidence
- **THEN** the shared descriptor registry validates and dispatches that destructive request through the runtime-local API
- **AND** later history or archive reads for that terminal id fail as not found

### Requirement: Runtime terminal descriptors SHALL expose lifecycle-aware status inspection
Descriptor-backed runtime terminal CLI SHALL present `terminal list` as the canonical shell-facing status inspection surface for live runtime terminal lifecycle and observed identity facts, and SHALL keep dead instances behind explicit history inspection.

#### Scenario: Terminal list returns live lifecycle and observed identity facts
- **WHEN** the AI runs `terminal list`
- **THEN** the returned terminal projection includes live fields such as `processPhase`, `currentPath`, and `currentTitle`
- **AND** callers do not need to infer lifecycle only from raw `terminal read` output
- **AND** killed terminal instances are absent from that default result

#### Scenario: Terminal history returns dead-instance facts
- **WHEN** the AI runs `terminal history`
- **THEN** the returned projection includes dead terminal-instance lifecycle and retained evidence facts
- **AND** callers do not need to overload `terminal list` with dead-instance filtering logic
