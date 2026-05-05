## Why

The current message collaboration flow still assumes that two actors already share a room before they can naturally discover each other, talk, or test cross-instance behavior. That makes the system's real-world collaboration story weaker than its room and invitation primitives, and it forces message discovery to rely on temporary room-label projections instead of durable contact truth.

## What Changes

- Add an actor-private contacts module inside `messageSystem` instead of creating a separate `contactSystem`.
- Add actor-private source subscriptions so one actor can register multiple remote `messageSystem` sources with explicit endpoint and token truth.
- Add durable contact records and durable contact-request inbox records keyed by owner actor, source, and remote actor.
- Add remote actor search over a subscribed source by reusing the remote source's auth actor catalog.
- Add accept/reject/revoke/supersede/expire contact-request lifecycle handling.
- Add optional direct-room bootstrap after contact acceptance through `accept-contact --firstChat`.
- Add paired direct-room metadata and rules so direct rooms stay strict 1:1 and any attempt to invite a third actor creates a new public room instead of mutating the direct room.
- Replace or demote room-label-only reachable participant projections with contact-aware projections where runtime tooling needs a durable people directory.

## Capabilities

### New Capabilities
- `message-system-contacts`: Actor-private source subscriptions, contacts, contact requests, remote actor search, and contact acceptance flows including optional direct-room bootstrap.

### Modified Capabilities
- `message-chat-control-plane`: Room metadata and lifecycle now distinguish `direct` versus `public` rooms, and direct-room invitation flows must branch into new public rooms instead of expanding the existing direct room.

## Impact

- Affected code:
  - `packages/message-system`
  - `packages/app-server`
  - `packages/cli`
- Affected APIs:
  - message-system control-plane methods and durable types
  - app-server message/contact tRPC surfaces
  - runtime directory projection used by tooling
- Affected tests:
  - message-system integration tests
  - app-server tRPC and cross-instance integration tests
