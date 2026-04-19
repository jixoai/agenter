## MODIFIED Requirements

### Requirement: Anchored virtual list scroll SHALL expose a named trigger/query/controller model

The shared anchored virtual list scroll contract SHALL expose a public controller model built around named triggers, named query subtrees, and program-scoped transactions. Programs SHALL read trigger facts through `query.<name>.*`, and only the installed program controller SHALL expose `tx(...)` as the side-effect surface.

#### Scenario: A trigger subtree is accessed through a registered name

- **WHEN** a trigger is connected with a name such as `edge` or `transportDelta`
- **THEN** its facts are exposed as `query.edge.*` or `query.transportDelta.*`
- **AND** feature code does not read a hard-coded global `query.atLatest` or dispatch kind-specific events

#### Scenario: One flush runs one program evaluation

- **WHEN** multiple observer or event facts change during the same microtask or animation frame
- **THEN** the controller coalesces them into one program evaluation
- **AND** the installed program executes at most one matching `switch(true)` branch for that flush

### Requirement: Anchored virtual list scroll SHALL keep tx as the only side-effect surface

The installed program controller SHALL expose `tx(...)` as the only public side-effect surface for semantic scroll behavior. Feature code, Storybook harnesses, and route code SHALL NOT perform semantic scroll ownership through `scrollTop`, manual request dispatch, or naked viewport writes.

#### Scenario: A return-to-latest action resolves through tx

- **WHEN** the operator activates a `Scroll to latest` affordance
- **THEN** the installed program starts a `tx(...)` that owns the semantic scroll request
- **AND** the feature does not directly write `scrollTop` for that semantic action

#### Scenario: User input interrupts a low-priority tx

- **WHEN** a background append-follow or prepend-reveal tx is active
- **AND** the user begins wheel, touch, or keyboard scrolling
- **THEN** the tx is interrupted according to its interruption policy
- **AND** viewport ownership returns to user input without a second competing writer

## ADDED Requirements

### Requirement: Anchored virtual list scroll SHALL provide named trigger families for browser facts and high-order scroll semantics

The shared package SHALL provide base triggers that map directly to browser capabilities and high-order triggers that express WebChat-like scroll semantics on top of those capabilities.

#### Scenario: Base trigger families expose browser-native facts

- **WHEN** engineers use visibility, resize, action, or user-input triggers
- **THEN** the query subtree exposes only that family's facts such as `visible`, `entered`, `resized`, `fired`, or `active`
- **AND** those facts are not flattened into one shared trigger state object

#### Scenario: High-order triggers expose anchored list semantics

- **WHEN** engineers use edge, overflow, collection-delta, materialization, or insert-batch triggers
- **THEN** the query subtree exposes anchored-list facts such as `atLatest`, `overflowing`, `direction`, `materialized`, or `extentPx`
- **AND** those semantics are reusable across WebChat, Heartbeat, and Storybook capability labs

### Requirement: Anchored virtual list scroll SHALL keep edge facts transient and stable facts durable

Trigger edge facts such as `entered`, `exited`, `fired`, and `changed` SHALL be valid only for the current flush cycle, while durable facts such as `atLatest`, `active`, or `overflowing` SHALL persist across flushes.

#### Scenario: Edge facts clear after the program cycle

- **WHEN** a trigger emits `fired`, `entered`, `exited`, or `changed`
- **THEN** the installed program can react to those facts during the current flush
- **AND** those edge facts clear before the next idle query snapshot is read
