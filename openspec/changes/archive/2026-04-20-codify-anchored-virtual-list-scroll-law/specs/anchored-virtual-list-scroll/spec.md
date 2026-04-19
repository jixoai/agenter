## ADDED Requirements

### Requirement: Anchored virtual list scroll SHALL expose semantic targets and intents

The system SHALL define one shared scroll contract for WebChat-like anchored virtual lists that models scroll requests in terms of semantic targets and intents rather than raw viewport offsets. The public target model SHALL be limited to `edge`, `element`, and `position`, and the public intent model SHALL support seeking, revealing, pinning, and stabilization.

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

The shared anchored virtual list scroll contract SHALL treat programmatic scrolling as transactions with explicit source, priority, interruption policy, and completion state. At most one scroll transaction SHALL own the viewport at a time.

#### Scenario: User wheel input interrupts a low-priority reveal

- **WHEN** a low-priority programmatic reveal transaction is active
- **AND** the user starts wheel scrolling the same viewport
- **THEN** the active transaction is interrupted or cancelled according to its interruption policy
- **AND** the viewport ownership transfers to user input

#### Scenario: Reconcile traffic does not override active direct manipulation

- **WHEN** the user is actively manipulating the viewport
- **AND** a reconcile-driven stabilization request is raised for append, prepend, resize, or collapse
- **THEN** the reconcile request does not seize scroll ownership immediately
- **AND** the coordinator defers, merges, or drops that request according to transaction priority rules

#### Scenario: A newer higher-priority request supersedes an older programmatic transaction

- **WHEN** a second programmatic request with higher priority targets the same viewport
- **THEN** the coordinator supersedes the older active transaction
- **AND** the older transaction reports `superseded` as its terminal state

### Requirement: Anchored virtual list scroll SHALL expose closure-based transactions with transaction-owned suspension points

The shared anchored virtual list scroll contract SHALL let callers orchestrate mutation and scroll choreography through a closure-based transaction surface. The closure MAY suspend, but only through transaction-owned await points such as commit, settle, or semantic scroll helpers. If the transaction loses viewport ownership or otherwise aborts while suspended, the runtime SHALL terminate the closure by throwing.

#### Scenario: A staged append transaction can await commit before following latest

- **WHEN** a caller starts a closure-based transaction, appends a latest row, and awaits the transaction-owned commit boundary
- **THEN** the caller can schedule a semantic follow-to-latest step after commit without manually wiring route-local callbacks
- **AND** the follow-up scroll still participates in the same transaction ownership model

#### Scenario: User input aborts a suspended transaction by throwing

- **WHEN** a closure-based transaction is suspended at a transaction-owned await point
- **AND** wheel, touch, keyboard, or higher-priority programmatic input aborts that transaction
- **THEN** the awaiting transaction step throws instead of silently continuing against stale assumptions
- **AND** feature code can handle the abort like any other structured control-flow interruption

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

### Requirement: Storybook SHALL be a first-class acceptance surface for anchored mutation choreography

The shared anchored virtual list scroll contract SHALL ship Storybook capability labs and Storybook DOM tests that make append-follow-latest and prepend-reveal-nearest-older choreography inspectable and regression-testable without relying on route-local math or an external browser-evidence harness.

#### Scenario: Near-latest append can be manually triggered and verified in Storybook

- **WHEN** an operator uses the Storybook capability lab to append a latest row while already near the latest edge
- **THEN** the surface exposes the resulting anchor-preserve and follow-latest behavior through one shared Storybook surface
- **AND** Storybook DOM tests can assert the expected semantic state without custom route fixtures

#### Scenario: Near-start prepend can be manually triggered and verified in Storybook

- **WHEN** an operator uses the Storybook capability lab to prepend older rows while near the history start
- **THEN** the surface exposes the automatic reveal of the nearest inserted older row
- **AND** Storybook DOM tests can verify the choreography and the absence of residual jitter
