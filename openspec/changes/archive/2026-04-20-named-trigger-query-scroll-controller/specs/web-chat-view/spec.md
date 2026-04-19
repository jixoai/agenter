## MODIFIED Requirements

### Requirement: Web chat view SHALL drive transcript scrolling through named triggers and an installed program

The shared chat component SHALL wire transcript scrolling through the shared named trigger/query/controller runtime. Return-to-latest, transport append follow, older-page reveal, insert-batch affordances, and user-input interruption SHALL be driven through named trigger facts and a shared installed program rather than feature-local imperative request calls.

#### Scenario: Return-to-latest is an action trigger, not a direct request call

- **WHEN** the operator activates the transcript's `Scroll to latest` affordance
- **THEN** the chat surface raises an action trigger that the installed scroll program consumes
- **AND** the feature code does not directly call the old request surface for that action

#### Scenario: Transport append while pinned follows latest through the installed program

- **WHEN** newer room messages arrive while the transcript is effectively at latest
- **THEN** the named trigger program follows latest through the shared tx runtime
- **AND** the transcript does not rely on route-local `scrollTop` bookkeeping

#### Scenario: Older-page reveal is triggered from named query facts

- **WHEN** older history is prepended while the operator is near history start
- **THEN** the installed program derives reveal behavior from named query facts such as collection delta and edge state
- **AND** the component does not keep a second feature-local scroll ownership path
