## ADDED Requirements

### Requirement: Backend real-provider validation SHALL prove shared project-room collaboration
The backend SHALL provide an opt-in real-provider scenario that validates one user, two Avatar runtimes, and one shared project room collaborating on a small application through durable room truth.

#### Scenario: Two Avatars collaborate in one shared project room
- **GIVEN** two Avatar sessions are running on the same project workspace and both have focused access to one shared global project room
- **WHEN** the user posts a small full-stack requirement into that project room
- **THEN** both Avatars respond in the same room, keep discussing implementation there, and do not require hidden room-only side channels for the project facts
- **AND** the room transcript contains at least one backend-owned reply and one frontend-owned reply

#### Scenario: Frontend design artifact becomes a durable room attachment
- **GIVEN** the frontend Avatar creates a deterministic design artifact file for the project
- **WHEN** that artifact is bridged into the shared project room as an attachment under the frontend Avatar’s room identity
- **THEN** the room snapshot exposes a durable attachment record for the design artifact
- **AND** later room readers can still observe that attachment through global room snapshot or asset list APIs

#### Scenario: Final user acceptance happens in the same project room
- **GIVEN** the frontend and backend Avatars have completed implementation and integration discussion in the shared project room
- **WHEN** the user performs a final acceptance pass on the delivered app and replies in that same room
- **THEN** the final acceptance message is preserved in the shared room truth together with the earlier design handoff and delivery messages
- **AND** the scenario proves the delivered app is reachable and reflects the agreed room contract

### Requirement: Real collaboration prompts SHALL honor explicit terminal-mount law
The real-provider collaboration validation SHALL not assume that an Avatar starts with a mounted terminal. When build or delivery work requires shell access, the scenario prompts SHALL explicitly instruct the Avatar to create or recover its own terminal through tools and SHALL re-surface any existing workspace terminal during reminder flows.

#### Scenario: Frontend file creation prompt requires explicit terminal acquisition
- **GIVEN** the frontend Avatar must write `design.svg` and `index.html` into the shared workspace
- **WHEN** the scenario issues the build prompt
- **THEN** that prompt tells the Avatar not to assume a default terminal exists
- **AND** it tells the Avatar to create or recover a terminal before writing files to disk

#### Scenario: Frontend workspace files must satisfy the full agreed HTML marker set
- **GIVEN** the frontend Avatar has written `index.html` into the shared workspace
- **WHEN** the scenario validates that file before moving on
- **THEN** the file must still contain `TEAM-UI-READY`, `USES-API:/api/status`, and `PROJECT-COLLAB-V1`
- **AND** a partial or drifted HTML file keeps the scenario in the frontend correction loop

#### Scenario: Retry flow re-focuses existing workspace terminal context
- **GIVEN** the frontend Avatar already created a workspace terminal but the files are still missing from disk
- **WHEN** the scenario issues a disk-write reminder
- **THEN** the reminder reiterates the explicit terminal law
- **AND** the harness re-focuses the existing workspace terminal before waiting again for file output

#### Scenario: Backend delivery prompt requires explicit terminal recovery and self-test
- **GIVEN** the backend Avatar must implement `server.js`, launch the local service, and publish `PROJECT-URL`
- **WHEN** the scenario issues the delivery prompt
- **THEN** that prompt tells the Avatar not to assume a default terminal exists
- **AND** it requires the Avatar to create or recover a terminal, write `server.js`, launch the service in the background, and `curl` both the HTML route and `/api/status` before publishing `PROJECT-URL`

#### Scenario: Missing PROJECT-URL retries distinguish report-only from repair-first
- **GIVEN** the backend Avatar has not yet published a valid `PROJECT-URL`
- **WHEN** the scenario retries the delivery step
- **THEN** the retry prompt requires service repair and self-test when the expected URL is not yet healthy
- **AND** the private reminder downgrades to “just report the URL” only after the service is already reachable

#### Scenario: Service-ready backend still gets one final report reminder
- **GIVEN** the backend service has become reachable at the expected URL but the shared room still lacks a backend `PROJECT-URL` message
- **WHEN** the scenario detects that healthy service state after an earlier repair-first reminder
- **THEN** it sends one final backend reminder that only asks for the room report
- **AND** the scenario waits again for a backend-owned `PROJECT-URL` message before failing

### Requirement: Shared-room API contract SHALL obey a single-source-of-truth law
The real-provider collaboration validation SHALL prevent speculative API payloads from becoming durable room truth before the backend publishes the final contract. The backend `API-ANSWER:` message is the authority for the agreed `/api/status` payload used by the rest of the scenario.

#### Scenario: Frontend asks for the backend contract without inventing final payload truth
- **GIVEN** the frontend Avatar needs the backend API contract before implementing the page
- **WHEN** it posts an `API-QUESTION:` in the shared project room
- **THEN** the question requests the backend's final contract without publishing a guessed JSON payload as if it were already agreed
- **AND** the room does not gain a speculative contract that can override later backend truth

#### Scenario: Backend contract is validated before implementation proceeds
- **GIVEN** the user requires `/api/status` to include `TEAM-API-READY` and `PROJECT-COLLAB-V1`
- **WHEN** the backend posts an `API-ANSWER:` in the shared project room
- **THEN** the scenario validates that reply against the required markers and the exact `status` / `version` / `timestamp` field set before moving on to frontend implementation or final delivery
- **AND** a mismatched answer triggers another correction step instead of silently becoming the collaboration baseline

### Requirement: Multi-avatar collaboration validation SHALL fail with actor-aware diagnostics
The real-provider multi-avatar validation flow SHALL emit enough backend evidence to distinguish which actor, room step, or attachment bridge failed.

#### Scenario: Failure output includes actor-scoped room evidence
- **WHEN** the scenario fails before collaboration settles
- **THEN** the failing run reports shared-room messages with actor identity, recent model-call outcomes for both Avatar sessions, and the latest attachment or delivery evidence
- **AND** the output is sufficient to tell whether the failure happened in role coordination, attachment handoff, implementation, or final acceptance
