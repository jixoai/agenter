## ADDED Requirements

### Requirement: Heartbeat footer context SHALL reset across compact boundaries while using the shared ai-elements surface

The `Heartbeat` footer SHALL render context usage through the shared ai-elements `Context` composition, and it SHALL treat a newest `compact` call as a hard boundary that resets visible usage facts instead of reusing the previous non-compact model call.

#### Scenario: Compact resets visible footer context usage

- **WHEN** the newest model call for a Heartbeat footer is `kind: compact`
- **THEN** the footer context becomes unavailable for the new prompt window
- **AND** it does not keep presenting the token usage from the prior non-compact call as current context truth

#### Scenario: Unavailable context still uses the shared trigger contract

- **WHEN** provider metadata is incomplete or the newest call is compact
- **THEN** the footer still renders the shared ai-elements Context trigger structure
- **AND** the trigger is disabled or visually unavailable instead of falling back to a bespoke local badge block

### Requirement: Heartbeat stage SHALL stay shrinkable while its inner conversation owns scroll

The Heartbeat route stage SHALL stay shrinkable inside the shared runtime shell so the inner conversation viewport remains the only transcript scroll owner.

#### Scenario: Inner transcript scroll does not force the stage to expand past the shell body

- **WHEN** the Heartbeat tab mounts a virtualized conversation surface inside the runtime body
- **THEN** the stage itself remains shrinkable within the shared workbench body
- **AND** the transcript scroll ownership stays inside the inner conversation viewport instead of escaping to an outer route wrapper
