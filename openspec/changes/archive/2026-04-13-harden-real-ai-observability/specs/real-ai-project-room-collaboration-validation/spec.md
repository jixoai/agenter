## MODIFIED Requirements

### Requirement: Backend real-provider validation SHALL prove shared project-room collaboration
The backend SHALL provide an opt-in real-provider scenario that validates one user, two Avatar runtimes, and one shared project room collaborating on a small application through durable room truth. The scenario SHALL run with dedicated backend and frontend collaboration personas rather than shared default Avatar prompt state.

#### Scenario: Shared project-room collaboration mounts specialist personas
- **GIVEN** two Avatar sessions are running on the same project workspace and both have focused access to one shared global project room
- **WHEN** the shared project-room collaboration scenario starts
- **THEN** the backend participant uses a dedicated backend `AGENTER.mdx` and the frontend participant uses a dedicated frontend `AGENTER.mdx`
- **AND** those personas preserve role specialization, room-visible coordination, and CLI-first execution without baking in a single scripted transcript

### Requirement: Multi-avatar collaboration validation SHALL fail with actor-aware diagnostics
The real-provider multi-avatar validation flow SHALL emit enough backend evidence to distinguish which actor, room step, or attachment bridge failed. That evidence SHALL include actor-scoped durable snapshot facts from the monitored runner.

#### Scenario: Failure output includes actor-scoped snapshot evidence
- **WHEN** the scenario fails before collaboration settles
- **THEN** the failing run reports shared-room messages with actor identity, recent model-call outcomes for both Avatar sessions, the latest attachment or delivery evidence, and copied `session.db` snapshot paths for the participating runtimes
- **AND** the output includes enough timing and live-progress evidence to tell whether the failure happened in coordination, attachment handoff, implementation, or final acceptance
