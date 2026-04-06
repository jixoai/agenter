## Context

The platform currently conflates three different concepts:

1. durable identity (`wallet_evm:...`, `auth:...`, `session:...`)
2. authority (`accessToken` grants)
3. runtime instance (`sessionId`)

The target law separates these cleanly:

- durable identity is always a principal keypair
- resource authority is an ACL entry for a principal public key
- runtime instances may represent a principal, but they are not identity roots

This change implements the first destructive slice of that law without attempting backwards compatibility.

## Decisions

### 1. Canonical principal ids are raw `0x...`

All new durable identities use lowercase `0x...` addresses as their primary ids. `wallet_evm` remains a profile identifier kind for lookup and challenge flows, but it is no longer the primary displayed or stored auth id.

### 2. Shared crypto moves into a dedicated package

`@agenter/principal-crypto` will own:

- principal id normalization and validation
- secp256k1 keypair generation
- message signing / verification helpers
- sealed payload helpers for sender -> recipient encryption
- managed key encryption helpers for at-rest storage

This avoids duplicating key logic across profile-service, app-server, and future room/terminal payload flows.

### 3. Managed principals live in profile-service

`profile-service` remains the durable home for user/profile metadata, but it now also stores managed principals for resources like rooms. Managed principal private keys are encrypted at rest using a service-side secret derived from the managed root auth key.

### 4. Avatar principals are local, not managed

Avatars own their own keypairs, stored in:

`WORKSPACE/.agenter/avatar/<nickname>/settings.local.json`

The same file may continue to hold seat metadata during the transition, but new avatars always gain a principal id, public key, and private key immediately.

### 5. New runtime actors use avatar principal ids

New sessions bind `messageActorId` and `terminalActorId` to the avatar principal id instead of `session:<id>`. To keep the first migration slice practical, message-system and terminal-system accept principal ids in addition to legacy actor ids.

### 6. New global rooms use managed principal ids

New global room ids are allocated by creating a managed room principal in profile-service, then using its principal id as the room id. This gives every new room durable cryptographic identity before later request-signing work lands.

## Risks / Trade-offs

- The first slice leaves `accessToken` grants in place for room/terminal authority. This is intentional sequencing: identity law changes land first, request-signing transport comes next.
- Supporting both principal ids and legacy actor ids during the first migration slice increases validation surface. This is acceptable because all *new* identities will be principals, while old fixtures are allowed to coexist temporarily.
- Global room creation becomes async because room principal creation must persist managed key material before room truth is created.

## Migration Plan

1. Add the shared principal crypto package and tests.
2. Add principal registry + managed principal storage to profile-service and expose bridge/server APIs.
3. Add avatar principal storage to local avatar settings and persist `avatarPrincipalId` in session metadata.
4. Bind new runtimes to avatar principal ids and relax message/terminal actor validation to accept principals.
5. Create new global rooms from managed room principals and update tests/contracts accordingly.
6. Follow up with a second change that replaces bearer token authority with signed request envelopes and public-key ACL enforcement end-to-end.
