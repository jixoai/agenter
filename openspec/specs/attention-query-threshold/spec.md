## Purpose

Define the default filtering semantics for attention queries.
## Requirements
### Requirement: Attention query SHALL exclude inactive rows by default
Attention queries SHALL apply `minScore = 1` by default against each item's score vector and related-item traversal unless the caller explicitly requests a lower threshold.

#### Scenario: Default query hides all-zero items
- **WHEN** a caller invokes `attention_query` without `minScore`
- **THEN** items whose score entries are all `0` are excluded from the result
- **THEN** related-item traversal also omits those resolved items unless the caller explicitly lowers the threshold

#### Scenario: Explicitly query inactive items
- **WHEN** a caller invokes `attention_query` with `minScore = 0`
- **THEN** items with all scores at `0` may be returned
- **THEN** the result still respects the requested limit, traversal depth, and filters

