## MODIFIED Requirements

### Requirement: Runtime terminal descriptors SHALL expose explicit lifecycle verbs

Descriptor-backed runtime terminal CLI and loopback-local API routes SHALL expose lifecycle control using explicit `bootstrap` and `stop` verbs that match the terminal truth model, instead of keeping legacy `kill` wording as the canonical public lifecycle action.

#### Scenario: Runtime terminal bootstrap is explicit

- **WHEN** the AI runs `terminal bootstrap` for a runtime-visible terminal whose `processPhase` is `not_started` or `stopped`
- **THEN** the shared descriptor registry validates and dispatches that lifecycle request through the runtime-local API
- **AND** the PTY only starts because of that explicit bootstrap command

#### Scenario: Runtime terminal stop preserves lifecycle truth

- **WHEN** the AI runs `terminal stop` for a running runtime-visible terminal
- **THEN** the shared descriptor registry validates and dispatches that lifecycle request through the runtime-local API
- **AND** the command stops the PTY without implying that the terminal durable identity was deleted

### Requirement: Runtime terminal descriptors SHALL expose lifecycle-aware status inspection

Descriptor-backed runtime terminal CLI SHALL present `terminal list` as the canonical shell-facing status inspection surface for runtime terminal lifecycle and observed identity facts.

#### Scenario: Terminal list returns lifecycle and observed identity facts

- **WHEN** the AI runs `terminal list`
- **THEN** the returned terminal projection includes fields such as `processPhase`, `currentPath`, `currentTitle`, and stop facts
- **AND** callers do not need to infer lifecycle only from raw `terminal read` output
