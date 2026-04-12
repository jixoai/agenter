## ADDED Requirements

### Requirement: Backend real-provider validation SHALL cover an ordinary-user single-Avatar delivery flow
The backend SHALL provide an opt-in real-provider scenario where one ordinary non-technical user asks one Avatar for a small app in natural language, receives a reachable local delivery URL, gives follow-up feedback, and receives the updated result on the same URL.

#### Scenario: Ordinary user gets a delivered and revised tiny app
- **GIVEN** a real provider is configured and the real validation suite is enabled
- **WHEN** one user asks one Avatar for a small app in ordinary language and later gives one natural-language feedback message
- **THEN** the Avatar acknowledges the work, uses room plus terminal to deliver a reachable local URL, and later updates the same URL from the feedback
- **AND** a real HTTP fetch confirms the expected user-visible markers before and after the feedback

### Requirement: Backend real-provider validation SHALL cover an ordinary-user two-Avatar collaboration flow
The backend SHALL provide an opt-in real-provider scenario where one ordinary non-technical user asks two specialized Avatars for a small collaborative project in one shared project room, including design attachment handoff and final delivery.

#### Scenario: Ordinary user sees real multi-Avatar collaboration without scripted room choreography
- **GIVEN** a real provider is configured and the real validation suite is enabled
- **WHEN** one user gives a natural-language project request in a shared project room to two Avatars
- **THEN** the Avatars coordinate in-room according to their specialties, exchange enough durable contract facts, hand off a design attachment, and publish a reachable final project URL
- **AND** the delivered URL and API output match the requested user-visible expectations

### Requirement: Realistic-user validation SHALL remain diagnosable
The realistic-user real-provider flows SHALL emit enough evidence to explain failures without relying on exact scripted assistant wording.

#### Scenario: Failure output includes durable outcome evidence
- **WHEN** a realistic-user validation flow fails to deliver, coordinate, attach, or revise correctly
- **THEN** the failing run reports room truth, tool-trace evidence, workspace file or attachment state, and latest delivery fetch results
- **AND** the evidence is sufficient to diagnose whether prompt law, system guidance, or runtime behavior broke the flow
