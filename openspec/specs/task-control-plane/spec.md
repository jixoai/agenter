# task-control-plane Specification

## Purpose

Define the task-system contract as a durable obligation ledger that composes with message and terminal execution surfaces.

## Requirements

### Requirement: Task system SHALL define durable obligation semantics through skills and attention

The task system SHALL express long-lived obligation state through durable task facts and task-shaped attention items, and the owning task skill guidance SHALL describe tasks as a durable obligation ledger. That guidance SHALL distinguish task state from user-visible replies and from execution surfaces such as terminal or message channels.

#### Scenario: Task skill keeps task state separate from user replies

- **WHEN** the assistant needs to remember long-lived work, blockers, dependencies, or triggers
- **THEN** the task skill directs it to use task tools for durable obligation state
- **AND** task writes are not treated as a user-visible answer

#### Scenario: Task skill composes task with execution and communication systems

- **WHEN** work needs durable tracking plus execution or communication
- **THEN** the task skill reminds the assistant that tasks track obligations while terminal executes and message coordinates
- **AND** the assistant can leave a task pending while continuing unrelated work
