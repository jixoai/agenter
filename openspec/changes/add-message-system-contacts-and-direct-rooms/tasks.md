## 1. Message-system durable contact truth

- [x] 1.1 Add contact/source/request durable types and exports in `packages/message-system`
- [x] 1.2 Extend `MessageDb` schema and CRUD operations for source subscriptions, contacts, and contact requests
- [x] 1.3 Add `MessageControlPlane` methods for source subscription management, contact management, and request lifecycle state transitions

## 2. App-server contact and remote-source integration

- [x] 2.1 Add app-server remote source client helpers that call remote `/trpc` auth routes with actor-private source credentials
- [x] 2.2 Add kernel methods and tRPC routes for source subscription CRUD, remote actor search, contact requests, and contact acceptance
- [x] 2.3 Add direct-room bootstrap and paired-room sync helpers used by `accept-contact --firstChat`

## 3. Direct-room and runtime behavior

- [x] 3.1 Enforce `roomMode` metadata rules for `direct` versus `public` rooms and prevent in-place direct-room expansion
- [x] 3.2 Update runtime reachable-participant projection to prefer durable contacts and keep visible-room label projection as fallback

## 4. Verification

- [x] 4.1 Add message-system tests for source subscriptions, contacts, and request lifecycle transitions
- [x] 4.2 Add app-server tests for remote actor search, cross-instance contact request exchange, and accept-contact without `firstChat`
- [x] 4.3 Add app-server integration tests for paired direct-room bootstrap, synced first message visibility, and direct-room third-party invite branching to a new public room
