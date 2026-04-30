## ADDED Requirements

### Requirement: Built-in runtime skills SHALL teach explicit action and query laws

Built-in runtime skills SHALL describe how the model can query projections and perform explicit actions. They MAY also teach domain etiquette, defaults, and recommended playbooks as non-binding guidance. They MUST NOT encode platform-authored social obligations, automatic acknowledgement expectations, or source-specific completion labels that the runtime no longer emits.

#### Scenario: Message skill omits platform reply labels
- **WHEN** the generated runtime skill catalog includes `agenter-message`
- **THEN** its body does not mention `self_update`, `no_external_reply_needed`, `room_reply_pending`, `required_room_reply_sent`, `chatTurnState`, `chatObligationKind`, or `settlesWhen`
- **AND** it describes room replies as explicit `message send`, `message edit`, or `message recall` actions

#### Scenario: Message skill may teach etiquette as optional guidance
- **WHEN** the generated runtime skill catalog includes `agenter-message`
- **THEN** it may teach acknowledgement patterns, room etiquette, or relay playbooks as optional guidance
- **AND** it does not claim that runtime has already decided a reply is required or has already sent one

#### Scenario: Message skill describes room projection queries
- **WHEN** `agenter-message` explains participants, presence, or visible rooms
- **THEN** it presents them as queryable room projections
- **AND** it does not instruct the model that missing participants or relay targets are decided by eager prompt metadata

#### Scenario: Terminal skill separates observation from scheduling
- **WHEN** the generated runtime skill catalog includes terminal guidance
- **THEN** it teaches terminal snapshots, diffs, await evidence, and explicit command results as facts
- **AND** it does not teach focus or idle lifecycle events as task obligations

#### Scenario: Terminal skill may recommend preferred strategies
- **WHEN** the generated runtime skill catalog includes terminal guidance
- **THEN** it may recommend preferred strategies such as await-first workflows or bounded observation patterns as non-binding guidance
- **AND** it does not describe those recommendations as runtime-authored commands or hidden obligations

### Requirement: Runtime skill catalog generation SHALL fail on removed pollution terms

Catalog generation or tests SHALL guard against reintroducing removed platform-pollution terms into generated built-in runtime skill bodies.

#### Scenario: Removed terms fail catalog tests
- **WHEN** tests inspect the generated runtime skill catalog
- **THEN** they fail if removed social-obligation terms or auto-ACK instructions appear in message guidance

#### Scenario: Source edits regenerate clean catalog
- **WHEN** a package-owned built-in skill source is edited
- **THEN** generated catalog output matches the source
- **AND** the pollution-term guard still passes
