## MODIFIED Requirements

### Requirement: Message-system SHALL present rooms as a standalone app surface

The `New room` surface SHALL describe empty-title behavior objectively. If the control plane falls back to `Room` when the title field is blank, the route SHALL not imply a different default title through placeholder or helper copy.

#### Scenario: Empty room title affordance matches fallback title
- **WHEN** the operator opens the `New room` route and leaves the title input untouched
- **THEN** the route copy reflects that blank submission falls back to `Room`
- **AND** the title field does not visually imply that a different example string will be submitted as the real title
