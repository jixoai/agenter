## MODIFIED Requirements

### Requirement: Mark-read SHALL move actor ids between frozen message arrays
Message-system SHALL advance room read-state by moving actor ids from `unreadActorIds` to `readActorIds` on the addressed visible message and earlier visible messages, instead of recomputing history from mutable seat cursors. The same durable mark-read mutation SHALL also update actor-global unread totals and actor-room unread counters from the affected message range.

#### Scenario: Read progress advances without changing frozen membership
- **WHEN** a room user reads up to message `m3`
- **THEN** that user's actor id moves from unread to read on `m3` and earlier visible messages
- **THEN** later room membership changes do not alter the already-frozen arrays on those messages

#### Scenario: Mark-read shrinks actor unread aggregates from the same mutation
- **WHEN** actor `A` marks room `R` read through visible message `m3`
- **THEN** `A`'s room unread counter for `R` is reduced to exclude `m3` and earlier visible unread messages
- **THEN** `A`'s global unread total is reduced by the same number
- **THEN** the unread aggregate update does not require rescanning unrelated rooms

## ADDED Requirements

### Requirement: Joined-later actors SHALL remain excluded from retroactive unread obligations while still being allowed to appear as readers
Message-system SHALL keep joined-later actors excluded from retroactive unread obligations on older messages, but an explicit later mark-read MAY append those actors to `readActorIds` on previously visible history without rewriting frozen `unreadActorIds`.

#### Scenario: Joined-later actor does not inherit old unread debt
- **WHEN** actor `C` joins after message `m1` was sent
- **THEN** `m1` does not contribute to `C`'s unread room counter
- **THEN** `m1` remains outside `C`'s retroactive unread obligation set

#### Scenario: Joined-later actor can later become a historical reader
- **WHEN** actor `C` later opens old history containing `m1` and marks that history read
- **THEN** `C` MAY be appended to `m1.readActorIds`
- **THEN** `m1.unreadActorIds` remains frozen to the original send-time membership
