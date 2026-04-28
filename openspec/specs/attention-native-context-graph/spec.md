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

### Requirement: Attention commits SHALL separate provenance from visible system mutations

Attention commits SHALL keep provenance metadata as a closed, durable description of origin while keeping AI-visible content in summary and body/change fields. Visible effects in other systems SHALL be performed through explicit system mutations, not hidden routing fields on the attention commit. Protocol-native source identity SHALL be stored as `src` instead of the shared `systemId` / `subjectId` / `channelId` tuple.

#### Scenario: Provenance remains stable while visible routing stays explicit
- **WHEN** a commit is persisted with origin facts for a room-backed obligation
- **THEN** its provenance metadata records origin fields such as author, source, and protocol-native `src`
- **AND** a source such as `msg:13` or `msg:13/155` remains durable without reconstructing legacy tuple fields
- **AND** any later room-visible reply or correction happens through explicit message-system mutations instead of a routing field on the commit
