# attention-native-context-graph Specification

## Purpose
TBD - created by archiving change attention-native-context-graph. Update Purpose after archive.
## Requirements
### Requirement: Attention SHALL model context evolution as graph-native items
Each attention item SHALL support lineage through `parentIds`, structured detail payloads, and multi-hash scoring.

#### Scenario: Fork and merge preserve lineage
- **WHEN** one item forks into two follow-up items and a later item merges both branches
- **THEN** the merged item records both parent ids
- **THEN** callers can recover the lineage without consulting an external relation table

### Requirement: Attention queries SHALL return active items by default
Native attention queries SHALL exclude zero-score items unless callers explicitly request a minimum score of zero.

#### Scenario: Default query hides resolved items
- **WHEN** an item only contains scores equal to zero
- **THEN** `query` and `getActive` omit that item by default
- **THEN** the same item is returned when `minScore = 0`

### Requirement: Attention commits SHALL separate provenance from egress intent
Attention commits SHALL keep provenance metadata and egress intent as separate durable fields. Provenance metadata is a closed, durable description of origin; egress intent is a typed routing contract for external adapters. Protocol-native source identity SHALL be stored as `src` instead of the shared `systemId` / `subjectId` / `channelId` tuple.

#### Scenario: Provenance remains stable while routing evolves
- **WHEN** a commit is persisted with origin facts plus message reply intent
- **THEN** its provenance metadata records origin fields such as author, source, and protocol-native `src`
- **AND** a source such as `msg:13` or `msg:13/155` remains durable without reconstructing legacy tuple fields
- **AND** its reply routing survives in a typed egress field instead of being merged into metadata

