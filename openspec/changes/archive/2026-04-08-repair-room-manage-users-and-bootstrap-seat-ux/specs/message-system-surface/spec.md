## MODIFIED Requirements

### Requirement: Message-system SHALL present rooms as a standalone app surface

The WebUI SHALL expose a dedicated message-system route that lists global rooms, renders one selected room transcript through the shared chat surface, and keeps the room transcript/composer workflow as the primary operator task. The selected room view SHALL support explicit viewer selection, while room membership, metadata, and access administration move into a dedicated management surface instead of a permanently expanded inline rail.

#### Scenario: Room administration opens in a dialog-sidebar management shell

- **WHEN** the operator needs room users, grants, or membership controls
- **THEN** the route opens a dedicated management dialog with a left management rail and a right detail stage
- **THEN** the dialog organizes `Overview`, `Users`, and `Permissions` as section-level destinations without hiding the main transcript workflow
- **THEN** `Users` owns the `List | Add` membership workflow, including revoke/focus actions and the add-seat grant form
- **THEN** `Permissions` owns inline per-user role changes instead of mixing membership mutation and authority mutation in one panel
- **THEN** each stretchable detail section uses one explicit `ScrollView` owner instead of ad hoc overflow behavior

### Requirement: Message-system route SHALL derive room users and viewer choices from canonical actor truth

The room viewer selector, room management surface, send-as options, and read-progress details SHALL resolve actors from canonical auth/profile or session actor identity instead of local label-only guesses.

#### Scenario: Internal bootstrap control seat stays out of user-facing selectors

- **WHEN** the selected room is owned by an internal bootstrap control seat
- **THEN** the control seat does not appear as a normal `Users` entry, viewer choice, or ordinary `Send as` actor
- **THEN** authenticated human or avatar actors remain the only user-facing membership choices unless a surface explicitly describes control-plane metadata
