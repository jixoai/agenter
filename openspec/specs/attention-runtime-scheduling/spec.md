# attention-runtime-scheduling Specification

## Purpose
TBD - created by archiving change attention-context-commit-kernel-vnext. Update Purpose after archive.
## Requirements
### Requirement: Loop scheduling is context-first
The runtime MUST consider a context active when its `scoreMap` contains at least one score greater than zero. `focused` and `background` contexts SHALL keep that unresolved debt eligible for later wake-up, while `muted` contexts SHALL suppress default score-driven wake-up unless a notification-class push or another explicit ingress overrides the mute.

#### Scenario: Non-zero focused or background scores keep the loop alive
- **GIVEN** no new external input arrives
- **AND** at least one attention context still has a score greater than zero
- **AND** that context focus state is `focused` or `background`
- **WHEN** the scheduler evaluates whether to wake the loop
- **THEN** it wakes again for attention debt.

#### Scenario: Zeroed contexts stay idle
- **GIVEN** every attention context score is zero
- **WHEN** no new external input arrives
- **THEN** the scheduler remains idle.

#### Scenario: Muted unresolved debt stays dormant until explicit override
- **GIVEN** an attention context remains unresolved but its focus state is `muted`
- **WHEN** no new external input or notification-class push arrives
- **THEN** the scheduler does not wake solely because that muted score remains non-zero

#### Scenario: Notification-class push overrides muted default
- **GIVEN** an attention context is `muted`
- **WHEN** a notification-class push with unresolved score is committed into that context
- **THEN** the scheduler treats that ingress as a valid wake cause
- **AND** the next loop round is allowed to process the forced notification without changing the context to `focused`

### Requirement: Runtime wait SHALL compose subscribed ingress handles with attention debt timers
When the runtime has no immediately runnable cycle, the scheduler SHALL wait through a `waitUntil(...)`-style composition over subscribed ingress handles and explicit timing handles instead of polling every subsystem. At minimum this composed wait SHALL include unread message subscriptions, terminal waits, task/event waits, and any explicit attention-debt or backoff wake timers.

#### Scenario: Unread subscription wakes an otherwise idle loop
- **GIVEN** the runtime has no currently selected work and no active external input batch
- **AND** the scheduler is waiting on a composed unread subscription handle
- **WHEN** a subscribed message unread change arrives
- **THEN** the composed wait resolves with a message unread wake cause
- **THEN** the next loop round starts from one new unread summary read instead of periodic polling

#### Scenario: Attention debt timer remains a valid wake cause alongside subscriptions
- **GIVEN** the runtime still has unresolved `focused` or `background` attention debt
- **AND** unread, terminal, and task subscriptions remain quiet
- **WHEN** the attention-debt timer or backoff timer expires first
- **THEN** the composed wait resolves with that timer wake cause
- **THEN** unresolved attention can still self-drive later work even without new external unread changes

#### Scenario: Losing waiters are cancelled after one wake cause wins
- **GIVEN** the scheduler is waiting on multiple subscribed ingress handles plus one timing handle
- **WHEN** one handle resolves first
- **THEN** the runtime cancels the losing waiters before the next round begins
- **THEN** later wake-ups do not leak stale listeners from prior wait cycles
