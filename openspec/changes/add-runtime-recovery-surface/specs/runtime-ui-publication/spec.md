## ADDED Requirements

### Requirement: Runtime publication SHALL expose recovery diagnostics and manual retry control

The runtime publication and control plane SHALL expose the recovery diagnostics needed for operator intervention, and it SHALL accept a manual retry request without requiring durable settings edits or lifecycle restarts.

#### Scenario: Recovery diagnostics are visible without trace reconstruction

- **WHEN** a session runtime enters `error`, `backoff`, or `blocked`
- **THEN** subscribed runtime UI consumers receive objective recovery diagnostics including the latest error detail plus containment metadata such as retry count, blocked reason, and next wake timing when available
- **AND** the operator does not need to reconstruct those facts from raw trace rows

#### Scenario: Manual retry becomes an explicit runtime control action

- **WHEN** a runtime UI consumer submits a manual retry request for a session that is not already running
- **THEN** the runtime control plane accepts that request as an explicit recovery wake cause
- **AND** the request does not mutate durable provider or settings configuration just to trigger the retry
