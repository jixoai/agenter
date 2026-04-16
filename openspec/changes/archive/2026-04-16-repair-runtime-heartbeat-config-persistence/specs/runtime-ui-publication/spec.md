## MODIFIED Requirements

### Requirement: Runtime clients SHALL expose next-call config edits as grouped Heartbeat facts

Heartbeat operators SHALL be able to change next-call model knobs from the Heartbeat surface without rewriting the current streaming call.

#### Scenario: Saving config shows a pending grouped fact immediately

- **WHEN** the operator saves new `temperature`, `top-k`, `max tokens`, or `thinking` settings from the Heartbeat surface
- **AND** the active runtime is scoped to avatar-level durable settings
- **THEN** the save lands in the avatar settings layer instead of mutating `ai.providers.*`
- **AND** runtime knobs persist under top-level `ai.temperature`, `ai.topK`, `ai.maxToken`, and `ai.thinking`
- **THEN** the grouped Heartbeat query exposes a trailing `before-call-pending` group immediately
- **AND** that group contains the durable `request_aux:config:*` fact that was just written
- **AND** the currently streaming call, if any, keeps rendering with its original config snapshot
