## ADDED Requirements

### Requirement: Message descriptors SHALL expose explicit reference-aware room context

Descriptor-backed message tools SHALL expose the reply-reference contract and the post-send revision workflow explicitly. `message send` SHALL accept optional same-room `ref`, `message read` SHALL return direct referenced room messages as sidecar context, and help/skill guidance SHALL describe when the caller must reread room context before edit/recall.

#### Scenario: Message send help teaches post-send revision workflow

- **WHEN** the AI runs `message send --help`
- **THEN** the help text explains that the command returns recent room summaries after send
- **AND** it instructs the caller to inspect recent room context with `message read` before using `message edit` or `message recall` on a suspected accidental duplicate

#### Scenario: Message read returns one-hop referenced room context

- **WHEN** the AI runs `message read` for a room window containing messages with direct `ref` links
- **THEN** the result includes the requested timeline `items`
- **AND** it includes a separate `referencedItems` collection for the direct referenced room messages needed to understand that window's context

#### Scenario: Built-in message skill teaches revision-aware room behavior

- **WHEN** the runtime renders the built-in message skill
- **THEN** the guidance describes send, edit, and recall as explicit room actions
- **AND** it teaches the caller to use `message read` when room context or direct refs may change the revision decision

### Requirement: Attention commit descriptor SHALL not expose room-message routing fields

The descriptor-backed `attention commit` command SHALL keep attention payloads internal. Its public schema and generated help MUST NOT expose room-message routing fields such as `message_reply`, `chatId`, or room-level reply-reference routing.

#### Scenario: Attention commit help omits room egress schema

- **WHEN** the AI runs `attention commit --help`
- **THEN** the generated schema omits any room-message egress field
- **AND** the help no longer suggests that attention commit itself can send a visible room reply
