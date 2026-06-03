# real-ai-room-terminal-validation Specification

## Purpose
Define the opt-in real-provider validation flow that proves single-avatar room delivery, terminal work, and attention convergence together.

## Requirements

### Requirement: Backend real-provider validation SHALL prove single-avatar room delivery
The backend SHALL provide an opt-in real-provider scenario that exercises one user and one Avatar through an explicitly provisioned validation room, terminal-backed tiny-app creation, reachable local HTTP delivery, and one round of user feedback on the delivered app. The scenario SHALL run with a dedicated builder Avatar persona rather than the shared default Avatar prompt state.

#### Scenario: Room-terminal delivery uses a dedicated builder persona
- **GIVEN** a real provider is configured and the real validation suite is enabled
- **WHEN** the single-avatar room-terminal delivery scenario starts
- **THEN** the Avatar runtime mounts a dedicated test Avatar nickname and `AGENTER.mdx`
- **AND** that persona biases toward concise room acknowledgements, CLI-first execution, and explicit delivery reporting without embedding a fixed canned recipe

#### Scenario: Initial delivery reaches a real local HTTP URL
- **GIVEN** a real provider is configured and the real validation suite is enabled
- **WHEN** the user asks the Avatar to build a tiny app and deliver it through the validation room
- **THEN** the Avatar acknowledges the work in that validation room, uses terminal tools to create and launch the app, and sends a delivery message containing `APP-URL: http://127.0.0.1:<port>/`
- **AND** a real HTTP fetch to that URL succeeds and returns deterministic v1 content markers

#### Scenario: User feedback updates the delivered app
- **GIVEN** the initial delivered URL is already reachable with deterministic v1 content markers
- **WHEN** the scenario simulates the user opening that URL and sending one small feedback request in the same validation room
- **THEN** the Avatar applies the requested change through terminal-backed work and sends a room-visible update acknowledgement
- **AND** a real HTTP fetch to the delivered URL returns deterministic v2 content markers that prove the feedback was applied

#### Scenario: Success proves room, terminal, and attention convergence together
- **WHEN** the single-avatar delivery scenario completes successfully
- **THEN** the observed model-call traces include `message_send` and at least one `terminal_*` tool
- **AND** the validation-scoped attention contexts converge back to zero after delivery and after the feedback round

### Requirement: Real delivery validation SHALL fail with concrete backend evidence
The real-provider validation flow SHALL emit concrete backend evidence when the scenario fails so engineers can distinguish prompt, runtime, room, terminal, and delivery regressions without opening WebUI. That evidence SHALL include the durable session-db snapshot path and live timing evidence from the monitored runner.

#### Scenario: Failure output includes room, model, and delivery evidence
- **WHEN** the scenario times out, the delivered URL is unreachable, or the fetched content does not match the required markers
- **THEN** the failing run reports recent room truth messages, recent model-call outcomes, the last observed delivery URL, and the latest HTTP fetch result or error
- **AND** the evidence is sufficient to tell whether the failure happened before delivery, during HTTP launch, or after the feedback round

#### Scenario: Failure output includes session-db snapshot and timing breakdown
- **WHEN** the scenario times out, the delivered URL is unreachable, or the fetched content does not match the required markers
- **THEN** the failing run reports recent room truth messages, recent model-call outcomes, the latest HTTP fetch result or error, and the copied `session.db` snapshot path
- **AND** the output includes segmented timing facts for acknowledgement, delivery, and feedback-update phases

### Requirement: Shared-terminal collaboration validation SHALL pass with live runtime loops

Backend and real-provider shared-terminal validation SHALL prove shared-terminal collaboration under live runtime conditions rather than relying on pre-emptive runtime pausing as a hidden harness shortcut.

#### Scenario: Shared-terminal collaboration passes without pause shortcut
- **WHEN** a validation flow creates two runtime sessions, connects them through one room, shares one terminal, and lets the invitee write terminal input
- **THEN** both participants can observe the same terminal truth
- **AND** the validation does not require `session.pause()` to keep the runtime stable enough for that collaboration proof

#### Scenario: Runtime terminal follow-up remains bridge-governed during validation
- **WHEN** live runtime validation observes terminal changes during shared-terminal collaboration
- **THEN** any runtime follow-up caused by those changes only occurs through bridge-approved terminal ingress
- **AND** the validation can distinguish terminal collaboration success from independent AI-loop activity

### Requirement: Terminal-backed validation SHALL report process hygiene evidence

Terminal-backed validation flows SHALL capture process hygiene evidence so failures can distinguish runtime-law regressions from environment heat, port conflicts, or leaked background tasks.

#### Scenario: Validation reports port and process ownership evidence
- **WHEN** a terminal-backed validation fails because a promised local service is unreachable or the environment is already occupied
- **THEN** the failure report includes relevant port/process ownership evidence for the validation run
- **AND** engineers can distinguish code regressions from pre-existing background resource conflicts

#### Scenario: Validation reports cleanup state
- **WHEN** a terminal-backed validation completes or aborts
- **THEN** the harness reports whether validation-owned background processes were cleaned up
- **AND** leftover processes from unrelated worktrees or editor sessions remain explicitly identified as external to the current validation run
