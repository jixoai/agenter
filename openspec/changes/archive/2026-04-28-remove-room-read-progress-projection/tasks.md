## 1. Contracts

- [x] 1.1 Update room read specs to delete public `room progress` and define message rows as the only read truth
- [x] 1.2 Rename room-level `readStates` contracts to `seatStates` across shared types and public projections

## 2. Runtime And Data Flow

- [x] 2.1 Remove `readProgress` and latest-visible read flags from `message-system` projections and runtime-facing channel payloads
- [x] 2.2 Stop client/runtime reconciliation from writing latest-visible room summary data back into room snapshots

## 3. Room Surfaces

- [x] 3.1 Rework room-route mark-read replay and ack floors to derive from snapshot message rows only
- [x] 3.2 Remove room-level read summary badges from message-system management and related preview/story surfaces

## 4. Verification

- [x] 4.1 Update cross-package tests that still assert `readProgress` or latest-visible seat flags
- [x] 4.2 Add a regression that proves dispatching a real AI call makes the selected room messages observably read through message-level truth
