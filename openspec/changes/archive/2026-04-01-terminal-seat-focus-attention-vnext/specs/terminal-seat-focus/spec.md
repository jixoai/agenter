# terminal-seat-focus Specification

## Purpose

Define actor-scoped terminal focus as collaboration truth and the boundary between terminal inspection and attention ingestion.

## Requirements

### Requirement: Terminal focus SHALL be tracked per actor seat

Terminal-system SHALL track focused terminal ids per actor seat instead of collapsing focus into one shared terminal-global flag.

#### Scenario: Two actors focus the same terminal independently
- **WHEN** two different actors focus the same terminal
- **THEN** terminal-system records focus for both actors
- **THEN** one actor clearing focus does not silently clear the other actor's focus

#### Scenario: One actor focuses multiple terminals
- **WHEN** one actor focuses more than one terminal
- **THEN** that actor's focused terminal set contains every focused terminal id
- **THEN** clients do not need to reconstruct multi-focus from a single derived field

### Requirement: Terminal inspection SHALL remain separate from focus

Client inspection state SHALL allow the user to browse a terminal without changing actor-owned focus truth.

#### Scenario: User switches inspected terminal tab
- **WHEN** the user selects a different terminal tab in the workbench
- **THEN** the inspected terminal changes
- **THEN** terminal-system focus remains unchanged until an explicit seat-level focus mutation occurs

### Requirement: Session runtime SHALL ingest terminal attention from its own actor focus

App-server runtime SHALL only convert terminals focused by the current session actor into terminal attention inputs for that session.

#### Scenario: Another actor focuses a terminal but this session actor does not
- **WHEN** a second actor focuses a terminal and the current session actor does not
- **THEN** terminal-system still records that second actor's focus truth
- **THEN** the current session runtime does not ingest that terminal as attention solely because another actor focused it
