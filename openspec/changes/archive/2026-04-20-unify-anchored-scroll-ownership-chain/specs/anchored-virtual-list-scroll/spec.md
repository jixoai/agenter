## MODIFIED Requirements

### Requirement: Anchored virtual list scroll SHALL model programmatic scrolling as transactions

The shared anchored virtual list scroll contract SHALL treat programmatic scrolling as transactions with explicit source, priority, interruption policy, and completion state. For any anchored virtual list viewport, the runtime SHALL permit exactly one effective terminal scroll writer at a time. Transaction middleware, host adapters, and consumer code MAY publish mutation facts, targets, and plans, but they SHALL NOT issue out-of-band viewport writes alongside the active terminal writer.

#### Scenario: One mutation batch resolves through one terminal writer

- **WHEN** append, prepend, resize, collapse, or insert-motion facts are raised for the same viewport during one transaction
- **THEN** the runtime resolves them through one ownership chain
- **AND** only one terminal writer issues the resulting browser scroll command

#### Scenario: User wheel input interrupts a low-priority reveal

- **WHEN** a low-priority programmatic reveal transaction is active
- **AND** the user starts wheel scrolling the same viewport
- **THEN** the active transaction is interrupted or cancelled according to its interruption policy
- **AND** the viewport ownership transfers to user input without a second programmatic writer continuing in parallel

#### Scenario: A newer higher-priority request supersedes an older programmatic transaction

- **WHEN** a second programmatic request with higher priority targets the same viewport
- **THEN** the runtime supersedes the older active transaction
- **AND** the older transaction reports `superseded` as its terminal state instead of racing the newer transaction with another viewport write

### Requirement: Anchored virtual list scroll SHALL expose closure-based transactions with transaction-owned suspension points

The shared anchored virtual list scroll contract SHALL let callers orchestrate mutation and scroll choreography through a closure-based transaction surface. The transaction runtime SHALL support ownership-chain composition, where shared programs can handle the transaction or delegate through `next()`. The closure MAY suspend only through transaction-owned await points such as commit, settle, or semantic scroll helpers. If the transaction loses viewport ownership or otherwise aborts while suspended, the runtime SHALL terminate the suspended flow by throwing.

#### Scenario: Shared middleware can delegate transaction ownership

- **WHEN** a shared ownership program receives a transaction and calls `await next()`
- **THEN** downstream ownership programs continue the same transaction context
- **AND** upstream code does not regain permission to issue a second terminal viewport write after delegation

#### Scenario: A staged append transaction can await commit before following latest

- **WHEN** a caller starts a closure-based transaction, appends a latest row, and awaits the transaction-owned commit boundary
- **THEN** the caller can schedule a semantic follow-to-latest step after commit without manually wiring route-local callbacks
- **AND** that follow-up step still resolves through the same ownership chain and terminal writer

#### Scenario: User input aborts a suspended transaction by throwing

- **WHEN** a closure-based transaction is suspended at a transaction-owned await point
- **AND** wheel, touch, keyboard, or higher-priority programmatic input aborts that transaction
- **THEN** the awaiting transaction step throws instead of silently continuing against stale assumptions
- **AND** feature code can handle the abort like any other structured control-flow interruption

## ADDED Requirements

### Requirement: Anchored virtual list hosts SHALL publish scroll facts instead of writing the viewport directly

Timeline layers, insert-motion controllers, and host adapters SHALL contribute mutation facts, measurements, and target materialization to the active transaction, but they SHALL NOT directly mutate the viewport outside the shared anchored scroll runtime.

#### Scenario: Insert-motion compensation is expressed as transaction facts

- **WHEN** the timeline detects a latest or older insert-motion batch and measures the inserted elements
- **THEN** it publishes those measurements to the active transaction
- **AND** it does not directly call `scrollTo`, `scrollTop`, or an equivalent viewport mutation from the render layer

#### Scenario: Host materialization remains separate from viewport ownership

- **WHEN** a host adapter materializes a virtualized target or temporary anchor element
- **THEN** the host contributes that target to the active transaction
- **AND** the final viewport movement still occurs only through the runtime's terminal writer

### Requirement: Storybook SHALL be a first-class acceptance surface for ownership conflicts

The shared anchored virtual list scroll contract SHALL ship Storybook capability labs and Storybook DOM tests that reproduce ownership conflicts and prove that one mutation batch resolves through one ownership chain without stale intermediate jumps.

#### Scenario: Append race is reproducible and regression-tested in Storybook

- **WHEN** a Storybook capability lab appends latest rows while the viewport is near the latest edge
- **THEN** the test surface can detect stale intermediate jumps such as landing on an older row before the newest row
- **AND** DOM contracts can assert that the runtime finishes through one coherent ownership path

#### Scenario: Prepend reveal remains inspectable without private route fixtures

- **WHEN** a Storybook capability lab prepends older rows near the history start
- **THEN** the resulting reveal behavior is inspectable through the shared capability lab
- **AND** the acceptance surface does not depend on route-local scroll instrumentation

#### Scenario: Storybook interruption contracts cover the main user-input families

- **WHEN** Storybook drives explicit seek, append-follow, and prepend-reveal flows through the shared capability lab
- **AND** those flows are interrupted by keyboard, wheel, or direct-manipulation input
- **THEN** the visible state surface records the interrupted terminal state
- **AND** the viewport stays under user ownership instead of resuming a second programmatic writer
