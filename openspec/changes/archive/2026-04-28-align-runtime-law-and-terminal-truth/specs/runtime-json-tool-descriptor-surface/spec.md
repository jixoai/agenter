## MODIFIED Requirements

### Requirement: Descriptor-backed message tools SHALL expose ref-aware revision workflow
Descriptor-backed message tools SHALL expose the reply-reference contract and the post-send revision workflow explicitly. `message send` SHALL accept optional same-room `ref`, `message read` SHALL return direct referenced room messages as sidecar context, and help or skill guidance SHALL describe when the caller must reread room context before edit or recall.

#### Scenario: Message send help teaches post-send revision workflow
- **WHEN** the runtime renders `message send --help`
- **THEN** the generated help explains that successful send returns `recentMessages`
- **AND** it instructs the caller to inspect recent room context with `message read` before using `message edit` or `message recall` on a suspected accidental duplicate

#### Scenario: Message read help exposes referencedItems
- **WHEN** the runtime renders `message read --help`
- **THEN** the generated help states that direct referenced room messages are returned as `referencedItems`
- **AND** the help does not describe those references as runtime cycle anchors

#### Scenario: Attention commit help omits hidden room routing schema
- **WHEN** the runtime renders `attention commit --help`
- **THEN** the generated schema omits any hidden room-message routing field
- **AND** room-visible behavior is directed through message tools instead
