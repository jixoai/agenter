## ADDED Requirements

### Requirement: Provider retry settings SHALL remain transport-only

Canonical provider settings SHALL treat retry metadata as transport-only request behavior, and runtime scheduler recovery SHALL NOT inherit its policy from provider transport retry settings.

#### Scenario: Per-request transport retry stays inside the model client

- **WHEN** canonical provider settings define transport retry metadata for a provider
- **THEN** the model client uses that metadata only for per-request transport retry behavior
- **AND** the provider contract does not become the source of truth for session-level backoff or blocked-state law

#### Scenario: Runtime recovery ignores provider transport retry counts

- **WHEN** the runtime scheduler computes recovery delay, blocked/backoff transitions, or retry progression
- **THEN** it uses the resolved runtime retry policy instead of provider transport retry metadata
- **AND** changing provider transport retry does not silently rewrite session recovery policy
