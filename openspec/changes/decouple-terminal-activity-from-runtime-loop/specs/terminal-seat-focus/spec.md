## MODIFIED Requirements

### Requirement: Session runtime SHALL ingest terminal attention from its own actor focus

App-server runtime SHALL only convert terminals focused by the current session actor into terminal attention inputs for that session. Actor-scoped focus SHALL define terminal eligibility for runtime evaluation, not an unconditional promise that every terminal semantic change becomes immediate runtime work.

#### Scenario: Another actor focuses a terminal but this session actor does not
- **WHEN** a second actor focuses a terminal and the current session actor does not
- **THEN** terminal-system still records that second actor's focus truth
- **THEN** the current session runtime does not ingest that terminal as attention solely because another actor focused it

#### Scenario: Focused terminal change remains bridge-evaluated
- **WHEN** the current session actor focuses a terminal and that terminal later changes
- **THEN** the runtime is allowed to evaluate that terminal through the terminal activity bridge
- **AND** focus alone does not require the runtime to wake or ingest attention for every terminal change

## ADDED Requirements

### Requirement: Focused terminal eligibility SHALL remain separate from immediate loop wake-up

Actor-scoped terminal focus SHALL identify which terminal changes are eligible for runtime evaluation, while the terminal activity bridge SHALL decide whether any given change is actionable enough to wake the loop.

#### Scenario: Focused passive observation stays quiet
- **WHEN** a focused terminal emits a passive observation such as ordinary shared-shell output
- **THEN** that observation remains eligible terminal context for the actor
- **AND** the runtime loop does not wake solely because the terminal was focused

#### Scenario: Focused actionable observation may wake runtime
- **WHEN** a focused terminal emits a change that the bridge classifies as actionable
- **THEN** the runtime may wake and ingest terminal attention for that actor
- **AND** the wake reason is the bridge-approved actionability rather than focus alone
