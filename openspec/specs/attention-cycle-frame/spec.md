# attention-cycle-frame Specification

## Purpose
TBD - created by archiving change attention-kernel-runtime-vnext. Update Purpose after archive.
## Requirements

### Requirement: Cycle frames SHALL persist attention-native references

Each persisted cycle frame SHALL record input refs, selected working item refs, produced item refs, linked model-call refs, hook refs, and delivery dispatch/receipt refs instead of flattened `inputs / facts / reply` payloads or legacy egress refs.

#### Scenario: Persist a cycle frame from committed attention
- **WHEN** the runtime starts work after committed attention changes
- **THEN** it persists a cycle frame linked to the relevant context and item references
- **THEN** the frame stores references to downstream model calls, hook records, and delivery records instead of duplicating large text blobs or linked egress records

#### Scenario: A cycle frame keeps cross-context provenance
- **WHEN** one cycle consumes attention from multiple contexts
- **THEN** the persisted frame keeps the per-context item references intact
- **THEN** later inspectors can reconstruct which context contributed each part of the work

### Requirement: Cycle frames SHALL preserve effect outcomes for later inspection

Cycle frames SHALL preserve causal references needed to inspect model-call delivery attempts, hook outcomes, and explicit system mutations so runtime teardown does not erase the causal history of handled work.

#### Scenario: Message delivery is inspected through explicit mutation and delivery facts
- **WHEN** a cycle results in a visible room reply
- **THEN** later inspection can relate the cycle to the relevant model call and explicit message mutation
- **THEN** the frame does not need a legacy message egress record to prove why that reply became visible in Chat

#### Scenario: Failed dispatch remains inspectable after runtime stop
- **WHEN** a cycle dispatch fails and the runtime later stops or aborts
- **THEN** the delivery dispatch and receipt records remain inspectable with linked item refs
- **THEN** technical inspection does not depend on the live runtime remaining active
