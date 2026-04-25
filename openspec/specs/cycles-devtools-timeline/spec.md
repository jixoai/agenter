# cycles-devtools-timeline Specification

## Purpose
Define the cycle-oriented Devtools timeline contract for technical session inspection.

## Requirements

### Requirement: Devtools SHALL expose a live cycle timeline
The WebUI SHALL expose the cycle-oriented Devtools surface as a live timeline that summarizes cycle state, timing, and model/tool activity while the session is running, but that surface MUST keep its typography, density, and color hierarchy visually subordinate to the main Chat route.

#### Scenario: Active cycle appears in the live timeline
- **WHEN** the active session begins, collects, streams, or applies a cycle
- **THEN** the Devtools cycle timeline shows that cycle with live status updates
- **THEN** the user does not need to reload the panel to observe the latest cycle state

#### Scenario: Cycle timeline stays visually compact
- **WHEN** the user opens Devtools after using the conversation-first Chat route
- **THEN** the cycle timeline uses compact typography and restrained color emphasis
- **THEN** it reads as an expert inspection surface instead of competing with the Chat transcript

#### Scenario: Compact cycles are visually distinct special rounds
- **WHEN** the timeline renders a cycle whose kind is `compact`
- **THEN** that row uses a distinct icon or color treatment from normal rounds
- **AND** the user can identify compact cycles directly from navigation without opening the detail pane

### Requirement: Cycle detail SHALL mount richer inspection on selection
The cycle timeline SHALL keep the list compact and mount richer cycle detail only for the selected cycle.

#### Scenario: Selecting a cycle opens detailed inspection
- **WHEN** the user selects a cycle from the timeline
- **THEN** the Devtools surface shows the related collected inputs, outputs, and model/tool summaries for that cycle in the detail region
- **THEN** the non-selected timeline rows remain lightweight

### Requirement: Long cycle history SHALL remain navigable
The Devtools cycle timeline SHALL remain operable for long-running sessions by virtualizing the timeline list, incrementally loading older pages, and preserving stable selection behavior.

#### Scenario: Large cycle history keeps the panel responsive
- **WHEN** the session contains many historical cycles
- **THEN** the cycle timeline virtualizes the list instead of mounting every row at once
- **THEN** selection and scrolling remain responsive

#### Scenario: Older cycle pages preserve selection context
- **WHEN** the user prepends older cycle history while inspecting a selected cycle
- **THEN** the current selection remains stable
- **THEN** the newly prepended rows do not reset the detail panel

### Requirement: Cycle detail SHALL separate bridge hook outcomes from delivery receipts
The Devtools cycle detail surface SHALL expose attention hook outcomes and attention delivery receipts as separate inspection sections so operators can distinguish system-bridge behavior from AI delivery truth.

#### Scenario: Selected cycle shows both hook outcomes and receipt history
- **WHEN** the operator selects a cycle that committed or dispatched attention-backed work
- **THEN** the detail surface shows hook outcomes in one section
- **AND** it shows delivery receipts in a separate section keyed by commit or attempt identity

#### Scenario: Receipt failure is visible even when hooks succeeded
- **WHEN** commit or dispatch hooks succeed but the first observable provider outcome is an error
- **THEN** the hook-outcome section still shows successful bridge work
- **AND** the delivery-receipt section shows the failed delivery attempt explicitly

### Requirement: Cycle detail SHALL expose delivery attempt progression for retried work
The Devtools cycle detail surface SHALL preserve delivery attempt history for retried attention-backed work instead of collapsing all attempts into one generic cycle outcome.

#### Scenario: Retried commit shows multiple delivery attempts
- **WHEN** one attention commit is retried across more than one cycle or model attempt
- **THEN** the Devtools detail surface shows each delivery attempt and its receipts separately
- **AND** operators can inspect which attempt first accepted or failed
