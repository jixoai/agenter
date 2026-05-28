# message-contact-read-state Specification

## Purpose
Define Contact-scoped unread aggregates and unread wait handles that let runtimes react to room work without rescanning room history.

## Requirements

### Requirement: Message-system SHALL persist Contact unread state separately from message rows
Message-system SHALL maintain durable Contact-global unread state and Contact-room unread state instead of inferring unread work by scanning room messages for AI scheduling fields.

#### Scenario: New room message materializes Contact unread aggregates
- **WHEN** a room message is sent to a tracked Contact who is eligible for that message's unread obligation
- **THEN** message-system increments that Contact's global unread total
- **THEN** message-system increments that Contact's unread count for the affected room
- **THEN** the room-state record stores the latest unread row and timestamp for later selection

#### Scenario: Joined-later Contact does not receive retroactive unread aggregates
- **WHEN** Contact `C` joins a room after older messages already exist
- **THEN** Contact `C`'s room unread state starts from the first later eligible message
- **THEN** older messages do not inflate `C`'s unread counters merely because `C` joined later

### Requirement: Message-system SHALL expose Contact unread subscriptions as cancellable wait handles
Message-system SHALL provide Contact-scoped unread subscriptions and wait handles so runtimes can sleep until unread state changes without rescanning room history.

#### Scenario: Zero-unread Contact wakes on the next unread change
- **GIVEN** Contact `A` currently has unread total `0`
- **AND** a runtime is waiting on `A`'s unread subscription handle
- **WHEN** a newly sent room message creates unread work for `A`
- **THEN** the wait handle resolves
- **THEN** the next unread summary read exposes the affected room and unread count

#### Scenario: Cancelling an unread wait stops future wake-ups
- **GIVEN** a runtime subscribed to actor `A`'s unread wait handle
- **WHEN** that wait is cancelled before the next unread mutation
- **THEN** later unread changes do not resolve the cancelled wait handle

### Requirement: Room access revocation SHALL clear Contact unread aggregates without rewriting frozen message history
When a Contact loses room access, message-system SHALL remove active unread obligations for that Contact from Contact-room and Contact-global unread state, but SHALL NOT rewrite the frozen `readContactIds` / `unreadContactIds` stored on older messages.

#### Scenario: Revoked room access clears unread counters immediately
- **WHEN** Contact `A` is revoked from room `R` while `R` still contains unread obligations for `A`
- **THEN** `A`'s unread count for `R` becomes `0`
- **THEN** `A`'s global unread total is reduced by the same amount
- **THEN** future unread room selection no longer returns `R` for `A`

#### Scenario: Revocation does not rewrite old frozen unread arrays
- **WHEN** Contact `A` loses access to room `R` after older messages already froze `A` inside `unreadContactIds`
- **THEN** those older message rows keep their original frozen membership
- **THEN** only Contact unread aggregates and future obligations are cleared
