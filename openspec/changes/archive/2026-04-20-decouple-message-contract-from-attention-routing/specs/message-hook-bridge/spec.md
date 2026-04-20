## REMOVED Requirements

### Requirement: Message hook extracts human-readable summaries

**Reason**: Visible room messages must become explicit message-system actions rather than a side effect of attention commits. Keeping the summary hook would continue the existing “internal thought can secretly become chat output” coupling.

**Migration**: Replace automatic hook-driven room output with explicit `message send`, `message edit`, or `message recall` calls. Attention commits remain internal and can still describe obligations, but they no longer create visible room transcript rows by themselves.

## ADDED Requirements

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
