## ADDED Requirements

### Requirement: Message-system tabs SHALL resolve canonical room icon identity
The message-system workbench SHALL render icon-bearing tabs for fixed views and room views. Dynamic room tabs SHALL resolve room-owned icons from the canonical icon authority instead of falling back to label-only initials as the durable navigation model.

#### Scenario: Room tab shows canonical room icon
- **WHEN** the operator opens or reopens a room tab in Messages
- **THEN** that tab renders the room's canonical icon from the room icon authority
- **THEN** the tab does not rely on a feature-local initials-only fallback as its primary identity surface

#### Scenario: Fixed tabs keep stable non-room icons
- **WHEN** the workbench renders fixed tabs such as `New room`
- **THEN** those tabs still render their stable non-room icon affordances
- **THEN** the presence of room icons does not remove icon affordances from the rest of the workbench

### Requirement: Message-system route SHALL expose a rich shared room transcript surface
The selected room transcript SHALL present canonical avatars, improved message bubbles, attachment rendering, and local hover/context actions through the shared chat component, while keeping room orchestration and management outside the transcript renderer.

#### Scenario: Hover or context interaction reveals room message actions
- **WHEN** the operator hovers a room message or opens its context menu
- **THEN** the transcript exposes the shared local message action affordances for that message
- **THEN** the route does not need a second feature-local bubble implementation to provide those actions

#### Scenario: Room attachment renders after reload
- **WHEN** the operator reloads a room whose transcript contains persisted room attachments
- **THEN** the transcript renders those attachments with kind-appropriate preview or file affordances
- **THEN** the operator can inspect the same room history without re-uploading the assets
