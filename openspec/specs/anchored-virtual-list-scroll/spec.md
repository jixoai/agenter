# anchored-virtual-list-scroll Specification

## Purpose
Define the shared semantic scroll runtime for bottom-anchored, virtualized transcript surfaces such as WebChat and Heartbeat.

## Requirements
### Requirement: Anchored virtual list scroll SHALL expose semantic targets and intents
The shared anchored virtual list scroll contract SHALL define scroll requests in terms of semantic targets and intents rather than raw viewport offsets. The public target model SHALL be limited to `edge`, `element`, and `position`, and the public intent model SHALL support seeking, revealing, pinning, and stabilization.

#### Scenario: Seeking the latest edge does not require raw offset math
- **WHEN** a consumer requests `seek` against the `latest` edge of an anchored virtual list
- **THEN** the coordinator resolves that request without requiring feature code to write viewport offsets directly
- **AND** the target model remains expressed as `edge`, `element`, or `position` instead of business-specific row kinds

#### Scenario: Revealing an element honors if-needed semantics
- **WHEN** a consumer requests `reveal` against an element target with `scrollMode = "if-needed"`
- **THEN** the coordinator only scrolls if the target does not already satisfy the reveal contract
- **AND** it does not force a new alignment when the target is already sufficiently visible

#### Scenario: Position targets remain available for reconciliation
- **WHEN** a host must stabilize a viewport after virtualized mutation and element semantics are insufficient
- **THEN** the host may resolve the request as a `position` target
- **AND** the public contract still avoids exposing raw `scrollTop` writes to feature code

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

#### Scenario: Reconcile traffic does not override active direct manipulation
- **WHEN** the user is actively manipulating the viewport
- **AND** a reconcile-driven stabilization request is raised for append, prepend, resize, or collapse
- **THEN** the reconcile request does not seize scroll ownership immediately
- **AND** the coordinator defers, merges, or drops that request according to transaction priority rules

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

### Requirement: Anchored virtual list scroll SHALL separate public targets from virtualization materialization
The anchored virtual list scroll contract SHALL keep virtualization-specific target materialization inside the host adapter. The public API SHALL NOT require first-class virtual-row target kinds.

#### Scenario: A virtualized target is materialized before the final seek
- **WHEN** a consumer requests an element target that is not yet mounted because the list is virtualized
- **THEN** the host may materialize that target or a temporary anchor element before resolution completes
- **AND** the public request still remains an `element` or `edge` target rather than a virtual-row identifier

#### Scenario: Host resolution can degrade to a position target
- **WHEN** a host cannot safely materialize an element target in time for stabilization
- **THEN** the host may resolve that request as a `position` target
- **AND** the consumer does not need to change the public request model to accommodate virtualization internals

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

### Requirement: Anchored virtual list scroll SHALL expose platform-aligned state and lifecycle signals
The shared anchored virtual list scroll contract SHALL expose state snapshots and lifecycle signals using platform-aligned terminology, including current scroll target, eventual scroll position, phase, edge state, user input state, scroll end, and settle completion.

#### Scenario: State snapshots report the active target and eventual position
- **WHEN** a programmatic scroll transaction is in progress
- **THEN** the state snapshot reports the current scroll target
- **AND** the state snapshot reports the eventual scroll position expected after the transaction settles

#### Scenario: User input state distinguishes major Web input paths
- **WHEN** the viewport receives direct manipulation, wheel, keyboard, or momentum-driven scrolling
- **THEN** the state snapshot distinguishes those input paths in user-input state
- **AND** desktop and touch clients can reason about interruption without inventing private route-local flags

#### Scenario: Scroll end and settle remain distinct lifecycle boundaries
- **WHEN** a programmatic scroll visually finishes before observer, layout, or virtualizer state has fully converged
- **THEN** `awaitScrollEnd` may resolve before `awaitSettle`
- **AND** the consumer can wait for the stronger settle boundary when mutation stabilization requires it

### Requirement: Anchored virtual list scroll SHALL preserve native browser scroll transport
The shared anchored virtual list scroll contract SHALL preserve native browser scrolling, including native scrollbars, as the baseline transport. The first public contract SHALL distinguish direct manipulation, wheel, keyboard, and momentum input without requiring a custom scrollbar implementation or a scrollbar-specific public target model.

#### Scenario: Native scrollbars remain valid input transport
- **WHEN** a user scrolls an anchored virtual list through the browser's native scrollbar
- **THEN** the list remains governed by the shared anchored virtual list scroll contract
- **AND** the implementation does not require a custom scrollbar component to preserve programmatic scroll arbitration

#### Scenario: Hosts may fold scrollbar-thumb drag into direct manipulation
- **WHEN** a particular host can detect native or custom scrollbar-thumb drag with confidence
- **THEN** that host may classify the interaction as direct manipulation for arbitration purposes
- **AND** the shared public contract still does not require a dedicated scrollbar-drag input kind

### Requirement: Storybook SHALL be a first-class acceptance surface for anchored scroll choreography and ownership conflicts
The shared anchored virtual list scroll contract SHALL ship Storybook capability labs and Storybook DOM tests that make append-follow-latest, prepend-reveal-nearest-older, and ownership-conflict resolution inspectable and regression-testable without relying on route-local math or private browser-evidence harnesses.

#### Scenario: Near-latest append can be manually triggered and verified in Storybook
- **WHEN** an operator uses the Storybook capability lab to append a latest row while already near the latest edge
- **THEN** the surface exposes the resulting anchor-preserve and follow-latest behavior through one shared Storybook surface
- **AND** Storybook DOM tests can assert the expected semantic state without custom route fixtures

#### Scenario: Near-start prepend can be manually triggered and verified in Storybook
- **WHEN** an operator uses the Storybook capability lab to prepend older rows while near the history start
- **THEN** the surface exposes the automatic reveal of the nearest inserted older row
- **AND** Storybook DOM tests can verify the choreography and the absence of residual jitter

#### Scenario: Append race is reproducible and regression-tested in Storybook
- **WHEN** a Storybook capability lab appends latest rows while the viewport is near the latest edge
- **THEN** the test surface can detect stale intermediate jumps such as landing on an older row before the newest row
- **AND** DOM contracts can assert that the runtime finishes through one coherent ownership path

#### Scenario: Storybook interruption contracts cover the main user-input families
- **WHEN** Storybook drives explicit seek, append-follow, and prepend-reveal flows through the shared capability lab
- **AND** those flows are interrupted by keyboard, wheel, or direct-manipulation input
- **THEN** the visible state surface records the interrupted terminal state
- **AND** the viewport stays under user ownership instead of resuming a second programmatic writer
