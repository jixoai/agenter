## ADDED Requirements

### Requirement: Attention commit hooks return observable results
Every successful `attention_commit` MUST return the results of any committed hooks that ran for that commit.

#### Scenario: Hook results are returned to the model
- **WHEN** an attention commit triggers one or more hooks
- **THEN** the `attention_commit` tool result includes each hook outcome with system id, status, and any failure details.
