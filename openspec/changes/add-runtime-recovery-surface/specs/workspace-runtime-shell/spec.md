## ADDED Requirements

### Requirement: Heartbeat quick config SHALL stay execution-scoped while recovery stays separate

The runtime shell SHALL keep the Heartbeat quick config limited to next-call execution knobs, and it SHALL expose recovery diagnostics and actions through a separate recovery surface instead of overloading the quick-config dialog or durable Settings surfaces.

#### Scenario: Quick config only edits next-call execution knobs

- **WHEN** the operator opens Heartbeat quick config
- **THEN** the editable controls remain limited to execution-scoped knobs such as `temperature`, `top-k`, `max tokens`, and `thinking`
- **AND** recovery controls or durable retry-strategy fields do not appear inside that quick-config flow

#### Scenario: Recovery surface appears when containment needs intervention

- **WHEN** the runtime is `blocked`, `backoff`, or has a latest runtime error that needs operator attention
- **THEN** the runtime shell exposes a dedicated recovery surface with the latest error, retry state, and next wake timing
- **AND** the operator can trigger `Retry now` without leaving the runtime shell
