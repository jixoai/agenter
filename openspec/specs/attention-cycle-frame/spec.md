# attention-cycle-frame Specification

## Purpose
TBD - created by archiving change attention-kernel-runtime-vnext. Update Purpose after archive.
## Requirements
### Requirement: Cycle frames SHALL persist attention-native references
Each persisted cycle frame SHALL record input refs, selected working item refs, produced item refs, linked model-call refs, and linked egress refs instead of flattened `inputs / facts / reply` payloads.

#### Scenario: Persist a cycle frame from committed attention
- **WHEN** the runtime starts work after committed attention changes
- **THEN** it persists a cycle frame linked to the relevant context and item references
- **THEN** the frame stores references to downstream model calls and egress records instead of duplicating large text blobs

#### Scenario: A cycle frame keeps cross-context provenance
- **WHEN** one cycle consumes attention from multiple contexts
- **THEN** the persisted frame keeps the per-context item references intact
- **THEN** later inspectors can reconstruct which context contributed each part of the work

### Requirement: Cycle frames SHALL preserve effect outcomes for later inspection
Cycle frames SHALL retain the recorded outcome of each dispatched side effect so runtime teardown does not erase the causal history of a handled item.

#### Scenario: Successful message delivery is recorded on the frame
- **WHEN** a cycle dispatches a reply into a chat channel successfully
- **THEN** the frame records the linked message egress result and channel identity
- **THEN** later inspection can prove why that reply became visible in Chat

#### Scenario: Failed dispatch remains inspectable after runtime stop
- **WHEN** a cycle dispatch fails and the runtime later stops or aborts
- **THEN** the frame still retains the failed egress record and linked item refs
- **THEN** technical inspection does not depend on the live runtime remaining active

