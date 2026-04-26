## Context

The current codebase has already moved the runtime toward three clearer layers:

- `@agenter/loopbus-kernel` owns neutral delivery attempts, receipts, and projections.
- `RuntimeKernelHost` mounts Message, Terminal, and Skill adapters instead of making each source system mutate kernel internals directly.
- `message-system` now uses `ref` as same-room reply context and visible room revision happens through explicit `message send`, `message edit`, and `message recall`.

The remaining problem is not mainly runtime behavior. It is contract drift: durable specs and package comments still contain old `egress` wording that suggests committed attention can directly route visible effects. Separately, terminal admin-group candidates are persisted both as terminal metadata and as `terminal_admin_candidate` rows, which creates an unnecessary second truth surface.

## Goals / Non-Goals

**Goals:**

- Make current specs and comments match the current runtime law: attention commits are cognitive facts, delivery truth is dispatch/receipt, and room-visible changes use explicit message mutations.
- Preserve `session-system` as a factual AI-call ledger and document that role clearly.
- Preserve `AttentionSystem` as a pure `Context + Items` information carrier and document that role clearly.
- Remove terminal admin-candidate duplication so one canonical table owns failover order.
- Add focused BDD tests that catch regressions without depending on brittle private implementation order.

**Non-Goals:**

- Do not redesign LoopBus scheduling or ModelClient delivery receipt logic.
- Do not rewrite message revision behavior; it already has separate coverage and real-provider validation.
- Do not split `terminal-system` into multiple packages in this change.
- Do not introduce compatibility shims for the metadata mirror; this cleanup is explicitly allowed to be breaking.

## Decisions

### 1. Treat `egress` as obsolete current-law vocabulary

Current room output is not routed by hidden attention egress descriptors. The AI must call `message send`, `message edit`, or `message recall`, and the runtime records delivery attempts through dispatch/receipt facts. Specs that still say linked egress refs or message egress adapters will be updated or marked removed.

Alternative considered: keep `egress` as an alias for delivery. Rejected because it keeps the same ambiguity that caused messageSystem/rootId confusion: one word would mix "visible output", "delivery attempt", and "adapter side effect".

### 2. Document AttentionSystem as `Context + Items`

`AttentionSystem` should not be described as only an unfinished-work ledger. A score can create scheduling pressure, but the broader abstraction is an information carrier: Context is the current cognitive snapshot, and commits/items are objective or subjective facts that can change that snapshot.

Alternative considered: rename all attention item types now. Rejected because the current data structure already expresses commits and context state well enough; the immediate problem is reader misunderstanding.

### 3. Document session-system as an AI-call historian

`session-system` persists objective AI-call-adjacent facts: message parts, ai_call lifecycle, dispatches, and receipts. It may look broad because it records many surrounding facts, but that breadth is intentional for inspection and reconstruction.

Alternative considered: move dispatch/receipt persistence out of session-system now. Rejected because the current store is already the durable historian for AI-call inspection; moving it would be a larger storage migration without solving the immediate misread.

### 4. Make terminal admin candidates table-only truth

`terminal_admin_candidate` is the canonical ordered failover truth. `terminal_catalog.metadata_json.adminGroupCandidateIds` is only a duplicate mirror and should stop being written. Reads should continue to use the existing table-backed APIs.

Alternative considered: keep metadata as a cache. Rejected because it is not needed for performance and it tempts future code to read stale metadata instead of the canonical table.

## Risks / Trade-offs

- [Risk] Removing metadata writes may break a hidden consumer reading `metadata.adminGroupCandidateIds`. -> Mitigation: add tests around public terminal control-plane behavior and treat hidden metadata consumption as invalid after this breaking cleanup.
- [Risk] Updating old egress specs may look like losing historical design intent. -> Mitigation: archive history remains untouched; only current specs and durable package docs are changed.
- [Risk] Comment-only clarification can drift again. -> Mitigation: add tests that assert current attention commits do not expose `egress` and terminal records do not mirror admin candidates in metadata.

## Migration Plan

1. Update OpenSpec delta specs to define the new/current law.
2. Add targeted BDD tests for terminal admin candidate metadata dedupe and current attention/session law.
3. Update package comments and durable specs.
4. Remove terminal metadata mirror write.
5. Run targeted backend tests, including existing message ref/revision and delivery receipt tests.

Rollback is straightforward: revert this change as one unit. Because the terminal metadata mirror is intentionally removed, partial rollback should not leave specs saying table-only while code still writes metadata.

## Open Questions

None for this cleanup. A future package split for terminal core vs control-plane can be proposed separately if terminal internals continue to grow.
