## ADDED Requirements

### Requirement: Runtime wait SHALL compose subscribed ingress handles with attention debt timers
When the runtime has no immediately runnable cycle, the scheduler SHALL wait through a `waitUntil(...)`-style composition over subscribed ingress handles and explicit timing handles instead of polling every subsystem. At minimum this composed wait SHALL include unread message subscriptions, terminal waits, task/event waits, and any explicit attention-debt or backoff wake timers.

#### Scenario: Unread subscription wakes an otherwise idle loop
- **GIVEN** the runtime has no currently selected work and no active external input batch
- **AND** the scheduler is waiting on a composed unread subscription handle
- **WHEN** a subscribed message unread change arrives
- **THEN** the composed wait resolves with a message unread wake cause
- **THEN** the next loop round starts from one new unread summary read instead of periodic polling

#### Scenario: Attention debt timer remains a valid wake cause alongside subscriptions
- **GIVEN** the runtime still has unresolved attention debt
- **AND** unread, terminal, and task subscriptions remain quiet
- **WHEN** the attention-debt timer or backoff timer expires first
- **THEN** the composed wait resolves with that timer wake cause
- **THEN** unresolved attention can still self-drive later work even without new external unread changes

#### Scenario: Losing waiters are cancelled after one wake cause wins
- **GIVEN** the scheduler is waiting on multiple subscribed ingress handles plus one timing handle
- **WHEN** one handle resolves first
- **THEN** the runtime cancels the losing waiters before the next round begins
- **THEN** later wake-ups do not leak stale listeners from prior wait cycles
