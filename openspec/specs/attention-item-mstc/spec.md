# attention-item-mstc Specification

## Purpose
TBD - created by archiving change attention-multi-context-mstc. Update Purpose after archive.
## Requirements
### Requirement: Attention items SHALL use the M+S+T+C structure
Each attention item SHALL carry Meta (extensible metadata), Scores (multi-hash score map), Title (surface summary), and an optional Context (internal detail).

#### Scenario: Adding an item with multi-hash scores
- **WHEN** a caller adds an attention item with `scores: { hash1: 100, hash2: 50 }`
- **THEN** the item is stored with both score entries preserved
- **THEN** the item is assigned a unique string ID and an ISO creation timestamp

#### Scenario: Item title is the surface communication
- **WHEN** a caller adds an item with `title: "在吗？"` and `context: "kzf想问gaubee中午吃什么"`
- **THEN** `title` represents the human-facing message
- **THEN** `context` represents the internal reasoning detail

### Requirement: Attention contexts SHALL determine active items from non-zero scores
An attention item SHALL be considered active when any value in its Scores map is greater than zero.

#### Scenario: Item with all scores zero is inactive
- **WHEN** an item has `scores: { hash1: 0, hash2: 0 }`
- **THEN** `getActive()` does not include this item

#### Scenario: Item with at least one non-zero score is active
- **WHEN** an item has `scores: { hash1: 0, hash2: 50 }`
- **THEN** `getActive()` includes this item

### Requirement: Score adjustments SHALL target items by hash key
Adjusting a score for a given hash SHALL update all items in the context whose Scores map contains that hash key.

#### Scenario: Adjusting a hash score across multiple items
- **GIVEN** item A with `scores: { hash1: 100 }` and item B with `scores: { hash1: 80, hash2: 50 }`
- **WHEN** `adjustScores({ hash1: 0 })` is called
- **THEN** item A becomes `scores: { hash1: 0 }` and item B becomes `scores: { hash1: 0, hash2: 50 }`
- **THEN** item B remains active (hash2 > 0) while item A becomes inactive

#### Scenario: Adjusting a non-existent hash is a no-op
- **GIVEN** item A with `scores: { hash1: 100 }`
- **WHEN** `adjustScores({ hash_unknown: 0 })` is called
- **THEN** item A is not modified

### Requirement: Relationship queries SHALL trace hash links across items
Items sharing the same hash key in their Scores map form a relationship chain. Depth-based queries SHALL recursively discover related items.

#### Scenario: Direct hash query returns all items containing that hash
- **GIVEN** item A with `scores: { hash1: 100 }` and item B with `scores: { hash1: 50, hash2: 100 }`
- **WHEN** `queryByHash("hash1")` is called
- **THEN** both item A and item B are returned

#### Scenario: Depth query discovers transitive relationships
- **GIVEN** item A with `scores: { hash1: 100 }`, item B with `scores: { hash1: 50, hash2: 100 }`, and item C with `scores: { hash2: 30 }`
- **WHEN** `queryRelated("hash1", depth=2)` is called
- **THEN** items A, B, and C are all returned
- **THEN** item C is discovered through hash2 which appears in item B

#### Scenario: Depth-1 query returns only direct matches
- **GIVEN** item A with `scores: { hash1: 100 }`, item B with `scores: { hash1: 50, hash2: 100 }`, item C with `scores: { hash2: 30 }`
- **WHEN** `queryRelated("hash1", depth=1)` is called
- **THEN** items A and B are returned
- **THEN** item C is NOT returned (requires depth >= 2)

### Requirement: Context changes SHALL notify subscribers
Adding items or adjusting scores SHALL trigger onChange listeners with the affected item.

#### Scenario: Subscriber receives notification on item add
- **GIVEN** a subscriber registered via `onChange(listener)`
- **WHEN** a new item is added
- **THEN** the listener is called with the new item

#### Scenario: Subscriber receives notification on score adjustment
- **GIVEN** a subscriber registered via `onChange(listener)` and an existing item with `scores: { hash1: 100 }`
- **WHEN** `adjustScores({ hash1: 0 })` is called
- **THEN** the listener is called with the updated item

