## Why

Current terminal and message seat administration is split between superadmin/browser-only direct mutations and control-plane grant APIs that mint authority immediately. That bypasses bilateral consent, makes a shared link equivalent to live access, and prevents a terminal manager or room manager from delegating seats through a proof-bearing self-service flow.

We need one durable invitation/accept handshake that lets a manager propose a seat, deliver a shareable link, and activate access only after the invited principal accepts with its own signature.

## What Changes

- Add a shared managed-seat invitation handshake capability for resource-local seat delegation. Invitations become pending facts with recipient binding, resource-native authority payload snapshots, expiry, and share descriptors.
- Extend terminal and message control planes with manager-authorized `invite`, `accept`, `config`, and `revoke` flows that reuse the shared handshake while keeping each system's native seat and current-admin law intact.
- Expose dedicated `terminal-manage` and `message-manage` root-workspace CLI surfaces instead of overloading the existing `terminal` and `message` CLIs.
- Treat terminal/message management CLIs as frontend clients over system endpoints plus token/proof, rather than as direct mutable owners of terminal/message durable truth.
- Reuse principal-signature proof for acceptance and emit both deep-link (`terminal://join`, `message://join`) and HTTP wrapper descriptors from the same opaque invitation token.
- Keep permission vocabulary adapter-owned. The handshake is shared; terminal and message do not have to pretend they share one universal role dictionary.
- Keep invitation ownership resource-local. This change must not turn into a new global invitation authority or cross-system mutable service.
- Keep `workspace-manage` out of scope for now. The handshake must remain adapter-friendly, but this round only wires terminal and message.

## Capabilities

### New Capabilities
- `managed-seat-invitation-handshake`: Shared proof-bearing invitation lifecycle for resource seats, including pending invitation truth, principal-bound acceptance, resource-native authority snapshots, and share descriptor projection.

### Modified Capabilities
- `terminal-control-plane`: Add terminal-specific invitation, acceptance, seat mutation, and revocation behavior on top of the shared handshake.
- `message-chat-control-plane`: Add room-specific invitation, acceptance, seat mutation, and revocation behavior on top of the shared handshake.
- `runtime-skills-cli-surface`: Expose dedicated `terminal-manage` and `message-manage` root-shell commands with resource-native authority grammar and shared acceptance signing behavior.

## Impact

- Affected systems: `@agenter/terminal-system`, `@agenter/message-system`, runtime local CLI/API wiring, and root-workspace shell command mounting.
- Reused primitives: `@agenter/principal-crypto` signing and principal identity normalization.
- Architecture direction: terminal/message systems remain backend authorities; `*-manage` CLIs become endpoint-speaking clients that can later inform a reusable agenter system architecture handbook.
- No `workspace-manage` implementation or workspace ownership refactor is included in this change.
