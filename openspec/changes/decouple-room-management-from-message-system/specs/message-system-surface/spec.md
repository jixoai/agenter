## ADDED Requirements

### Requirement: Room detail surface SHALL separate room control from room participation
Frontend room surfaces SHALL present room control capability and room participation capability as separate concepts.

#### Scenario: Control-only operator can manage and read but not send
- **GIVEN** the operator holds room `superKey` control
- **AND** the operator does not hold any participant seat in that room
- **WHEN** the room detail surface is opened
- **THEN** the transcript remains readable
- **AND** room management actions remain available
- **AND** the message composer remains unavailable for sending
- **AND** the UI does not mislabel the operator as a member/admin participant

### Requirement: Room surface SHALL not hide room provenance behind one implicit local system
Frontend room and workbench surfaces SHALL be able to expose room provenance and later multi-system participation without assuming all rooms belong to one unnamed local message-system.

#### Scenario: Room detail can expose instance/system provenance
- **WHEN** room detail or related diagnostics render room metadata
- **THEN** the surface may expose the controlling `superKey` identity and relevant `systemId` provenance
- **AND** it does not rely on the old assumption that one implicit local message-system owns the room by default

### Requirement: Studio SHALL keep room domain/source metadata available but low-emphasis
Studio is the superadmin-facing app, so it SHALL keep room `superKey` / domain / source metadata available, but it SHALL avoid turning that metadata into the primary chat focus path.

#### Scenario: Low-frequency room authority stays in a secondary panel
- **GIVEN** a Studio room detail view
- **WHEN** the operator is reading or sending chat messages
- **THEN** the primary focus remains the embedded chat/transcript surface
- **AND** room domain/source metadata is still reachable through manage/metadata surfaces
- **AND** that metadata is not rendered as a loud always-on primary banner by default

### Requirement: Embedded chat surface SHALL remain ordinary-user-focused
The reusable chat surface embedded inside Studio SHALL stay focused on transcript/composer behavior instead of absorbing superadmin-only room-management chrome.

#### Scenario: Studio wraps chat without polluting the chat app
- **WHEN** Studio embeds the reusable chat surface for a room
- **THEN** transcript, composer, read-state, and message actions remain owned by that chat surface
- **AND** superadmin-only room domain/source controls remain in Studio wrapper surfaces around it
