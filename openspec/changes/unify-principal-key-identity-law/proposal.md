## Why

The current identity model is split across multiple incompatible surfaces:

- browser auth uses `wallet_evm:0x...`
- room and terminal permissions use `auth:/session:/system:` actor ids
- avatars persist seat tokens locally but do not own durable keypairs
- new global room ids are opaque strings, but they are not durable principals with cryptographic material

This makes identity, authority, and runtime instance ownership diverge. The user requirement is to collapse these surfaces into one law: every durable entity is a keypair-backed principal, permissions are public-key ACL entries, and new identities are expressed as raw `0x...` principal ids.

## What Changes

- Introduce a shared `principal-crypto` package for principal ids, key generation, payload signing, sealed envelopes, and managed key encryption at rest.
- Extend `profile-service` into a principal registry that can persist managed principals, resolve raw `0x...` auth ids, and expose principal metadata.
- Upgrade avatar local state so each avatar owns a durable principal keypair in its `settings.local.json`.
- Allocate new global room ids from managed room principals so new room routes are `0x...`.
- Allow message-system and terminal-system to accept principal ids as actors, while app-server starts binding runtimes to avatar principals instead of `session:*`.

## Impact

- Affected code: `packages/profile-service`, `packages/app-server`, `packages/message-system`, `packages/terminal-system`, `packages/webui`, new `packages/principal-crypto`
- Breaking behavior:
  - new auth ids become raw `0x...`
  - new avatar/runtime actors become avatar principal ids
  - new global room ids become raw `0x...`
- Destructive migration is allowed; no attempt is made to preserve existing auth/grant/token durable truth
