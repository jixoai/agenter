## ADDED Requirements

### Requirement: Room metadata SHALL distinguish direct rooms from public rooms
The message control plane SHALL represent both direct and public conversations as `kind: "room"` channels, while room metadata SHALL explicitly encode whether the room is `direct` or `public`.

#### Scenario: Direct room persists metadata without changing room kind
- **WHEN** the system creates a paired direct-room conversation for two contacts
- **THEN** each local channel is persisted as `kind: "room"`
- **THEN** each local channel metadata includes `roomMode: "direct"`

### Requirement: Direct rooms SHALL remain strict one-to-one rooms
The message control plane SHALL enforce direct rooms as strict one-to-one rooms between exactly two durable participants. A direct room SHALL NOT be expanded in place into a multi-party room.

#### Scenario: Direct room cannot gain a third participant in place
- **WHEN** an operator or runtime attempts to invite a third actor into an existing direct room
- **THEN** the existing direct room remains one-to-one
- **THEN** the system rejects in-place expansion of that direct room

### Requirement: Inviting from a direct room SHALL branch into a new public room
If a user flow starts from a direct room and asks to invite an additional participant, the control plane SHALL create a new `public` room and attach the requested participants there instead of reusing the direct room.

#### Scenario: Third-party invite from direct room creates public room
- **WHEN** actor `A` and actor `B` already share direct room `D`
- **AND** `A` invites actor `C` from that direct-room context
- **THEN** the system creates a new room `P`
- **THEN** `P` metadata includes `roomMode: "public"`
- **THEN** `D` remains the original one-to-one room between `A` and `B`

### Requirement: Paired direct-room bootstrap SHALL preserve two local durable histories
When a contact acceptance bootstraps a direct conversation, each source SHALL persist its own local room and its own durable transcript while storing enough pairing metadata to continue syncing direct-room messages with the remote side.

#### Scenario: Two sources keep independent room durability for one direct conversation
- **WHEN** actor `A` on source `SA` and actor `B` on source `SB` bootstrap a direct-room conversation
- **THEN** source `SA` persists its local direct room and transcript
- **THEN** source `SB` persists its local direct room and transcript
- **THEN** later direct-room message sync appends to both local durable histories instead of treating one side as the only room of record
