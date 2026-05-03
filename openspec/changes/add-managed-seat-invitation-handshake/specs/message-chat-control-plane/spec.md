## ADDED Requirements

### Requirement: Room seat management SHALL onboard shared principals through invitation acceptance

The message control plane SHALL let the current room admin or superadmin create, update, and revoke managed seat invitations for a target principal without issuing room authority until the target accepts. `message-manage invite` and `message-manage accept` SHALL be projections over these control-plane operations, not separate room truth.

#### Scenario: Current room admin issues a room invitation

- **WHEN** the current room admin invites principal `P` to room `R` with room role `member`
- **THEN** the control plane records a pending room seat invitation for `R` and `P`
- **THEN** `P` does not yet receive an active room access token or active room grant

#### Scenario: Accepted room invitation activates the seat

- **WHEN** principal `P` successfully accepts its pending invitation for room `R`
- **THEN** the control plane creates or reuses the room-native seat for `P`
- **THEN** the acceptance returns `P`'s active room access projection including the room access token
- **THEN** subsequent room reads or writes for `P` follow the native room role law

#### Scenario: Room admin authority joins the current-admin candidate law

- **WHEN** principal `P` accepts a room invitation with room role `admin`
- **THEN** the resulting seat is resolved to the room-native admin payload
- **THEN** `P` is inserted into the room's admin-candidate set
- **THEN** current-admin resolution still follows the existing room current-admin law instead of creating parallel unconditional room admins

### Requirement: Room seat mutation SHALL remain a manager containment power

Room `config` and `revoke` operations SHALL remain unilateral actions for the current room admin or superadmin. Reconfiguring an accepted seat SHALL update the room-native grant law in place, and revoking a seat SHALL also invalidate any pending invitations and clear the target actor's room-local authority when no other active seat remains.

#### Scenario: Config changes an accepted room seat

- **WHEN** the current room admin changes principal `P` in room `R` from `readonly` to `member`
- **THEN** the control plane updates `P`'s active room seat to the room-native member payload
- **THEN** `P` does not need to accept a second invitation only because the role changed

#### Scenario: Revoke removes active and pending room authority

- **WHEN** the current room admin revokes principal `P` from room `R`
- **THEN** any active room grant for `P` on `R` is revoked
- **THEN** any pending invitation for `P` on `R` becomes invalid
- **THEN** room-local state for `P` is cleared when `P` no longer has any other active seat on `R`
