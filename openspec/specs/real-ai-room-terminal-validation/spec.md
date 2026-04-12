# real-ai-room-terminal-validation Specification

## Purpose
Define the opt-in real-provider validation flow that proves single-avatar room delivery, terminal work, and attention convergence together.

## Requirements

### Requirement: Backend real-provider validation SHALL prove single-avatar room delivery
The backend SHALL provide an opt-in real-provider scenario that exercises one user and one Avatar through the primary room, terminal-backed tiny-app creation, reachable local HTTP delivery, and one round of user feedback on the delivered app.

#### Scenario: Initial delivery reaches a real local HTTP URL
- **GIVEN** a real provider is configured and the real validation suite is enabled
- **WHEN** the user asks the Avatar to build a tiny app and deliver it through the primary room
- **THEN** the Avatar acknowledges the work in the primary room, uses terminal tools to create and launch the app, and sends a delivery message containing `APP-URL: http://127.0.0.1:<port>/`
- **AND** a real HTTP fetch to that URL succeeds and returns deterministic v1 content markers

#### Scenario: User feedback updates the delivered app
- **GIVEN** the initial delivered URL is already reachable with deterministic v1 content markers
- **WHEN** the scenario simulates the user opening that URL and sending one small feedback request in the same primary room
- **THEN** the Avatar applies the requested change through terminal-backed work and sends a room-visible update acknowledgement
- **AND** a real HTTP fetch to the delivered URL returns deterministic v2 content markers that prove the feedback was applied

#### Scenario: Success proves room, terminal, and attention convergence together
- **WHEN** the single-avatar delivery scenario completes successfully
- **THEN** the observed model-call traces include `message_send` and at least one `terminal_*` tool
- **AND** the validation-scoped attention contexts converge back to zero after delivery and after the feedback round

### Requirement: Real delivery validation SHALL fail with concrete backend evidence
The real-provider validation flow SHALL emit concrete backend evidence when the scenario fails so engineers can distinguish prompt, runtime, room, terminal, and delivery regressions without opening WebUI.

#### Scenario: Failure output includes room, model, and delivery evidence
- **WHEN** the scenario times out, the delivered URL is unreachable, or the fetched content does not match the required markers
- **THEN** the failing run reports recent room truth messages, recent model-call outcomes, the last observed delivery URL, and the latest HTTP fetch result or error
- **AND** the evidence is sufficient to tell whether the failure happened before delivery, during HTTP launch, or after the feedback round
