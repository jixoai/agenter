## MODIFIED Requirements

### Requirement: Backend real-provider validation SHALL prove single-avatar room delivery
The backend SHALL provide an opt-in real-provider scenario that exercises one user and one Avatar through the primary room, terminal-backed tiny-app creation, reachable local HTTP delivery, and one round of user feedback on the delivered app. The scenario SHALL run with a dedicated builder Avatar persona rather than the shared default Avatar prompt state.

#### Scenario: Room-terminal delivery uses a dedicated builder persona
- **GIVEN** a real provider is configured and the real validation suite is enabled
- **WHEN** the single-avatar room-terminal delivery scenario starts
- **THEN** the Avatar runtime mounts a dedicated test Avatar nickname and `AGENTER.mdx`
- **AND** that persona biases toward concise room acknowledgements, CLI-first execution, and explicit delivery reporting without embedding a fixed canned recipe

### Requirement: Real delivery validation SHALL fail with concrete backend evidence
The real-provider validation flow SHALL emit concrete backend evidence when the scenario fails so engineers can distinguish prompt, runtime, room, terminal, and delivery regressions without opening WebUI. That evidence SHALL include the durable session-db snapshot path and live timing evidence from the monitored runner.

#### Scenario: Failure output includes session-db snapshot and timing breakdown
- **WHEN** the scenario times out, the delivered URL is unreachable, or the fetched content does not match the required markers
- **THEN** the failing run reports recent room truth messages, recent model-call outcomes, the latest HTTP fetch result or error, and the copied `session.db` snapshot path
- **AND** the output includes segmented timing facts for acknowledgement, delivery, and feedback-update phases
