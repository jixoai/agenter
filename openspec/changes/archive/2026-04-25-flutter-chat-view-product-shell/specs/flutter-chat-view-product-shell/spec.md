## ADDED Requirements

### Requirement: Flutter product shell SHALL separate profiles, chat stage, and detail surfaces
The standalone Flutter Web app SHALL present room chat through a product shell rather than a demo configuration screen. The shell SHALL separate app-level profile selection, the conversation-first chat stage, and detail surfaces for room facts or selected messages.

#### Scenario: Desktop shell presents a multi-surface chat workspace
- **WHEN** the product shell is rendered in a wide viewport
- **THEN** it shows a dedicated profile/navigation surface, a central conversation stage, and a detail rail
- **THEN** room configuration does not occupy the primary transcript space by default

#### Scenario: Compact shell preserves the same capabilities through adaptive navigation
- **WHEN** the product shell is rendered in a narrow viewport
- **THEN** it adapts navigation and detail access without removing profile access, conversation browsing, or room details
- **THEN** the compact layout still keeps the conversation stage immediately usable

### Requirement: Flutter product shell SHALL persist reusable connection profiles
The standalone Flutter app SHALL persist connection profiles locally so operators can reopen known room targets without manually re-entering websocket URL and token fields on every visit. A profile SHALL carry enough information to reconnect to the canonical room transport and SHALL support creation, editing, deletion, activation, and share-link projection.

#### Scenario: Saved profile restores on a later visit
- **WHEN** the operator saves a room connection profile and later reloads the app
- **THEN** the product shell restores that profile from local persistence
- **THEN** the operator can reactivate it without retyping the room transport details

#### Scenario: Share link projects the active profile
- **WHEN** the operator requests a share link for the active profile
- **THEN** the shell generates a link that carries the active `url` and `token` query parameters
- **THEN** opening that link hydrates the product shell with the same target room configuration

### Requirement: Flutter product shell SHALL treat room connection configuration as a secondary workflow
Room connection configuration SHALL be available through a dedicated settings surface such as a sheet, drawer, or dialog instead of consuming the primary conversation canvas. Empty-state onboarding MAY point to that workflow, but once a room is active the main surface SHALL remain conversation-first.

#### Scenario: Active room keeps configuration out of the primary canvas
- **WHEN** the operator has an active room profile open
- **THEN** the primary surface remains the conversation-first chat stage
- **THEN** transport URL and token editing live in a secondary configuration surface instead of the main transcript area
