Define the native attention graph kernel used by LoopBus and external systems.

## ADDED Requirements

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

### Requirement: Attention meta SHALL carry routing intent
Attention item metadata SHALL be able to describe the source system and optional reply target used by output adapters.

#### Scenario: Reply target survives persistence
- **WHEN** an item is appended with reply-target metadata
- **THEN** a persisted snapshot keeps that metadata intact
- **THEN** a later runtime can route the item without rebuilding side tables
