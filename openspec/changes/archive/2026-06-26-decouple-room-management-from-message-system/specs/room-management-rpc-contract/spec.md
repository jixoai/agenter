## ADDED Requirements

### Requirement: Room-management contract SHALL be local-first but RPC-shaped
The room-management contract SHALL be defined so the same operations can later be exposed over RPC/pub-sub without changing ownership law or adding bridge-only special fields.

#### Scenario: Local room-management calls do not depend on hidden in-process ownership
- **WHEN** a local message-system instance uses room-management APIs
- **THEN** the contract only requires explicit room-management inputs and identity/proof inputs
- **AND** it does not depend on hidden runtime-local room ownership state

### Requirement: Future remote support SHALL build on room-management RPC rather than message-specific bridge hacks
Remote participation SHALL be modeled as remote message-system instances consuming/exposing the room-management contract over RPC/pub-sub, rather than by extending old bridge calls with local exception fields.

#### Scenario: Remote direction is recorded as an architecture law, not an ad-hoc bridge patch
- **WHEN** the system later adds remote message-system participation
- **THEN** the design direction is to expose room-management operations and subscriptions over RPC/pub-sub
- **AND** the local-first contract does not need new ad-hoc transport-only fields to preserve room truth ownership
