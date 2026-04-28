## MODIFIED Requirements

### Requirement: Attention commits SHALL separate provenance from visible system mutations
Attention commits SHALL keep provenance metadata as a closed, durable description of origin while keeping AI-visible content in summary and body/change fields. Visible effects in other systems SHALL be performed through explicit system mutations, not hidden routing fields on the attention commit. Protocol-native source identity SHALL be stored as `src` instead of the shared `systemId` / `subjectId` / `channelId` tuple.

#### Scenario: Provenance remains stable while visible routing stays explicit
- **WHEN** a commit is persisted with origin facts for a room-backed obligation
- **THEN** its provenance metadata records origin fields such as author, source, and protocol-native `src`
- **AND** a source such as `msg:13` or `msg:13/155` remains durable without reconstructing legacy tuple fields
- **AND** any later room-visible reply or correction happens through explicit message-system mutations instead of a routing field on the commit
