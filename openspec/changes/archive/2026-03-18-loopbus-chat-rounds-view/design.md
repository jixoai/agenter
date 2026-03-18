## Context

LoopBus already records cycle facts in `session_cycle`, `session_block`, and `model_call`, but the main chat UI still consumes a flat message list. That loses the round boundary users need to understand what a given AI turn reacted to, and it makes `/compact`, optimistic sends, and live output feel detached from the runtime lifecycle.

This change spans persistence, realtime runtime state, TRPC, client-side projections, and WebUI rendering. The design therefore needs one round model that is stable for history, cheap to page, and capable of showing live output before the current cycle is fully persisted.

## Goals / Non-Goals

**Goals:**
- Define one round projection that uses cycle facts as the historical source of truth.
- Keep the active round visible in runtime memory so the chat UI can stream partial output without token-level DB writes.
- Let the WebUI render chat as round cards plus cycle navigation, while preserving older message-oriented projections for other panels.
- Support optimistic user sends and round-based paging without duplicating entries.

**Non-Goals:**
- Persist token-by-token streaming output to `session.db`.
- Replace every consumer of the flat message list; only the main chat surface switches to rounds.
- Redesign LoopBus trace storage or compact orchestration beyond identifying compact rounds in the round model.

## Decisions

### 1. Historical rounds are projected from cycle facts
- Decision: build `ChatRound` from `session_cycle.collectedInputs`, `session_block.cycleId`, and `model_call.cycleId`.
- Rationale: these tables are already the durable facts for what each cycle collected and produced. They express the round boundary directly and avoid reconstructing it from trace logs.
- Alternative considered: derive rounds from loopbus traces or replay the flat chat list. Rejected because traces are diagnostic, not product-facing truth, and flat messages lose the cycle boundary.

### 2. Live streaming stays in runtime, not in the database
- Decision: `SessionRuntime` keeps an `activeRound` object with `pending/collecting/streaming/applying` states and emits `runtime.round.updated` events.
- Rationale: users need immediate feedback, but token-level persistence would bloat `session.db` and complicate rollback. Persist only the settled facts; keep the transient stream in memory.
- Alternative considered: write partial assistant output into `session_block` on every stream chunk. Rejected because it turns a transient UI concern into heavy storage churn.

### 3. Client merges three sources into one round timeline
- Decision: `RuntimeStore` merges historical rounds, the current `activeRound`, and an optimistic round created at send time. Matching uses `clientMessageId` so the persisted cycle can replace the pending round.
- Rationale: this yields immediate user feedback, preserves live assistant output, and converges onto the persisted cycle without duplicate cards.
- Alternative considered: wait until `session_cycle` exists before showing anything in chat. Rejected because it causes visible lag after Enter and breaks the round-centric UX.

### 4. WebUI virtualizes rounds, not individual messages
- Decision: `ChatPanel` renders one virtual row per round, and each row internally renders collect/output blocks plus merged tool activity. A separate cycle rail navigates by round index.
- Rationale: the user mental model is a LoopBus round, not a message fragment. Virtualizing at the round level keeps scroll math aligned with the rail and reduces DOM churn for tool-heavy turns.
- Alternative considered: keep message-level virtualization and derive round markers visually. Rejected because the scroll model and navigation model diverge.

### 5. Flat chat messages remain available as a fact stream
- Decision: existing message projections stay intact for other views and diagnostics, while the main chat surface consumes rounds.
- Rationale: this is the minimal change that improves the chat UX without forcing every downstream consumer onto the new model immediately.

## Risks / Trade-offs

- [Live/history merge can duplicate or regress a round] → Match persisted rounds to optimistic/live rounds by `clientMessageId`, and keep the richer live copy when the historical page is still incomplete.
- [Round virtualization can hide regressions in small datasets] → Fall back to inline rendering for short timelines and keep focused chat panel tests for both modes.
- [Paging by cycle cursor can create ordering bugs] → Use `beforeCycleId` APIs, sort by `createdAt/cycleId`, and cover append/merge behavior in store tests.
- [Other panels still depend on flat messages] → Preserve existing chat message projections so the round rollout stays scoped to the main chat surface.

## Migration Plan

1. Add `ChatRound` projection helpers and session-db queries for cycle-based history.
2. Extend `SessionRuntime`, realtime events, and TRPC endpoints with active round and round paging support.
3. Update `RuntimeStore` to merge historical, live, and optimistic rounds.
4. Switch WebUI chat to consume rounds and expose cycle navigation.
5. Verify with app-server, client-sdk, and WebUI tests before merging.

Rollback: revert the WebUI to the flat message projection while leaving the new round APIs unused. The change is additive at the storage layer.

## Open Questions

- Whether Devtools should also adopt the round timeline later, or remain message/trace oriented.
- Whether future compact-specific UX needs a dedicated visual treatment beyond `kind: compact`.
