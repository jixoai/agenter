## Context

The persistence layer already centers on `session_cycle`, `cycleId`, and LoopBus cycle execution. The `round` naming only exists in the chat projection and its consumers. This change is a destructive rename that aligns the projection with the kernel without changing history ordering, optimistic send behavior, or live streaming behavior.

## Goals / Non-Goals

**Goals**
- Make the chat projection contract decision-complete around `cycle` terminology.
- Rename public APIs and internal helpers together so the implementer no longer has to translate between `round` and `cycle`.
- Preserve existing behavior: pending optimistic entries, live streaming, paging-before-cycle, and cycle rail navigation.

**Non-Goals**
- Change database schema names like `session_cycle`, which are already correct.
- Redesign the chat UI, cycle rail, or LoopBus storage model.
- Provide backward-compatibility aliases for old `round` routes or events.

## Decisions

### 1. Rename the projection contract, not the underlying behavior
- Decision: `ChatRound` becomes `ChatCycle`, `RuntimeChatRound` becomes `RuntimeChatCycle`, and all related collection/query helpers follow the same rename.
- Rationale: the behavior already models LoopBus cycles; only the naming is inconsistent.

### 2. Break external compatibility in one pass
- Decision: remove `chat.rounds`/`chat.roundsBefore` and `runtime.round.updated` outright, replacing them with `chat.cycles`/`chat.cyclesBefore` and `runtime.cycle.updated`.
- Rationale: mixed compatibility would prolong ambiguity and force every consumer to keep two names for the same concept.

### 3. Keep identifiers and ordering rules unchanged
- Decision: keep `id` in the form `cycle:<cycleId>` or `pending:<clientMessageId>`, keep `beforeCycleId`, and keep oldest-to-newest ordering.
- Rationale: these parts are already cycle-native and do not need migration.

### 4. Scope the rename to chat projection surfaces
- Decision: rename only the chat/streaming projection vocabulary, related tests, and UI text. Do not rename unrelated English usage of `round` (for example `Math.round` or ad-hoc loop counters).
- Rationale: avoids noisy churn and keeps the change decision-complete.

## Risks / Trade-offs

- [Consumer breakage] → Update app-server, client-sdk, WebUI, and tests in the same change so the workspace remains internally consistent.
- [Partial rename drift] → Use targeted grep validation for `ChatRound`, `RuntimeChatRound`, `chat.rounds`, `runtime.round.updated`, `activeRound`, and `chatRoundsBySession`.
- [Regression in optimistic/live merge] → Preserve merge semantics and cover them with existing runtime-store and session-runtime tests after renaming.

## Migration Plan

1. Rename app-server chat projection types, runtime snapshot fields, realtime events, and TRPC procedures.
2. Rename client-sdk output aliases, store fields, event handling, and paging methods.
3. Rename WebUI consumer props/helpers/tests to cycle-first terminology and keep UI behavior unchanged.
4. Run unit + DOM + targeted grep validation to confirm the old chat-round contract is gone.
