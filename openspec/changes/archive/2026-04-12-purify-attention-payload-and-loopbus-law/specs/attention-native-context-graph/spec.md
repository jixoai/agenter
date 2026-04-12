## Requirements

### Requirement: Attention commits SHALL separate provenance from egress intent
Attention commits SHALL keep provenance metadata and egress intent as separate durable fields. Provenance metadata is a closed, durable description of origin; egress intent is a typed routing contract for external adapters.

#### Scenario: Provenance remains stable while routing evolves
- **WHEN** a commit is persisted with origin facts plus message reply intent
- **THEN** its provenance metadata records only origin fields such as author/source/systemId/subjectId/channelId
- **AND** its reply routing survives in a typed egress field instead of being merged into metadata
