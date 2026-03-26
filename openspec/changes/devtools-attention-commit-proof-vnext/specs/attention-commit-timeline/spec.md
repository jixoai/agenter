## ADDED Requirements

### Requirement: Cycle detail exposes produced commits and hook outcomes
Cycle detail MUST show the commits produced by the cycle and any hook outcomes attached to those commits.

#### Scenario: Cycle detail proves whether a reply was sent
- **GIVEN** a cycle that produces a commit in a chat-bound context
- **WHEN** the message hook sends a chat message
- **THEN** the cycle detail shows the produced commit
- **AND** it shows a delivered message hook result for that commit.
