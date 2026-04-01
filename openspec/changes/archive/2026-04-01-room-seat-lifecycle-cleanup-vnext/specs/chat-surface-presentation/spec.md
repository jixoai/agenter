## MODIFIED Requirements

### Requirement: Room create and edit surfaces SHALL model seats, not fake identity roles

Room create and metadata-edit surfaces SHALL let the operator choose seats without exposing deprecated `avatar|user|system` role selectors.

#### Scenario: Create room starts with an empty seat list
- **WHEN** the user opens the create room dialog
- **THEN** the participant editor starts from an empty seat list instead of auto-seeding every discovered session
- **AND** the operator explicitly adds the seats they want in the room

#### Scenario: Room editor does not expose identity-role selector
- **WHEN** the user edits room participants
- **THEN** the UI only exposes seat selection and removal
- **AND** permission concepts remain in admin or grant controls rather than a fake participant identity role field

### Requirement: Room lifecycle actions SHALL expose archive and dissolve separately

The room admin surface SHALL expose archive and dissolve as different actions with different consequences.

#### Scenario: Admin sees both archive and delete actions
- **WHEN** an admin opens room metadata controls
- **THEN** the UI presents archive as a reversible hide action
- **AND** it presents delete as the destructive dissolve action
