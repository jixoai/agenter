## ADDED Requirements

### Requirement: Terminal lifecycle coordination SHALL be scheduler-only

Runtime terminal focus, unfocus, and idle-ready coordination SHALL be treated as scheduler signals or UI invalidations. They MUST NOT be committed as task facts or obligation text in model-visible attention content.

#### Scenario: Focus event does not create attention task
- **WHEN** a terminal becomes focused for a session actor
- **THEN** runtime updates terminal focus projection and scheduling state
- **AND** it does not commit a `terminal_focus` task fact into model-visible attention

#### Scenario: Unfocus event does not create attention task
- **WHEN** a terminal becomes unfocused for a session actor
- **THEN** runtime updates terminal focus projection and scheduling state
- **AND** it does not commit a `terminal_unfocus` task fact into model-visible attention

#### Scenario: Idle-ready event wakes without instruction
- **WHEN** a running terminal changes from busy to idle
- **THEN** runtime may wake or rank the loop through scheduler state
- **AND** it does not inject text such as `Terminal <id> is ready for your input` as task truth

### Requirement: Terminal model facts SHALL be objective observations or explicit action results

Terminal content eligible for model reasoning SHALL be limited to objective snapshots, diffs, bounded await evidence, durable process facts, or explicit command/action results.

#### Scenario: Snapshot remains a model fact
- **WHEN** terminal screen content changes and runtime records a snapshot or diff
- **THEN** that observation may become model-visible terminal fact content
- **AND** it is not mixed with focus/unfocus scheduler lifecycle text

#### Scenario: Command result remains an effect fact
- **WHEN** the model executes a terminal or shell command through an explicit action
- **THEN** runtime records the command result as an explicit action result
- **AND** any follow-up scheduling is separate from the result content

### Requirement: Preferred terminal strategies MAY remain guidance

Recommended terminal strategies such as await-first workflows, bounded reads, or compact observation patterns MAY remain in terminal guidance, but they SHALL stay non-binding and SHALL NOT be rewritten as runtime-authored lifecycle obligations.

#### Scenario: Strategy guidance does not become lifecycle command
- **WHEN** terminal guidance recommends a preferred strategy such as await-before-read
- **THEN** the recommendation may shape the model's command choice as a soft field
- **AND** runtime does not convert that preference into a hidden `ready for your input` instruction or other lifecycle obligation
