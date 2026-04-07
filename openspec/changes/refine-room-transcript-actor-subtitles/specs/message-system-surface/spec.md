## MODIFIED Requirements

### Requirement: Message-system route SHALL expose a rich shared room transcript surface

The selected room transcript SHALL present canonical avatars, improved message bubbles, attachment rendering, and local hover/context actions through the shared chat component, while keeping room orchestration and management outside the transcript renderer.

#### Scenario: Hover or context interaction reveals room message actions
- **WHEN** the operator hovers a room message or opens its context menu
- **THEN** the transcript exposes the shared local message action affordances for that message
- **THEN** the route does not need a second feature-local bubble implementation to provide those actions

#### Scenario: Transcript actor subtitle stays quiet until disambiguation is needed
- **WHEN** a room message sender has a unique visible label within the current room
- **THEN** the transcript row does not show selector-level technical subtitle detail such as workspace path or raw actor id
- **THEN** that subtitle only appears once duplicate visible labels require disambiguation

#### Scenario: Room attachment renders after reload
- **WHEN** the operator reloads a room whose transcript contains persisted room attachments
- **THEN** the transcript renders those attachments with kind-appropriate preview or file affordances
- **THEN** the operator can inspect the same room history without re-uploading the assets
