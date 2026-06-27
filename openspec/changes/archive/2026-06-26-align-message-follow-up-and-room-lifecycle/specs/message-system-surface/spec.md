## MODIFIED Requirements

### Requirement: Message-system route SHALL separate active and archived room catalogs

Once room archive becomes a meaningful lifecycle projection, room catalogs SHALL stop flattening archived rooms into the default active list and SHALL provide an explicit archived-room entrypoint instead.

#### Scenario: Default catalog shows active rooms first

- **WHEN** the operator opens the default room catalog
- **THEN** non-archived rooms appear in the active room list
- **AND** archived rooms do not disappear from durability just because they are hidden from that default list

#### Scenario: Archived rooms remain reachable through a dedicated entrypoint

- **WHEN** the operator opens the archived room entrypoint
- **THEN** archived rooms can still be browsed and reopened
- **AND** the surface does not require the operator to guess that those rooms vanished or were deleted
