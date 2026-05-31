## Context

The current message-system surface regressed into a room-centric operator page with a permanently expanded user rail. At the same time, the control plane persists only `from` display text on `MessageRecord`, so the shared chat renderer cannot distinguish same-label actors or render "mine vs others" from a stable viewer perspective. The shared `@agenter/web-chat-view` package also still owns transcript scrolling through raw overflow, but `ScrollView` currently exists only inside `@agenter/webui`, which makes the current rule impossible to satisfy without a shared primitive.

## Goals / Non-Goals

**Goals:**
- Preserve durable sender actor identity on every room message.
- Separate viewer perspective from send authority so message rendering and token choice stop interfering with each other.
- Restore a chat-first operator flow, with room management moved into a dedicated dialog.
- Make shared chat transcript scrolling obey one reusable `ScrollView` contract across packages.

**Non-Goals:**
- Redesign the underlying room grant model or candidate-admin semantics.
- Introduce a second room-specific transport model outside the existing message control plane.
- Build a full end-user chat app; this change is scoped to operator-facing message-system and the shared web chat surface.

## Decisions

### 1. Add `senderActorId` to durable room message facts

`MessageRecord` will gain a canonical sender identity field, tentatively `senderActorId: MessageActorId | undefined`, while retaining `from` as the display label shown to humans. App-server send paths, message DB persistence, snapshot/page payloads, and transport deltas will all carry that field unchanged.

Why:
- Viewer alignment must be identity-based, not label-based.
- Same visible labels are explicitly legal in this system.
- UI-only heuristics cannot recover a fact that was never persisted.

Alternative rejected:
- Infer sender identity from the current grant, participant label, or `channel.participantId`. This fails under duplicate labels, replay, refresh, and cross-seat viewing.

### 2. Split viewer identity from caller token in route state

`messages-route` will maintain independent per-room state for:
- `viewerActorId`
- `callerAccessToken`

The viewer selection will only affect transcript projection. The caller selection will only affect message submission authority.

Why:
- An operator may inspect the room as one actor while sending as another authorized actor.
- Coupling these states causes accidental token switches and incorrect alignment.

Alternative rejected:
- Make `Send as` implicitly define the viewer. This looks convenient but collapses two different concepts and breaks auditability.

### 3. Move room management into a dialog-backed control surface

The route body will become chat-first: room rail + transcript/composer. Room administration, membership, and read-state inspection will move into a `Dialog` with sidebar-style sections such as overview, members, and access.

Why:
- Chat is the primary operator task.
- Persistent administration chrome steals width and attention from the transcript.
- Dialog sections scale better as membership and read-state features grow.

Alternative rejected:
- Keep the right rail and keep adding sections. This continues the same cluttered information architecture the user already rejected.

### 4. Extract `ScrollView` into a shared Svelte primitive package

The current `ScrollView` lives under `@agenter/webui`, which `@agenter/web-chat-view` cannot depend on because `webui` already depends on `web-chat-view`. This change will introduce a shared Svelte primitive package that exports `ScrollView`, then migrate `webui` and `web-chat-view` to consume that same primitive.

Why:
- The scroll contract must be shared, not duplicated.
- Cross-package import from `web-chat-view` into `webui` would create an invalid dependency cycle.
- A shared Svelte primitive is the smallest orthogonal atom that solves the problem.

Alternative rejected:
- Reimplement a second private scroll viewport inside `web-chat-view`. That would satisfy the UI symptom while violating the contract and reintroducing drift.

### 5. Keep `@agenter/web-chat-view` as the shared Svelte custom-element package

The package already has the correct architectural role: one reusable chat transport/view package that can ship a custom element. The fix is to upgrade its contract and internal composition, not to fork route-local chat code back into `webui`.

Why:
- Shared room transport/rendering belongs in one package.
- The user explicitly wants complex shared components migrated or kept in reusable non-React form.

Alternative rejected:
- Rebuild a second chat renderer directly in `webui`. That would fork durable chat behavior and break reuse.

## Risks / Trade-offs

- [Message schema migration] Existing room rows do not have sender actor identity. → Mitigation: keep the field optional for historical rows and fall back to existing display-only behavior only for legacy data.
- [Shared primitive extraction churn] Moving `ScrollView` out of `webui` touches imports and tests. → Mitigation: extract without changing public behavior first, then migrate consumers incrementally.
- [Viewer/caller UX complexity] Two selectors can confuse operators if poorly labeled. → Mitigation: place viewer context near transcript header and keep `Send as` inside composer scope.

## Migration Plan

1. Introduce the shared Svelte `ScrollView` primitive package and migrate `webui` imports.
2. Extend message-system types, DB, and transport payloads with `senderActorId`.
3. Update app-server send/snapshot/page paths to populate and expose the new durable fact.
4. Upgrade `@agenter/web-chat-view` to accept explicit viewer identity and consume the shared `ScrollView`.
5. Rebuild `messages-route` and `message-system-surface` around chat-first layout plus dialog management.
6. Add BDD/DOM regression coverage for same-label actors, viewer switching, and room management flow.

## Open Questions

- None. The required architecture is already implied by the existing user direction: canonical actor truth, chat-first flow, and shared scroll ownership.
