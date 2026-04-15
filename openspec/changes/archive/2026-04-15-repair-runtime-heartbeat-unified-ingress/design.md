## Context

Real browser verification on April 14, 2026 exposed a split-brain Heartbeat ingestion model:

- structured AI-visible request/response facts are persisted as `heartbeat_part`
- older runtime chat-style ingress facts are still persisted as `heartbeat`
- the WebUI Heartbeat panel hydrates only `heartbeat_part + request_aux`

That means the browser can legitimately show `No Heartbeat rows yet` even when `session.db` already contains a durable room/user ingress row. The bug is architectural, not cosmetic: one operator surface currently depends on two storage semantics, but only one of them is published into the client slice.

## Goals / Non-Goals

**Goals:**

- Make the Heartbeat inspection feed publish every durable row the Heartbeat tab needs to tell the runtime story, including room/user ingress rows that still land in legacy `heartbeat`.
- Preserve one ordered session-local Heartbeat slice across cold hydration, older-page pagination, and live events.
- Avoid duplicate assistant rows when the runtime already emits richer `heartbeat_part` response rows.
- Keep the fix compatible with the current renderer contract so browser behavior improves without a second redesign round.

**Non-Goals:**

- Do not redesign Heartbeat visuals in this change.
- Do not fully delete legacy `heartbeat` persistence in this change.
- Do not solve provider-selection or real-model configuration drift in this change.

## Decisions

### Decision: Heartbeat inspection pagination will read a unified ingress scope set

`runtime.heartbeatPartsPage` will page a merged stream over:

- `heartbeat_part`
- `heartbeat`
- `request_aux`

Rationale:

- The operator-facing Heartbeat contract is “show the durable runtime story”, not “show only one internal storage subtype”.
- Existing WebUI Heartbeat rows already accept generic `SessionMessageRecord` data, including legacy `heartbeat` rows with `partType: message`.
- This fixes cold-load and reload blindness without inventing a second API.

Alternative considered:

- Read only `heartbeat_part` and require all producers to migrate first.
  Rejected because the browser would stay blind until every ingress producer is rewritten, which prolongs a known observability breach.

### Decision: Live Heartbeat publication will project legacy ingress rows only when they do not already have a richer structured twin

`SessionRuntime.recordChatMessage(...)` will emit a `heartbeatPart` event for persisted legacy `heartbeat` rows only for ingress rows that currently exist only in that scope, such as user room ingress. Assistant response rows will continue to rely on the structured `heartbeat_part` publication path.

Rationale:

- The browser must update when a room/user ingress row is durably recorded.
- Blindly emitting every legacy `heartbeat` row would duplicate assistant output because assistant replies already have `heartbeat_part` records with better structure.

Alternative considered:

- Emit all legacy heartbeat rows as live Heartbeat rows.
  Rejected because it would create duplicate assistant/compact observations and force the client to guess which row is authoritative.

### Decision: The migration stays additive for now, with explicit follow-up room for full scope collapse

This change keeps legacy `heartbeat` writes in place and widens the inspection feed instead of attempting a same-turn destructive migration to `heartbeat_part`-only persistence.

Rationale:

- The operator bug is urgent and user-visible.
- A full producer migration needs a broader audit of chat history, ledger projections, and archive compatibility.
- The unified feed repair gives the browser a correct story immediately and creates a safe platform for later storage collapse.

Alternative considered:

- Replace every legacy `heartbeat` write with `heartbeat_part` immediately.
  Rejected for this change because it is a larger paradigm migration and would mix urgent observability repair with a broader ledger rewrite.

## Risks / Trade-offs

- [Duplicate row risk] → Limit live legacy projection to ingress rows that lack structured twins, and add regression coverage for assistant row deduplication.
- [Ordering drift across mixed scopes] → Keep paging merged by durable timestamp/id order and verify with router/store tests.
- [Future semantic debt from dual scopes] → Record this change as an additive repair and keep the later full scope collapse as a separate follow-up.
