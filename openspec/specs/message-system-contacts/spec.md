# message-system-contacts Specification

## Purpose
Define the actor-private people layer that lives inside `message-system`: remote source subscriptions, durable contacts, durable contact requests, and the optional direct-chat bootstrap that may follow contact acceptance.

## Requirements

### Requirement: Message-system SHALL persist actor-private source subscriptions

The message-system SHALL persist actor-private source subscription records that describe how one local actor reaches one remote message-system source, including stable `sourceId`, source label, remote endpoint base URL, and any actor-private bearer token or equivalent remote credential needed for remote reads and writes.

#### Scenario: Actor registers two independent sources
- **WHEN** actor `A` saves two remote source subscriptions
- **THEN** both subscriptions are persisted under `A`'s private contact state
- **THEN** another actor does not automatically inherit those subscriptions

#### Scenario: Source provisioning updates in place
- **WHEN** actor `A` saves a second subscription write for existing `sourceId` `S`
- **THEN** the existing durable source record is updated in place
- **THEN** future remote search and request delivery use the updated endpoint and credential truth

### Requirement: Message-system SHALL model contacts by owner actor plus source plus remote actor

The message-system SHALL persist durable contact facts keyed by local owner actor id, source id, and remote actor id. Contacts from different sources SHALL remain distinct even when they project the same visible label or principal-like identifier.

#### Scenario: Same visible person appears from two sources
- **WHEN** actor `A` stores contact `auth:bob` from source `S1` and source `S2`
- **THEN** the two contact records remain distinct durable facts
- **THEN** message-system does not merge them solely by label or remote actor id text

### Requirement: Message-system SHALL support durable contact-request lifecycle

The message-system SHALL persist durable contact-request records outside room transcript history. Contact requests SHALL support lifecycle states `pending`, `accepted`, `rejected`, `revoked`, `expired`, and `superseded`.

#### Scenario: Sending a contact request creates inbox truth
- **WHEN** actor `A` sends actor `B` a contact request through source `S`
- **THEN** `A` gets a durable outbound request fact
- **THEN** `B` gets a durable inbound request fact in its contact-request inbox
- **THEN** the request does not require a preexisting shared room

#### Scenario: Re-inviting the same target supersedes the older request
- **WHEN** actor `A` sends a second pending contact request to the same remote actor on the same source
- **THEN** the newer request becomes the active pending request
- **THEN** the older pending request becomes `superseded`

#### Scenario: Expired request cannot be accepted
- **WHEN** a pending contact request passes its expiry time
- **THEN** it becomes `expired`
- **THEN** later acceptance attempts are rejected

### Requirement: Contact acceptance SHALL remain orthogonal to room creation

Accepting a contact request SHALL create the local contact relationship without automatically creating a room. An explicit `firstChat` payload MAY ask the system to bootstrap a paired direct-room conversation after acceptance.

#### Scenario: Accepting without first chat only creates contact truth
- **WHEN** actor `B` accepts actor `A`'s pending request without `firstChat`
- **THEN** both sides persist the contact relationship
- **THEN** no direct room is created only because the contact was accepted

#### Scenario: Accepting with first chat bootstraps direct conversation
- **WHEN** actor `B` accepts actor `A`'s pending request with `firstChat`
- **THEN** both sides persist the contact relationship
- **THEN** both sides create paired direct rooms
- **THEN** the first message is durably visible from both local direct-room histories

### Requirement: Runtime-facing people directory SHALL prefer durable contacts over room-label projection

When runtime tooling needs a reachable people directory, the system SHALL project durable contacts first and only use room-label-only participant projection as fallback when no durable contact fact exists.

#### Scenario: Durable contact hides label-only ambiguity
- **WHEN** runtime tooling renders a reachable participant directory for actor `A`
- **AND** `A` has a durable contact record for remote actor `B`
- **THEN** the directory includes `B` from durable contact truth
- **THEN** the directory does not need to infer `B` only from labels found in visible rooms
