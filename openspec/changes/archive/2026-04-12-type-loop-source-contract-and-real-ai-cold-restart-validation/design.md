## Context

The previous attention cleanup fixed the model-facing side of the architecture, but the scheduler-side LoopBus protocol still has one generic escape hatch left:

- `LoopSourceRef.meta`
- `LoopSourceReadResult.meta`

Those fields are no longer fed into durable attention or prompt payloads, but they still violate the platform law because they let systems smuggle lookup context through an untyped bag instead of through protocol coordinates.

The biggest remaining app-risk is also now clearer: unit and integration tests prove that stop/start rebuilds runtime state, but the real-provider suite still does not prove that an Avatar can resume a real room + workspace task after cold restart. That gap matters more than another synthetic regression because recovery is now a first-class architectural promise.

## Goals / Non-Goals

**Goals:**
- Remove generic source-ref/read-result metadata from built-in LoopBus source contracts.
- Replace them with typed, minimal coordinates that are sufficient for adapter lookup and scheduler semantics.
- Keep AI-visible facts in attention body/presentation only.
- Add one real-provider restart-resume scenario that proves disk-backed continuation after `session.stop` / `session.start`.

**Non-Goals:**
- Do not redesign the real multi-avatar project-room flow in this change.
- Do not make terminal process persistence stronger than the current terminal-system law.
- Do not introduce a second runtime driver or CLI truth source outside the existing harnesses.

## Decisions

### 1. Replace open source-ref metadata with typed built-in source coordinates

`LoopSourceRef` will stop carrying a generic `meta` bag. Built-in systems will instead use typed coordinates:

- message ref: explicit `channelId`
- terminal ref: no extra lookup bag
- task ref: no generic metadata bag; AI- or dedupe-relevant facts stay in typed draft fields

Future systems may add their own typed source-ref variant, but they should not inherit a generic metadata escape hatch.

Alternative considered:
- Keep `meta` but document stricter usage.

Why not:
- That keeps the protocol philosophically open and makes future regressions too easy.

### 2. Remove generic read-result metadata entirely

`LoopSourceReadResult.meta` will be removed. If a source read needs to express stable scheduler-facing facts, they must be first-class fields such as:

- `kind`
- `fromHash`
- `toHash`
- `semanticHash`
- `viewHash`

If a source needs more AI-visible detail, it must promote that into `AttentionDraft.presentation` or the final attention body instead of leaving it in the read layer.

Alternative considered:
- Replace `meta` with another semi-open object like `lookupHints`.

Why not:
- That is just the same abstraction leak under a different name.

### 3. Message and task adapters keep all meaningful detail in body builders

Message source lookup only needs `channelId + messageId`. Task source invalidations only need stable subject identity plus typed semantic hints. Social envelope, attachment facts, task source path info, and similar AI-visible data stay in the draft content/presentation builders where they already belong.

Alternative considered:
- Move task file/path facts into source-ref fields even when they are only used for body rendering.

Why not:
- Those facts are not needed to re-read durable truth; moving them into source refs would widen scheduler payloads again.

### 4. Real recovery validation should extend the existing room-terminal flow

The new real-provider scenario will:

1. ask one Avatar to build and deliver a tiny app;
2. stop the runtime after delivery;
3. restart the same session;
4. send feedback in the same primary room;
5. require the Avatar to resume, recover terminal/workspace context if needed, and publish an updated delivery.

Success will prove:

- session identity stayed stable,
- room/workspace authority survived restart,
- attention/history facts were enough to continue,
- the updated URL serves the expected post-restart content.

Alternative considered:
- Build a dedicated restart-only synthetic scenario without the initial delivery.

Why not:
- Recovery is only meaningful if there was already real work, real room truth, and real delivery before the restart.

### 5. Failure evidence must show the pre/post restart boundary

If the real restart scenario fails, it will dump:

- recent room truth before and after restart,
- recent model calls after restart,
- runtime attention snapshot after restart,
- current workspace/room/terminal mounts if available,
- latest delivered URL and fetch body/error.

Alternative considered:
- Reuse the old failure output unchanged.

Why not:
- Restart failures need an explicit boundary, otherwise it is too hard to tell whether the problem happened before or after recovery.

## Risks / Trade-offs

- [Typed source refs may ripple through tests] → update focused LoopBus/runtime tests together with the contract change.
- [Future systems may need richer source coordinates] → allow new typed variants, but do not reopen a generic metadata bag.
- [Real restart scenario can be slower/flakier than the existing room delivery test] → keep it opt-in under the same real-provider gate and emit richer failure evidence.
- [Terminal state may legitimately disappear across stop/start] → the scenario will allow terminal recovery work, but it will still require the Avatar to reach a working updated delivery.

## Migration Plan

1. Update OpenSpec delta specs for typed source contracts and real restart validation.
2. Refactor LoopBus source-ref/read-result types and built-in adapter callers.
3. Update focused unit/integration tests for the new typed contract.
4. Add the real-provider cold-restart scenario and integration test entry.
5. Run focused backend tests plus opt-in real-provider validation.

Rollback strategy:

- none planned; this is a deliberate protocol tightening plus validation upgrade.

## Open Questions

- Future browser/os systems may want their own typed source coordinates; this change establishes the rule but does not predefine those variants.
