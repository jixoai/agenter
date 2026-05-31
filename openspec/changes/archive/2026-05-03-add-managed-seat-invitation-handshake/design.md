## Context

Terminal and message systems already have durable grant law, current-admin routing, access tokens, and superadmin recovery paths. What they do not have is a lawful self-service onboarding protocol: the manager-side act of "adding a user" still collapses proposal, authority minting, and delivery into one mutation.

That collapse is exactly what this change has to break apart. The new requirement is not "another way to call `issueGrant`". The requirement is a bilateral seat handshake:

1. A manager proposes a seat for one principal.
2. The system emits a shareable invitation descriptor.
3. The invited principal accepts with its own proof.
4. Only then does native resource authority become active.

Constraints that already exist in the codebase:

- Terminal and message both enforce a current-admin law instead of unconstrained multi-admin writes.
- Terminal and message both already treat access tokens as capability facts inside an authenticated control plane rather than as browser identity.
- Durable user identities are canonical principal ids, and the repo already has reusable principal signing and verification primitives.
- The runtime shell contract prefers dedicated CLI atoms over hidden tool glue, so management should become its own command surface rather than polluting `message` or `terminal`.

## Goals / Non-Goals

**Goals:**

- Introduce one shared invitation/accept handshake law that terminal and message can both consume.
- Keep "invite" separate from "active authority" so link delivery is no longer equal to seat activation.
- Keep permission vocabulary adapter-owned instead of forcing terminal/message into one fake universal role taxonomy.
- Make terminal `RW` mean direct usable authority after acceptance, not an approval-only write request path.
- Preserve current-admin containment power for `config` and `revoke`.
- Reframe management CLIs as frontend clients over system endpoints, not as the system authority itself.
- Keep the design adapter-friendly so workspace can adopt it later if that becomes worth the cost.

**Non-Goals:**

- Rebuild terminal or message grant law from scratch.
- Remove existing superadmin/bootstrap direct grant paths used for recovery, bootstrap, or compatibility.
- Introduce `workspace-manage` in this round.
- Require bilateral re-acceptance for every later role change.
- Define browser-only onboarding UX. The durable contract is CLI/control-plane first.

## Decisions

### 1. Introduce one shared invitation core with resource adapters

The recommended architecture is a shared managed-seat invitation capability plus thin resource adapters for terminal and message.

The shared core owns:

- invitation lifecycle: `pending | accepted | revoked | expired`
- inviter principal id
- invitee principal id
- resource kind and resource id
- resolved native authority payload snapshot
- authority payload digest or equivalent proof-binding field
- opaque acceptance token
- share descriptor projection metadata

Each resource adapter owns:

- mapping shared seat class to native seat payload
- applying that payload on acceptance
- in-place mutation on `config`
- resource-local revocation side effects
- resource-local invitation durability and querying

Why this over per-system invite tables:

- Terminal and message would otherwise duplicate proof verification, expiry, token rotation, deep-link grammar, and audit semantics.
- The shared core creates one future extension seam for workspace without forcing workspace into scope today.

Rejected alternative:

- Build `terminal-manage` and `message-manage` as separate wrappers around direct grant tables.
- Rejected because it creates two near-identical handshake systems and bakes transport/detail divergence into the platform law.

Rejected alternative:

- Build one global invitation service that owns every terminal/message invitation row.
- Rejected because it would create a third mutable authority competing with resource-local truth, blur system boundaries, and make later resource-specific lifecycle rules much harder to reason about.

### 2. Invitation creation is non-authoritative; acceptance activates authority

Manager-side `invite` must create only a pending proposal. It must not mint a live access token or active resource grant.

The accepted path is:

- manager creates invitation
- system returns token and share descriptors
- recipient accepts and signs
- adapter applies stored native payload
- system returns active access projection

This is the key paradigm correction. The link is no longer the authority; the accepted proof is.

Rejected alternative:

- Put a live access token directly inside the link.
- Rejected because link leakage would instantly equal seat authority, which violates the stated bilateral-confirmation requirement.

### 3. Acceptance uses principal proof, not browser auth-session proof

The invited identity in this workflow is a principal address/public key, not necessarily a browser superadmin session. The acceptor therefore proves possession with principal-key signing, using the existing principal crypto law.

Practical implications:

- management CLI may accept a recipient as principal id or public key, but durable invitation truth canonicalizes to principal id
- `accept` signs a payload bound to invitation id/token, resource identity, invitee principal id, and expiry window
- verification happens against the invited principal id, not against a browser auth JWT

This keeps the handshake available in root-shell runtime flows and avoids coupling seat acceptance to browser login state.

Rejected alternative:

- Route acceptance through auth-service wallet JWT issuance.
- Rejected because the seat recipient may be an avatar/session principal and the onboarding contract must remain resource-local and shell-usable.

### 4. The handshake is shared, but permission vocabulary stays adapter-owned

The shared layer should not invent a universal permission taxonomy. It should only carry an adapter-owned authority snapshot plus a digest that gets bound into the acceptance proof.

Resource adapters define their own authority grammar and resolve it to native payloads at invite time:

- terminal:
  - operator-facing grammar can stay `RO | RW | TM`
  - `RO -> readonly`
  - `RW -> writer`
  - `TM -> admin` plus admin-candidate inclusion
- message:
  - operator-facing grammar should stay room-native
  - `readonly -> readonly`
  - `member -> member`
  - `admin -> admin` plus admin-candidate inclusion

Persisting the resolved payload snapshot matters. It prevents later adapter changes from silently changing the meaning of an already issued invitation.

This also intentionally excludes terminal `requester` from the cross-system handshake law. Terminal `RW` means the invited principal can directly operate after acceptance. Approval-style writing remains out of scope for this change because human negotiation already has a natural home in MessageSystem.

Rejected alternative:

- Force terminal/message into one shared role dictionary.
- Rejected because it projects one system's vocabulary onto another and creates fake equivalence where the underlying authority law is objectively different.

### 5. Administrative capability remains resource-native but still participates in current-admin routing

The handshake should preserve the existing current-admin law instead of flattening it.

For terminal:

- accepting `TM` resolves to a native admin seat
- the actor joins the resource's admin-candidate set
- existing terminal current-admin routing remains authoritative for who may act right now

For message:

- accepting room-native `admin` resolves to a native admin seat
- the actor joins the room's admin-candidate set
- existing room current-admin routing remains authoritative for who may act right now

This keeps the existing single-current-admin law intact while allowing multiple manager-capable candidates to exist durably.

Rejected alternative:

- Let every accepted administrative-capability seat mutate policy concurrently.
- Rejected because it would contradict the existing current-admin containment law and create multi-writer authority races.

### 6. `config` and `revoke` remain unilateral manager containment powers

Only onboarding is bilateral. Containment stays unilateral.

That means:

- `config` can update a pending invitation or an already-active seat
- accepted-seat role changes apply immediately through the resource adapter
- `revoke` invalidates pending invitations and active authority for that principal on that resource

This is intentional because the authority model is principal-key-first. Once a principal has accepted entry into a resource, later containment and policy changes are owned by the resource manager. The system should not require the managed party to co-sign its own downgrade, revoke, or later reconfiguration.

This preserves emergency containment and avoids turning ordinary permission maintenance into a second consent loop.

Rejected alternative:

- Require the recipient to re-accept every role change.
- Rejected because it weakens manager containment and delays urgent access reduction.

### 7. System backends and management clients are separate atoms

`terminalSystem` and `messageSystem` should be treated as backend authorities. `terminal-manage`, `message-manage`, and future interactive clients should be treated as frontend clients that connect to those authorities over `endpoint + token + proof`.

The durable acceptance handle is still the opaque invitation token. The platform may project that token into:

- deep link: `terminal://join?...` or `message://join?...`
- HTTP wrapper URL: deployment-specific HTTPS share entrypoint

These projections exist to help a client find and bind to the backend system. They are not the durable truth themselves.

Client acceptance must work from:

- raw token
- deep link
- HTTP wrapper URL

The control plane should not own one hard-coded public URL topology. That belongs to the delivery/app-server layer, which can keep evolving toward a more general system-backend / client-frontend architecture.

Rejected alternative:

- Bake a mandatory HTTP join endpoint into the control-plane law.
- Rejected because deployment topology is not a resource-seat invariant.

### 8. Workspace stays out of scope, but the law remains adapter-ready

The shared invitation core deliberately uses `resourceKind + resourceId + nativePayload` rather than terminal/message-specific columns. That is the minimum adapter seam needed for future reuse.

This does not authorize a workspace implementation now. It only prevents terminal/message from hard-coding themselves into the new law.

### 9. Shared handshake must stay a protocol library, not a third authority

The reusable part of this design should stay as close as possible to a protocol/toolkit:

- token generation and validation helpers
- payload hashing and proof binding
- descriptor parsing and projection
- adapter interfaces

It should not become the durable owner of every invitation row across all systems.

Terminal invitations should remain owned by TerminalSystem durability. Message invitations should remain owned by MessageSystem durability. Future systems may reuse the protocol, but they should still own their own invitation facts unless a separate first-principles design later proves otherwise.

## Risks / Trade-offs

- [Risk] A shared invitation core can become over-abstract if it starts modeling resource-specific behavior. -> Mitigation: keep the shared layer limited to invitation lifecycle, proof, and descriptor projection; keep native seat payload application inside adapters.
- [Risk] The shared handshake could slowly grow a hidden universal permission model. -> Mitigation: keep authority payloads opaque and adapter-owned; only handshake lifecycle and proof stay shared.
- [Risk] The shared handshake could turn into a global invitation service by convenience. -> Mitigation: keep invitation rows, indexes, and lifecycle mutations inside each resource system; let the shared layer expose only protocol helpers and adapter contracts.
- [Risk] Keeping direct grant APIs for bootstrap and recovery can let future callers bypass the new lawful path accidentally. -> Mitigation: scope the new self-service manager surfaces to invitation-first flows and document direct grants as bootstrap/recovery-only.
- [Risk] Share URLs can leak over out-of-band channels. -> Mitigation: invitation tokens stay non-authoritative until the invited principal signs acceptance, and revoked/expired tokens remain unusable.
- [Risk] Accepting by principal proof alone does not define where recipient-local bookmarks or imports are stored. -> Mitigation: keep local import persistence out of the control-plane truth in this round and treat it as a CLI projection concern.
- [Risk] Treating CLI as a frontend client may expose missing endpoint boundaries in the current implementation. -> Mitigation: make the boundary explicit now in spec/design, then let implementation work close the remaining coupling intentionally rather than through hidden glue.

## Migration Plan

1. Add invitation durability and proof helpers without removing existing grant APIs.
2. Wire terminal and message adapters so invite/accept/config/revoke can coexist with current direct grant and bootstrap flows.
3. Expose `terminal-manage` and `message-manage` as endpoint-speaking clients in root-workspace shells and runtime-local API surfaces.
4. Keep WebUI/browser admin flows operational during rollout; they may adopt the invitation law later without being required for this change.
5. If rollout reveals missing resource-specific nuances, extend adapter payloads rather than mutating the shared handshake into a permission taxonomy.
6. After the pattern stabilizes, extract the reusable backend/client laws into a dedicated architecture handbook or skill.

Rollback posture:

- shared invitation paths can be disabled without deleting existing direct grant flows
- accepted seats remain ordinary native grants after activation, so revoking the invitation feature does not strand already accepted resource authority

## Implementation Defaults

These defaults are now intentionally fixed for the first implementation so the change can move into code without reopening app-law debates.

- `message-manage` first exposes direct room-native authority grammar: `readonly | member | admin`.
- Replacing a still-pending invitation for the same principal rotates the opaque acceptance handle and all derived descriptors.
- Reconfiguring an already-accepted seat uses unilateral `config` in place and does not force a second invitation or second acceptance.
- The first delivery flow does not require a persistent invitation preview page. Token resolution plus CLI import is sufficient as long as raw token, deep link, and HTTP wrapper URL all resolve to the same pending invitation fact.

## Database Model Checklist

The purpose of this section is not to freeze exact SQL today. It is to make the durable fact model explicit enough that implementation does not drift back into hidden glue.

### Shared invitation fact shape

Every resource-owned invitation row should carry the same minimum truth, even if terminal and message persist it in different tables:

- invitation id
- resource kind
- resource id
- inviter principal id
- invitee principal id
- invitation status: `pending | accepted | revoked | expired`
- resolved native authority payload snapshot
- authority payload digest
- opaque acceptance token hash
- descriptor metadata needed to re-project deep link / HTTP wrapper forms
- created at
- expires at
- accepted at
- revoked at
- superseded by invitation id, if a pending invitation gets replaced

The shared protocol library may own parsing, hashing, proof binding, and descriptor projection helpers, but it must not become the durable owner of these rows.

### Terminal persistence mapping

Terminal already persists seat authority and admin routing through:

- `terminal_grant`
- `terminal_admin_candidate`
- `terminal_write_lease`

The handshake should add a terminal-owned invitation table adjacent to those facts rather than overloading `terminal_grant` to mean both proposal and active seat.

Recommended terminal-side addition:

- `terminal_invitation`
  - `invitation_id`
  - `terminal_id`
  - `inviter_participant_id`
  - `invitee_participant_id`
  - `seat_class`
  - `native_payload_json`
  - `payload_digest`
  - `acceptance_token_hash`
  - `descriptor_json`
  - `status`
  - `created_at`
  - `expires_at`
  - `accepted_at`
  - `revoked_at`
  - `superseded_by_invitation_id`

Recommended terminal-side indexes:

- `(terminal_id, invitee_participant_id, created_at desc)` for latest invitation lookup
- `(terminal_id, acceptance_token_hash)` for descriptor resolution
- `(terminal_id, status, expires_at)` for pending sweep / expiry logic

Activation path:

1. `invite` inserts or replaces a `pending` `terminal_invitation`.
2. `accept` verifies the principal proof against the stored payload digest and invitee principal.
3. On success, acceptance issues or refreshes a `terminal_grant` and optionally inserts into `terminal_admin_candidate` for `TM`.
4. `revoke` invalidates pending terminal invitations, revokes active `terminal_grant`, and clears any active `terminal_write_lease` continuation power for that participant.

### Message persistence mapping

Message already persists room authority and room-local projections through:

- `chat_channel_grant`
- `actor_state`
- `actor_room_state`

The handshake should add a message-owned invitation table next to those facts rather than overloading `chat_channel_grant`.

Recommended message-side addition:

- `chat_channel_invitation`
  - `invitation_id`
  - `chat_id`
  - `inviter_actor_id`
  - `invitee_actor_id`
  - `seat_class`
  - `native_payload_json`
  - `payload_digest`
  - `acceptance_token_hash`
  - `descriptor_json`
  - `status`
  - `created_at`
  - `expires_at`
  - `accepted_at`
  - `revoked_at`
  - `superseded_by_invitation_id`

Recommended message-side indexes:

- `(chat_id, invitee_actor_id, created_at desc)` for latest invitation lookup
- `(chat_id, acceptance_token_hash)` for descriptor resolution
- `(chat_id, status, expires_at)` for pending sweep / expiry logic

Activation path:

1. `invite` inserts or replaces a `pending` `chat_channel_invitation`.
2. `accept` verifies the principal proof against the stored payload digest and invitee actor.
3. On success, acceptance issues or refreshes a `chat_channel_grant`.
4. When the accepted role is `admin`, current-admin candidacy remains governed by room-native current-admin law rather than by the invitation row itself.
5. `revoke` invalidates pending room invitations, revokes active `chat_channel_grant`, and lets existing room-local cleanup continue to own actor state clearing.

## API Shape Checklist

The goal here is to lock the control-plane seams before implementation starts. This section describes the intended contract shape, not final function names.

### Shared protocol helper surface

Recommended shared helper responsibilities:

- normalize descriptor input from raw token, deep link, or HTTP wrapper URL
- hash and compare opaque acceptance handles
- build acceptance proof payload from:
  - invitation id or token
  - resource kind
  - resource id
  - invitee principal id
  - payload digest
  - expiry window
- verify principal signature against the bound payload

Shared helpers must not expose resource mutation functions. Resource mutation remains adapter-owned.

### Terminal control-plane shape

Recommended terminal operations:

- `inviteTerminalSeat(input)`
  - manager credential
  - `terminalId`
  - `participantId`
  - authority grammar: `RO | RW | TM`
  - optional expiry
- `acceptTerminalSeat(input)`
  - descriptor input
  - acceptance proof
- `configTerminalSeat(input)`
  - manager credential
  - `terminalId`
  - `participantId`
  - next authority grammar
- `revokeTerminalSeat(input)`
  - manager credential
  - `terminalId`
  - `participantId`

Recommended invite result shape:

- invitation id
- opaque token
- canonical deep link
- HTTP wrapper URL if delivery layer is configured
- pending invitation summary with terminal-native authority projection

Recommended accept result shape:

- accepted invitation id
- resulting active terminal access projection
- resulting seat projection

### Message control-plane shape

Recommended message operations:

- `inviteRoomSeat(input)`
  - manager credential
  - `chatId`
  - `actorId`
  - authority grammar: `readonly | member | admin`
  - optional expiry
- `acceptRoomSeat(input)`
  - descriptor input
  - acceptance proof
- `configRoomSeat(input)`
  - manager credential
  - `chatId`
  - `actorId`
  - next authority grammar
- `revokeRoomSeat(input)`
  - manager credential
  - `chatId`
  - `actorId`

Recommended invite result shape:

- invitation id
- opaque token
- canonical deep link
- HTTP wrapper URL if delivery layer is configured
- pending invitation summary with room-native authority projection

Recommended accept result shape:

- accepted invitation id
- resulting active room access projection
- resulting seat projection

### Runtime-local API and CLI shape

Recommended runtime-local API additions:

- `terminalManageInvite`
- `terminalManageAccept`
- `terminalManageConfig`
- `terminalManageRevoke`
- `messageManageInvite`
- `messageManageAccept`
- `messageManageConfig`
- `messageManageRevoke`

These should remain JSON-first endpoint handlers so `terminal-manage` and `message-manage` can stay thin frontend clients.

Recommended CLI law:

- `invite` returns pending invitation descriptors, never live seat authority
- `accept` accepts any supported descriptor form and signs with the runtime principal key
- `config` targets either a pending invitation or an active seat without reopening bilateral consent
- `revoke` invalidates both pending invitation state and active seat authority

## Verification Matrix

The first implementation should not stop at unit tests around token parsing. This change materially alters cross-system authority flow, so it needs both protocol verification and real two-principal trials.

### Layer 1: Shared protocol verification

Minimum automated coverage:

- wrong principal signature fails
- expired descriptor fails after backend time crosses `expires_at`
- repeated invite for the same resource and principal refreshes expiry by replacing the pending invitation
- replaced descriptor becomes stale even if the descriptor text still parses
- revoked pending invitation cannot later activate a seat
- raw token, deep link, and HTTP wrapper URL all normalize to the same invitation fact

Important law:

- expiry is a backend durability fact, not a client-clock hint
- "descriptor still parses" must not be confused with "descriptor still authorizes acceptance"

### Layer 2: Resource integration verification

Terminal integration should prove:

- accepted `RW` becomes direct-write rather than requester flow
- accepted `TM` joins admin-candidate law without bypassing current-admin law
- `config` mutates an accepted seat in place
- `revoke` clears both pending invitation truth and active terminal continuation power

Message integration should prove:

- accepted room invitation activates room-native grant
- accepted `admin` joins room admin-candidate law without creating parallel unconditional admins
- `config` mutates an accepted room seat in place
- `revoke` clears pending invitation truth and room-local authority projections

### Layer 3: Real two-principal AI trial

The core end-to-end rehearsal should look like this:

1. Principal `A` and principal `B` already share a message room.
2. `A` runs `terminal-manage invite` for `B` on terminal `T` with `RW`.
3. `A` sends the returned descriptor into the shared room through messageSystem.
4. `B` reads that descriptor from the room and runs `terminal-manage accept`.
5. `B` reads terminal `T`, writes a visible command such as `echo invited-user-check`, and reads again.
6. `A` also reads terminal `T`.
7. Both sides observe the terminal state produced by `B`'s write.

This is the real test that the architecture is doing what it claims:

- messageSystem is only the transport projection
- terminalSystem remains the authority
- acceptance really activates usable terminal power
- the invited actor can see and affect the same shared terminal after acceptance

### Layer 3.5: Dual-agenter multi-port trial

The stronger rehearsal should involve two separate agenter processes:

1. Start `agenter-A` on port `PA` and `agenter-B` on port `PB`.
2. Manually configure Avatar-A on `agenter-A` and Avatar-B on `agenter-B` so both avatars can already chat in one room hosted on `agenter-A`.
3. On `agenter-B`, Avatar-B creates terminal `T`.
4. Avatar-B runs `terminal-manage invite` for Avatar-A against terminal `T`.
5. Avatar-B sends the returned descriptor to Avatar-A through the existing room.
6. Avatar-A accepts the descriptor from `agenter-A`.
7. Avatar-A reads terminal `T`, writes a visible command, and reads again.
8. Avatar-B also reads terminal `T`.
9. Both sides observe the terminal state produced by Avatar-A's write.

This verifies a more important law than single-instance rehearsal:

- the room transport and the terminal authority may live on different agenter processes
- invitation descriptors can cross process and port boundaries without changing truth ownership
- accepting from `agenter-A` does not accidentally re-home terminal authority away from `agenter-B`
- the final collaboration is genuinely cross-instance rather than an in-process shortcut

### Layer 4: Edge-condition discussion topics

These are the topics that should be explicitly discussed before or during implementation review:

- What is the default invitation TTL, and which backend clock is authoritative?
- Does re-inviting the same principal always replace the previous pending invitation, even when only expiry is being refreshed?
- If accept and revoke race each other, which durable ordering decides the winner?
- Should acceptance be idempotent for the same invited principal if the seat is already active?
- How is descriptor leakage explained in app terms, given that leaked links are still non-authoritative until the invited principal signs?
- When `TM` or room `admin` is accepted, how does the UI/CLI explain "you are an admin candidate but not necessarily the current admin right now"?
- How quickly do revoke and expiry effects propagate to already-issued active access tokens or write leases?
- In the dual-agenter case, which endpoint metadata must be embedded in the descriptor so the client can find the correct remote backend without confusing transport projection and authority ownership?

## Remaining Open Questions

These are refinement questions, not blockers for implementation start:

- Should the delivery layer later add a human-facing invitation preview page on top of the same descriptor contract?
- After terminal/message stabilize, what should the extracted backend/client architecture handbook include beyond this specific handshake?
