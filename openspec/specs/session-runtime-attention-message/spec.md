# session-runtime-attention-message Specification

## Purpose
TBD - created by archiving change session-runtime-attention-message-migration. Update Purpose after archive.
## Requirements
### Requirement: Session runtime SHALL route chat through attention and message adapters
Session runtime SHALL ingest chat-channel inputs into attention and route reply items back into message-system through adapters.

#### Scenario: Attention reply is delivered through message-system
- **WHEN** a committed attention item targets a chat channel reply
- **THEN** session runtime dispatches it through `messageSystem.reply`
- **THEN** the chat surface only receives message-system output, not raw attention facts

### Requirement: Stop and abort SHALL have different runtime scopes
The runtime SHALL distinguish between stopping LoopBus work and destroying runtime-owned systems.

#### Scenario: Stop preserves channel state
- **WHEN** stop is invoked during an active session
- **THEN** the current model call is aborted and LoopBus stops
- **THEN** terminal and message control planes remain available

#### Scenario: Abort destroys runtime-owned systems
- **WHEN** abort is invoked
- **THEN** stop semantics happen first
- **THEN** terminal and message control planes are torn down for that runtime

