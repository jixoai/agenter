## MODIFIED Requirements

### Requirement: Message-system SHALL present rooms as a standalone app surface
The WebUI SHALL expose a dedicated message-system route that lists global rooms, renders one selected room transcript through the shared chat surface, and keeps the room transcript/composer workflow as the primary operator task. The route shell and room-management dialogs SHALL use the shared scaffold-family primitives so the transcript, management rail, and dialog detail stage no longer repeat their own stretch-layout contracts.

#### Scenario: Room management uses scaffold-family shells
- **WHEN** the operator opens room management or room creation
- **THEN** the surface uses scaffold-family primitives for fixed chrome, split rail/detail regions, and scroll ownership
- **THEN** the dialog no longer relies on page-local layout patches to keep headers visible and body regions scrollable
