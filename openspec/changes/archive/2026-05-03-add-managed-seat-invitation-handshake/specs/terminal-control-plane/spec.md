## ADDED Requirements

### Requirement: Terminal seat management SHALL onboard shared principals through invitation acceptance

The terminal control plane SHALL let the current local admin or superadmin create, update, and revoke managed seat invitations for a target principal without issuing terminal authority until the target accepts. `terminal-manage invite` and `terminal-manage accept` SHALL be projections over these control-plane operations, not separate seat truth.

#### Scenario: Current local admin issues a terminal invitation

- **WHEN** the current local admin invites principal `P` to terminal `T` with terminal authority `RW`
- **THEN** the control plane records a pending terminal seat invitation for `T` and `P`
- **THEN** `P` does not yet receive a terminal access token or active terminal grant

#### Scenario: Accepted writable terminal seat is direct-write rather than approval-only

- **WHEN** principal `P` successfully accepts a terminal invitation for `T` with class `RW`
- **THEN** the resulting terminal-native payload is the direct-write seat
- **THEN** `P` can operate the terminal immediately without entering the requester approval path

#### Scenario: Accepted terminal invitation activates the seat

- **WHEN** principal `P` successfully accepts its pending invitation for terminal `T`
- **THEN** the control plane creates or reuses the terminal-native grant for `P`
- **THEN** the acceptance returns `P`'s active terminal access projection including the terminal access token
- **THEN** subsequent terminal reads or writes for `P` follow the native terminal role law

#### Scenario: Invited writer can collaborate on the same terminal after room delivery

- **WHEN** current local admin `A` sends principal `B` a pending terminal invitation descriptor through messageSystem and `B` accepts it with terminal authority `RW`
- **THEN** `B` can read the same shared terminal `T`
- **THEN** `B` can write to `T` immediately without entering requester approval
- **THEN** subsequent reads by both `A` and `B` can observe the terminal state that results from `B`'s write under the native terminal read law

#### Scenario: Cross-agenter invite preserves remote terminal authority

- **WHEN** Avatar-B on agenter-B creates terminal `T`, sends Avatar-A a pending descriptor through a shared room, and Avatar-A accepts from agenter-A
- **THEN** terminal `T` remains owned by agenter-B's terminal backend
- **THEN** Avatar-A gains terminal-native authority on that remote terminal only after acceptance succeeds against agenter-B
- **THEN** reads and writes issued by Avatar-A from agenter-A still affect and observe the same terminal `T` hosted by agenter-B

#### Scenario: Terminal manager authority joins the admin-candidate law

- **WHEN** principal `P` accepts a terminal invitation with terminal authority `TM`
- **THEN** the resulting seat is resolved to the terminal-native admin payload
- **THEN** `P` is inserted into the terminal's admin-candidate set
- **THEN** current-admin resolution still follows the existing single-current-admin law instead of creating a second simultaneous current admin

### Requirement: Terminal seat mutation SHALL remain a manager containment power

Terminal `config` and `revoke` operations SHALL remain unilateral actions for the current local admin or superadmin. Reconfiguring an accepted seat SHALL update the terminal-native grant law in place, and revoking a seat SHALL also invalidate any pending invitations and active write leases for that principal.

#### Scenario: Config changes an accepted terminal seat

- **WHEN** the current local admin changes principal `P` on terminal `T` from `RO` to `RW`
- **THEN** the control plane updates `P`'s active terminal seat to the terminal-native direct-write payload
- **THEN** `P` does not need to accept a second invitation only because the role changed

#### Scenario: Revoke removes active and pending terminal authority

- **WHEN** the current local admin revokes principal `P` from terminal `T`
- **THEN** any active terminal grant for `P` on `T` is revoked
- **THEN** any pending invitation for `P` on `T` becomes invalid
- **THEN** any active write lease for `P` on `T` no longer authorizes new writes
