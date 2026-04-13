## MODIFIED Requirements

### Requirement: Backend real-provider validation SHALL cover an ordinary-user single-Avatar delivery flow
The backend SHALL provide an opt-in real-provider scenario where one ordinary non-technical user asks one Avatar for a small app in natural language, receives a reachable local delivery URL, gives follow-up feedback, and receives the updated result on the same URL. The scenario SHALL run with a dedicated Avatar persona tuned for ordinary-user communication plus CLI execution.

#### Scenario: Ordinary-user single-avatar flow mounts a novice-friendly builder persona
- **GIVEN** a real provider is configured and the real validation suite is enabled
- **WHEN** the ordinary-user single-avatar delivery scenario starts
- **THEN** the Avatar runtime uses a scenario-scoped `AGENTER.mdx` that keeps confirmations short, avoids leaking tooling jargon to the user, and still biases toward CLI-first execution
- **AND** the scenario diagnostics preserve that Avatar identity

### Requirement: Backend real-provider validation SHALL cover an ordinary-user two-Avatar collaboration flow
The backend SHALL provide an opt-in real-provider scenario where one ordinary non-technical user asks two specialized Avatars for a small collaborative project in one shared project room, including design attachment handoff and final delivery. Each participant SHALL use a dedicated collaboration persona rather than the shared default Avatar prompt state.

#### Scenario: Ordinary-user collaboration flow mounts dedicated specialist personas
- **GIVEN** a real provider is configured and the real validation suite is enabled
- **WHEN** the ordinary-user multi-avatar project scenario starts
- **THEN** backend and frontend participants each receive their own scenario-scoped `AGENTER.mdx`
- **AND** the personas bias toward user-facing clarity in-room while preserving CLI-first execution and role specialization

### Requirement: Realistic-user validation SHALL remain diagnosable
The realistic-user real-provider flows SHALL emit enough evidence to explain failures without relying on exact scripted assistant wording.

#### Scenario: Failure output includes snapshot-backed durable outcome evidence
- **WHEN** a realistic-user validation flow fails to deliver, coordinate, attach, or revise correctly
- **THEN** the failing run reports room truth, tool-trace evidence, workspace file or attachment state, latest delivery fetch results, and the copied `session.db` snapshot path
- **AND** the output includes live timing or phase evidence collected while the scenario was still running
