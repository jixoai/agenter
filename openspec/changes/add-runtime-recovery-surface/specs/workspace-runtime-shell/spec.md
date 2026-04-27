## ADDED Requirements

### Requirement: Runtime shell SHALL separate execution config, durable policy, and live recovery

The runtime shell SHALL keep the Heartbeat quick config limited to next-call execution knobs, SHALL keep durable retry/compact policy editing in Runtime Settings, and SHALL expose live recovery diagnostics and actions through a separate recovery surface instead of overloading either config surface.

#### Scenario: Quick config only edits next-call execution knobs

- **WHEN** the operator opens Heartbeat quick config
- **THEN** the editable controls remain limited to execution-scoped knobs such as `temperature`, `top-k`, `max tokens`, and `thinking`
- **AND** recovery controls or durable retry-strategy fields do not appear inside that quick-config flow

#### Scenario: Runtime Settings remains the durable policy owner

- **WHEN** the operator needs to change retry progression, backoff law, provider transport retry, or compact triggers
- **THEN** the runtime shell directs that edit to Runtime Settings
- **AND** the live recovery surface does not write durable retry or compact policy fields

#### Scenario: Recovery surface appears when containment needs intervention

- **WHEN** the runtime is `blocked`, `backoff`, or has a latest runtime error that needs operator attention
- **THEN** the runtime shell exposes a dedicated recovery surface with the latest error, policy-resolved retry state, and next wake timing
- **AND** the operator can trigger `Retry now` without leaving the runtime shell
