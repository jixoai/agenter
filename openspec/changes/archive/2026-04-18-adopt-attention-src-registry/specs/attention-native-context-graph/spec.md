## MODIFIED Requirements

### Requirement: Attention commits SHALL separate provenance from egress intent
Attention commits SHALL keep provenance metadata and egress intent as separate durable fields. Provenance metadata is a closed, durable description of origin; egress intent is a typed routing contract for external adapters. Protocol-native source identity SHALL be stored as `src` instead of the shared `systemId` / `subjectId` / `channelId` tuple.

#### Scenario: Provenance remains stable while routing evolves
- **WHEN** a commit is persisted with origin facts plus message reply intent
- **THEN** its provenance metadata records origin fields such as author, source, and protocol-native `src`
- **AND** a source such as `msg:13` or `msg:13/155` remains durable without reconstructing legacy tuple fields
- **AND** its reply routing survives in a typed egress field instead of being merged into metadata
