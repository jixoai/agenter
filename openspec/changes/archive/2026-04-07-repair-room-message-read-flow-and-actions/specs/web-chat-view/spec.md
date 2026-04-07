## MODIFIED Requirements

### Requirement: Web chat view SHALL render canonical avatar and message action affordances

The shared chat package SHALL support host-provided canonical avatar/icon resolution for room and actor identity, and it SHALL expose local hover/context message action affordances from the shared message row implementation.

#### Scenario: Host resolves canonical avatars
- **WHEN** the host provides canonical icon or avatar URLs for the channel or participants
- **THEN** the shared message rows render those canonical avatars in transcript presentation
- **THEN** the chat package does not guess durable identity solely from visible labels

#### Scenario: Shared row exposes local message actions
- **WHEN** the operator hovers or context-clicks a transcript row
- **THEN** the row reveals the shared local message action affordance
- **THEN** host routes can extend those actions without replacing the shared row renderer

#### Scenario: Read indicator opens a message-local disclosure
- **WHEN** a transcript message has read-progress details
- **THEN** the inline-end read indicator remains compact by default
- **THEN** activating that indicator opens a message-local disclosure showing the canonical `read` and `unread` actor lists for that message
