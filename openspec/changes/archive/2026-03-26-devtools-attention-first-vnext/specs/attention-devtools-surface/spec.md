## ADDED Requirements

### Requirement: Devtools SHALL organize inspection around attention-first panels
The Devtools route SHALL present runtime inspection through attention-first panels for contexts, cycles, model calls, trace, terminals, and tasks instead of a LoopBus-first narrative.

#### Scenario: Devtools opens with attention-first navigation
- **WHEN** the user opens the Devtools route for a session
- **THEN** the primary inspection surfaces are attention contexts, cycles, model calls, trace, terminals, and tasks
- **THEN** `LoopBus` is not presented as the top-level user-facing concept

#### Scenario: Cycle view remains a time-oriented companion surface
- **WHEN** the user inspects cycles from Devtools
- **THEN** the cycle panel is framed as a time view over attention work rather than the source of truth for the runtime model
- **THEN** linked contexts, model calls, and trace remain reachable from the same inspection flow

### Requirement: Attention-first panels SHALL expose consistent loading and empty states
Each attention-first Devtools panel SHALL expose loading, loaded-empty, loaded-with-data, and incremental-history states through a shared interaction model.

#### Scenario: Empty loading escalates to readable panel messaging
- **WHEN** a panel is loading and has no previously loaded data
- **THEN** the panel shows an explicit textual loading state
- **THEN** the user is not left with a misleading empty-state message

#### Scenario: Background refresh stays visually restrained
- **WHEN** a panel already has visible data and refreshes or loads older history
- **THEN** the panel keeps the existing content visible
- **THEN** loading is expressed through a restrained secondary signal instead of replacing the content with a blank state
