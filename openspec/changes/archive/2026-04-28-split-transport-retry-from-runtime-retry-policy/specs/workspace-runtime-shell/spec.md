## ADDED Requirements

### Requirement: Runtime Settings SHALL own durable recovery policy while Heartbeat quick config stays execution-scoped

The runtime shell SHALL keep Heartbeat quick config limited to next-call execution knobs, while durable recovery policy and provider transport retry editing SHALL live in the runtime Settings surface.

#### Scenario: Operator edits durable recovery policy from Settings

- **WHEN** the operator needs to change retry progression, backoff law, or provider transport retry behavior
- **THEN** the runtime Settings surface is the canonical editing entry
- **AND** the Heartbeat quick config does not expose those durable policy controls

#### Scenario: Heartbeat quick config remains scoped to next-call execution knobs

- **WHEN** the operator opens Heartbeat quick config after the retry-policy upgrade
- **THEN** the surface still only edits next-call execution knobs such as sampling or thinking settings
- **AND** it does not absorb durable recovery-policy responsibilities

### Requirement: Runtime Settings SHALL group durable runtime configuration by responsibility

The runtime Settings surface SHALL group durable runtime configuration into responsibility-based sections so provider transport, compact policy, retry policy, and prompt/locale settings are no longer mixed into one flat editing flow.

#### Scenario: Durable runtime settings open with sectioned ownership

- **WHEN** the operator opens the runtime Settings surface
- **THEN** the surface presents durable runtime configuration through clear responsibility-based sections
- **AND** the operator can distinguish provider transport settings from runtime retry policy without relying on implementation details
