## MODIFIED Requirements

### Requirement: Room creation SHALL materialize initial user grants and focus

The message control plane SHALL allow room creation to declare initial users with canonical actor identity, role, and focus intent so those users join the room as real seats during the create flow.

#### Scenario: New room creates initial user grants
- **WHEN** the client creates a room with initial users `auth:alice` and `session:jj`
- **THEN** the room persists canonical participant membership for those actors
- **AND** the control plane issues real room grants for those actors with the requested roles

#### Scenario: New room auto-focuses selected users
- **WHEN** a room is created with an initial user marked as focused
- **THEN** that user's focused-room state includes the new room immediately
- **AND** the operator does not need a second follow-up focus mutation to make the room visible to that user

### Requirement: Unselected avatars SHALL NOT receive room access or attention

Shared room truth MAY emit global message/focus events, but runtime wakeups SHALL stay actor-scoped. An avatar that was not selected into a newly created room must not gain room access, room focus, or queued room attention from that create flow.

#### Scenario: Unselected avatar stays outside the room
- **WHEN** the client creates a room with initial users containing `auth:jane` but not `session:jj`
- **THEN** `session:jj` has no active room grant for that room
- **AND** `session:jj` does not gain focused-room membership for that room
- **AND** queued room messages do not become loop inputs for the `session:jj` runtime

### Requirement: Global room ids SHALL be opaque by default

Global room identifiers SHALL be generated from an opaque token by default instead of user-authored room titles.

#### Scenario: New room id does not leak the room title
- **WHEN** the client creates a room titled `Jokes`
- **THEN** the returned room id is not derived from the literal title string
- **AND** callers still MAY override `chatId` explicitly for tests or admin workflows
