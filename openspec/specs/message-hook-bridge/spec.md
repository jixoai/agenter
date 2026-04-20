# message-hook-bridge Specification

## Purpose
TBD - created by archiving change message-hook-attention-bridge-vnext. Update Purpose after archive.
## Requirements
### Requirement: Message hook bridge SHALL keep attention summaries internal
The runtime MUST NOT turn attention summaries into visible room transcript rows through an automatic bridge. If a model wants to change room-visible truth, it SHALL do so with an explicit message-system mutation instead of relying on a summary hook side effect.

#### Scenario: Attention summary no longer auto-sends into the room
- **WHEN** an avatar-authored attention commit stores a non-empty summary for a room-backed context
- **THEN** the summary remains visible only through attention or runtime inspection
- **AND** no automatic room message is created from that summary alone

#### Scenario: Room-visible correction requires an explicit message mutation
- **WHEN** the assistant needs to answer, edit, or withdraw a visible room fact after internal reasoning
- **THEN** it uses `message send`, `message edit`, or `message recall`
- **AND** the removed hook bridge is not treated as an alternate delivery path
