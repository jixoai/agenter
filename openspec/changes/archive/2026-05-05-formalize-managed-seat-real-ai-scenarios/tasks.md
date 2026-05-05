## 1. Scenario Contract

- [x] 1.1 Add the new `real-ai-managed-seat-validation` spec and align any managed-seat validation docs with its scenario-catalog law
- [x] 1.2 Define the scenario entry shape around `setup`, `objective`, `invariants`, `success`, and `failureEvidence`
- [x] 1.3 Make the shared-room precondition explicit so managed-seat validation does not silently absorb contact or discovery scope

## 2. Harness Integration

- [x] 2.1 Teach managed-seat validation harnesses to consume situation briefs instead of command-prescriptive prompt scripts
- [x] 2.2 Add durable evaluators for seat state, descriptor validity, room transport facts, and shared terminal truth
- [x] 2.3 Add same-instance room-routed collaboration coverage using the new scenario contract

## 3. Lifecycle and Topology Coverage

- [x] 3.1 Add scenarios for unilateral post-accept `config`, repeated invite rotation, revoke, and expiry invalidation
- [x] 3.2 Add a management-capable handoff scenario that preserves resource-native current-admin semantics
- [x] 3.3 Add dual-agenter cross-instance collaboration coverage where room transport and terminal authority live on different processes

## 4. Evidence and Guidance

- [x] 4.1 Emit failure evidence for transcript, seat timeline, descriptor form, terminal observations, and port or process ownership
- [x] 4.2 Document the non-overfitting prompt law so future scenario authors do not hard-code today's CLI spellings into the contract
