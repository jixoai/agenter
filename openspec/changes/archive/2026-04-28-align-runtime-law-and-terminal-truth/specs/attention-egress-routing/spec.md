## MODIFIED Requirements

### Requirement: Attention commits SHALL remain internal unless a later explicit mutation targets another system
Committed attention items SHALL remain internal attention facts. The public attention commit schema MUST NOT expose room-message routing fields, and attention persistence alone MUST NOT create or revise a visible room transcript row.

#### Scenario: Attention commit without message mutation stays out of room transcript
- **WHEN** the runtime persists or updates an attention commit
- **THEN** no visible room message is created from that commit alone
- **THEN** operators inspect that work through attention views rather than through synthetic chat rows

#### Scenario: Room debugging reads attention instead of message anchors
- **WHEN** an engineer needs to understand why the assistant repeated or reprocessed work
- **THEN** the system exposes that causal trail through attention history and related runtime traces
- **AND** the room message schema does not need a hidden runtime anchor field to support that investigation
