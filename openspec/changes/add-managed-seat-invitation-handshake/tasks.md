## 1. Shared Invitation Core

- [x] 1.1 Add durable invitation truth for pending, accepted, revoked, and expired managed-seat invitations.
- [x] 1.2 Add resource-native authority snapshot binding, shared invitation token parsing, share descriptor projection, and principal-signature acceptance helpers.
- [x] 1.3 Add tests for wrong-principal rejection, token expiry, and invitation replacement invalidation.
- [x] 1.4 Keep the shared layer protocol-only; do not introduce a new global invitation database or mutable invitation authority.

## 2. Terminal Integration

- [x] 2.1 Add terminal control-plane invite, accept, config, and revoke operations on top of the shared invitation core.
- [x] 2.2 Map terminal-native `RO | RW | TM` authority inputs to terminal payloads, keep `RW` as direct-write semantics, and preserve existing current-admin and lease rules.
- [x] 2.3 Add terminal tests covering accepted-seat activation, TM admin-candidate insertion, config mutation, and revoke invalidation.

## 3. Message Integration

- [x] 3.1 Add message control-plane invite, accept, config, and revoke operations on top of the shared invitation core.
- [x] 3.2 Map room-native authority inputs to room payloads and preserve existing room current-admin and state-clear rules.
- [x] 3.3 Add message tests covering accepted-seat activation, room-admin candidate insertion, config mutation, and revoke invalidation.

## 4. CLI And Runtime Surface

- [x] 4.1 Expose `terminal-manage` and `message-manage` through runtime-local API and root-workspace shell command mounting as endpoint-speaking frontend clients.
- [x] 4.2 Implement JSON-first `invite`, `accept`, `config`, and `revoke` command flows plus descriptor normalization for raw tokens, deep links, HTTP wrapper URLs, terminal `RO | RW | TM`, and message `readonly | member | admin`.
- [x] 4.3 Document the backend-system / frontend-client law, the shared acceptance proof flow, the adapter-owned authority model, and the non-goal status of `workspace-manage`.

## 5. Verification And Real-AI Trials

- [x] 5.1 Add cross-system integration tests where a room-delivered invitation descriptor is accepted into terminal authority without changing invitation truth.
- [ ] 5.2 Add real two-principal verification where principal A invites principal B, sends the descriptor through messageSystem, B accepts, B writes to the shared terminal, and both sides can observe the resulting terminal output under native read law.
- [x] 5.3 Add expiry and renewal tests covering actual timeout failure, repeated invite expiry refresh, stale descriptor invalidation, and revoke-during-pending behavior.
- [ ] 5.4 Add dual-agenter multi-port verification where agenter-B hosts Avatar-B and a terminal, agenter-A hosts Avatar-A, both avatars first share a room on agenter-A, then Avatar-B invites Avatar-A into the terminal hosted by agenter-B, and both sides verify cross-instance terminal collaboration.

## 6. Architecture Extraction

- [x] 6.1 Capture the reusable `system backend + endpoint/token/proof client frontend` pattern as follow-up architecture guidance once terminal/message implementations stabilize.
