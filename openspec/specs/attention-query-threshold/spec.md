## Purpose

Define the default filtering semantics for attention queries.

## Requirements

### Requirement: Attention query SHALL exclude inactive rows by default
Attention queries SHALL apply `minScore = 1` unless the caller explicitly requests a lower threshold.

#### Scenario: Default query hides score zero items
- **WHEN** a caller invokes `attention_query` without `minScore`
- **THEN** records with `score = 0` are excluded from the result

#### Scenario: Explicitly query inactive items
- **WHEN** a caller invokes `attention_query` with `minScore = 0`
- **THEN** records with `score = 0` may be returned
- **THEN** the result still respects the requested limit and offset
