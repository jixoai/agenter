## Purpose

Define the real-provider acceptance flow that proves one Avatar can continue the same room-backed delivery after a true cold restart boundary.

## Requirements

### Requirement: Backend real-provider validation SHALL prove cold restart continuation
The backend SHALL provide an opt-in real-provider scenario where one Avatar first delivers a tiny app, then the runtime is stopped, the kernel is restarted, and the same task continues through durable room, workspace, prompt-window, and attention facts.

#### Scenario: Restarted Avatar resumes room-backed app work
- **GIVEN** a real provider is configured and the real validation suite is enabled
- **AND** one Avatar has already delivered a reachable tiny app through an explicit validation room
- **WHEN** the runtime is stopped, the kernel restarts, the same session is started again, and the user sends one follow-up request in the same room
- **THEN** the restarted Avatar resumes the task, recovers any missing terminal context through tools if necessary, and sends a resumed delivery message
- **AND** a real HTTP fetch to the resumed delivery URL returns deterministic post-feedback content markers

#### Scenario: Success proves restart recovery from durable facts
- **WHEN** the cold-restart validation completes successfully
- **THEN** the observed room truth spans both sides of the restart boundary with one stable session identity
- **AND** recent model-call traces after restart show resumed tool-backed work rather than a hidden in-memory continuation
- **AND** validation-scoped attention converges back to zero after the resumed delivery

### Requirement: Real cold-restart validation SHALL fail with pre/post restart evidence
The real-provider cold-restart validation flow SHALL emit enough backend evidence to distinguish pre-restart delivery failures from post-restart recovery failures.

#### Scenario: Failure output shows restart boundary evidence
- **WHEN** the restarted delivery URL is unreachable, the post-restart content markers are missing, or the Avatar does not continue after restart
- **THEN** the failing run reports recent room truth before and after restart, recent post-restart model calls, latest attention state, and latest delivery fetch result or error
- **AND** the evidence is sufficient to tell whether the failure happened before restart, during rehydration, or after resumed tool work
