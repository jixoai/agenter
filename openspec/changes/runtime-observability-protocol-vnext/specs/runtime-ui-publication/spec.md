## MODIFIED Requirements

### Requirement: Runtime clients SHALL publish scoped UI updates
The runtime client SHALL expose subscription primitives that let WebUI surfaces observe narrow runtime slices, including renamed scheduler and observability slices, so hot updates from one session do not force unrelated application surfaces to rerender.

#### Scenario: Active route tabs subscribe only to active heavy slices
- **WHEN** a route contains multiple heavy inspection tabs backed by different runtime slices
- **THEN** the active tab subscribes only to the slices needed for its visible panel, including scheduler and observability resources
- **THEN** inactive tabs do not receive fresh selected values for unrelated hot slices

## ADDED Requirements

### Requirement: WebUI SHALL consume runtime observability without orphan debug side channels
The WebUI SHALL inspect runtime transport and observability state through the runtime publication contract itself and SHALL not require a standalone model-debug side channel.

#### Scenario: Devtools opens transport inspection without model-debug
- **WHEN** the user opens Devtools transport or observability inspection
- **THEN** the UI reads published model-call, API-call, scheduler, and runtime-trace resources
- **THEN** it does not query a `modelDebug` endpoint to reconstruct the same facts
