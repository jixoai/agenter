# real-ai-managed-seat-validation Specification

## Purpose
Define the durable managed-seat validation contract for realistic collaboration archetypes, non-overfitting actor briefs, and diagnosable backend or real-AI evidence.

## Requirements

### Requirement: Managed-seat validation scenarios SHALL be structured situation briefs

The platform SHALL represent managed-seat validation as structured scenarios that separate topology facts, actor goals, evaluator invariants, and failure evidence. Each scenario SHALL define `setup`, `objective`, `invariants`, `success`, and `failureEvidence`. Actor-facing instructions SHALL describe the situation and available resources, but SHALL NOT require one exact CLI spelling, canned transcript, or hard-coded action order when equivalent lawful behavior exists.

#### Scenario: Equivalent lawful client behavior still passes

- **WHEN** a participant reaches the required acceptance and collaboration outcome through a lawful client path that differs from the originally authored example wording
- **THEN** the scenario still passes if the durable seat, room, and terminal invariants hold
- **AND** the evaluator does not fail solely because the participant used different but equivalent commands or phrasing

#### Scenario: Scenario structure remains separate from resource grammar

- **WHEN** a managed-seat scenario includes terminal authority `RW` and room authority `member`
- **THEN** those values are recorded as setup truth using each resource's native grammar
- **AND** the scenario does not rename them into one fake universal permission taxonomy

### Requirement: Managed-seat validation catalog SHALL cover realistic collaboration archetypes

The managed-seat validation catalog SHALL cover realistic collaboration and lifecycle flows that can happen after two principals already share a room. At minimum the catalog SHALL include pair debugging, temporary takeover for a fix, teaching walkthrough, room-routed invitation delivery, unilateral post-accept config, revoke-or-expiry invalidation, management-capable handoff, and cross-instance collaboration.

#### Scenario: Catalog includes required archetype families

- **WHEN** the managed-seat validation catalog is inspected
- **THEN** it contains at least one scenario entry for each required archetype family
- **AND** each entry is written as `setup`, `objective`, `invariants`, `success`, and `failureEvidence` rather than as a fixed command transcript

#### Scenario: Shared-room precondition is explicit

- **WHEN** a managed-seat scenario depends on message-room transport between two principals
- **THEN** the scenario declares that shared room as setup truth
- **AND** it does not silently absorb contact discovery or room bootstrap into the same validation unless another capability explicitly adds that scope

### Requirement: Managed-seat validation SHALL preserve projection-versus-authority law

Managed-seat validation SHALL prove that message rooms and HTTP link forms are transport projections over invitation truth rather than replacements for resource authority. The evaluator SHALL distinguish descriptor transport from seat activation and SHALL keep authority ownership anchored to the target resource system across same-instance and cross-instance scenarios.

#### Scenario: Room-routed descriptor does not re-home terminal authority

- **WHEN** principal `A` sends a terminal invitation descriptor to principal `B` through a shared room and `B` accepts it
- **THEN** the room transcript acts only as descriptor transport
- **AND** the accepted seat remains owned by the original terminal authority rather than being re-homed to the message system

#### Scenario: Cross-instance acceptance keeps remote authority ownership

- **WHEN** a descriptor created by `agenter-B` is delivered through a room reachable from `agenter-A` and accepted from `agenter-A`
- **THEN** the resulting collaboration still targets the original resource authority hosted by `agenter-B`
- **AND** the validation proves that transport projection crossing ports or processes does not change authority ownership

### Requirement: Managed-seat validation SHALL verify unilateral lifecycle mutation and invalidation

Managed-seat validation SHALL include observable scenarios for unilateral manager containment after acceptance and for pending-invitation invalidation before acceptance. The evaluator SHALL treat `config`, repeated invite rotation, revoke, and expiry as distinct lifecycle facts rather than as prompt-only expectations.

#### Scenario: Post-accept config applies without second acceptance

- **WHEN** a manager changes an already accepted managed seat from one native authority level to another
- **THEN** the scenario observes the updated seat effect without requiring the invitee to perform a second acceptance
- **AND** the evaluator records that the authority change happened through unilateral manager action

#### Scenario: Replaced or expired descriptor cannot activate stale authority

- **WHEN** a pending invitation is replaced, revoked, or allowed to pass its expiry before acceptance
- **THEN** later acceptance with the older descriptor fails
- **AND** the scenario proves that stale descriptor text parsing does not imply stale authority is still activatable

### Requirement: Managed-seat validation SHALL emit durable failure evidence

Managed-seat validation SHALL produce failure evidence that can distinguish prompt drift, lifecycle bugs, projection bugs, and environment interference without relying on exact assistant wording. Evidence SHALL include recent room truth, invitation or seat state transitions, descriptor source or parsed form, terminal observations from relevant participants, and process or port ownership facts when local runtime services are involved.

#### Scenario: Failure report explains lifecycle and collaboration state

- **WHEN** a managed-seat collaboration scenario fails to invite, accept, mutate, or collaborate correctly
- **THEN** the failure output reports recent room truth, recent invitation or seat transitions, descriptor details, and the latest terminal observations from the involved principals
- **AND** the evidence is sufficient to tell whether the failure happened before acceptance, during activation, or after collaboration started

#### Scenario: Failure report includes environment ownership evidence

- **WHEN** a managed-seat scenario fails because a delivered local service is unreachable or a cross-instance environment is already occupied
- **THEN** the failure output reports relevant process and port ownership evidence for the scenario run
- **AND** the report distinguishes validation-owned processes from unrelated background activity
