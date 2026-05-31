## MODIFIED Requirements

### Requirement: AvatarRuntime SHALL support app runtime-session clears without multiplying runtime identity

AvatarRuntime identity SHALL remain keyed by Avatar identity alone. App startup may clear a selected Avatar's current runtime session context, but the clear operation SHALL NOT make app shell names, CLI flags, or workspace-local labels part of the runtime identity.

#### Scenario: Clear flag does not create session-key runtime identity
- **WHEN** a user runs `agenter shell --session=4 --avatar=review-4 --clear-avatar`
- **THEN** `review-4` selects the AvatarRuntime identity
- **AND** `shell-4` remains a app terminal/room resource key
- **AND** the replacement runtime does not include `shell-4` as an identity axis

#### Scenario: Same Avatar still reuses Avatar identity after clear
- **GIVEN** Avatar `review-4` was cleared and relaunched
- **WHEN** the user later runs `agenter shell --session=5 --avatar=review-4`
- **THEN** the app attaches `shell-5` resources to the same AvatarRuntime identity for Avatar `review-4`
- **AND** it does not create a separate runtime identity because the app shell name changed
