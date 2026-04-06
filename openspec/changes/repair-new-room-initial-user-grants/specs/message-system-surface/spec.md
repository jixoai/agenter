## MODIFIED Requirements

### Requirement: New room route SHALL render canonical users with role-aware item rows

The `New room` route SHALL present initial users as canonical actor-backed item rows with avatars, user-centric copy, and inline role selection.

#### Scenario: Operator configures initial users in New room
- **WHEN** the operator opens the fixed `New room` tab
- **THEN** the route lists available Users from canonical actor truth
- **AND** each row shows the user's avatar, durable label, subtitle, and an inline role control such as `admin` or `member`

#### Scenario: Room create keeps the operator on the created room
- **WHEN** the operator submits `New room`
- **THEN** the UI navigates to the newly created room route
- **AND** the newly created room tab becomes the active workbench tab instead of leaving the operator on the create form

#### Scenario: New room navigates by the returned opaque id
- **WHEN** the create mutation resolves with a room id such as `room-7f3a0c2e4ab1`
- **THEN** the route navigates to `/messages/room/room-7f3a0c2e4ab1`
- **AND** the UI does not reconstruct the path from the title field
