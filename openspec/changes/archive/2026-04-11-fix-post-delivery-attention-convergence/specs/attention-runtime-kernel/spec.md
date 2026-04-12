## ADDED Requirements

### Requirement: Runtime SHALL keep internal lifecycle facts observable without fabricating scheduling debt
The runtime SHALL persist its own lifecycle bookkeeping facts for inspection and history, but SHALL NOT assign unresolved scheduling debt to those facts unless the event is explicitly modeled as actionable work.

#### Scenario: Successful terminal creation stays in history without remaining active
- **WHEN** the runtime creates or focuses a terminal and records lifecycle commits such as `terminal_create` or `terminal_focus`
- **THEN** those commits remain queryable in the terminal attention context history
- **AND** the same context does not stay active solely because of that runtime-owned bookkeeping

#### Scenario: Explicitly scored background terminal readiness remains actionable
- **WHEN** an unfocused terminal transitions from busy work to a ready idle state and the runtime emits a dedicated actionable attention event
- **THEN** that event may still carry unresolved score greater than zero
- **AND** the scheduler may treat it as real follow-up work

#### Scenario: Focused terminal observations stay queryable without remaining active
- **WHEN** a focused terminal snapshot or diff is committed into attention history for inspection
- **THEN** that terminal observation remains queryable in the terminal context history
- **AND** it does not stay active solely because the runtime observed new terminal output
