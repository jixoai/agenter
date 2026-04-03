## MODIFIED Requirements

### Requirement: Terminal activity SHALL render tool lifecycle entries via the shared invocation card
Tool lifecycle rows in terminal activity SHALL use structured invocation metadata from persisted runtime records, using `channel: tool` as the canonical source.

#### Scenario: Terminal tool activity renders directly from invocation payload
- **WHEN** a terminal activity row contains tool lifecycle data
- **THEN** terminal activity renders one invocation card from the row's structured tool metadata
- **THEN** lifecycle status includes `waiting/running/success/failed/cancelled` without markdown parsing

#### Scenario: Terminal activity keeps a visible human title
- **WHEN** the tool lifecycle metadata provides a human-readable title such as `Terminal read`
- **THEN** the invocation card shows that human title as visible primary copy
- **THEN** the raw tool id remains available as secondary technical metadata instead of replacing the primary title
