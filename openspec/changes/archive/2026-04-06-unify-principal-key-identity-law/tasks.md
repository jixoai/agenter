## 1. Principal Foundation

- [x] 1.1 Add `@agenter/principal-crypto` with key generation, principal id normalization, sign/verify, seal/open, and at-rest key encryption helpers
- [x] 1.2 Add focused tests for shared crypto primitives

## 2. Principal Registry

- [x] 2.1 Extend profile-service schema/types/store with principal registry and managed principal key storage
- [x] 2.2 Add profile-service APIs + bridge methods to create and read managed principals
- [x] 2.3 Change root auth and browser auth ids to raw `0x...`

## 3. Avatar + Runtime Binding

- [x] 3.1 Upgrade avatar `settings.local.json` to include a durable avatar principal keypair
- [x] 3.2 Persist `avatarPrincipalId` in session metadata and bind new runtimes to that principal
- [x] 3.3 Accept principal ids in message-system and terminal-system actor validation

## 4. Room Principal Allocation

- [x] 4.1 Allocate new global rooms from managed room principals instead of `room-*`
- [x] 4.2 Update targeted tests/contracts for `0x...` auth ids and room ids

## 5. Verification

- [x] 5.1 Run focused tests for principal-crypto, profile-service, app-server room creation, and webui room-create contract
