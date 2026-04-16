## Context

The current Heartbeat surface already has the correct durable-law direction: `message-parts` remain the single runtime truth, tool lifecycle is persisted as invocation-first rows, and grouped Heartbeat queries project those rows for the WebUI. The current regressions sit one layer above that truth:

- the footer context block is a bespoke local widget instead of the shared AI-elements `Context` primitive;
- running group durations only update when fresh data arrives;
- the top pagination affordance is absolutely overlaid on top of the transcript instead of owning a reserved lane;
- running tool parameters are not always surfaced when later invocation input hydration arrives;
- Heartbeat config saves can emit YAML-style text into JSON-backed settings files.

This change therefore targets the projection/editing layer, not the durable ledger. The goal is to preserve objective storage while making the runtime surface faithfully reflect that truth during live operation.

## Goals / Non-Goals

**Goals:**

- Keep Heartbeat grounded in durable grouped message-parts truth rather than introducing new frontend-local transcript synthesis.
- Replace the bespoke footer context block with the shared AI-elements `Context` composition while keeping status and usage objective.
- Make running group durations update from wall-clock time independently of Heartbeat event arrival.
- Keep top-of-stream pagination in the transcript flow and show an explicit loading treatment during older-page fetches.
- Ensure later invocation argument hydration appears on the same running tool row before completion.
- Ensure Heartbeat config saves round-trip valid JSON for JSON-backed layers and keep runtime knobs under canonical top-level `ai.*` paths.

**Non-Goals:**

- Redesign the durable `message_parts` or `ai_call` schema.
- Reintroduce compatibility glue for legacy Heartbeat wrapper rows.
- Redefine grouping semantics beyond the already accepted `before-call` / `call` / `compact` model.
- Solve provider pricing completeness beyond graceful degradation when metadata is missing.

## Decisions

### 1. Preserve objective ledger truth and fix projection above it

The change will not mutate Heartbeat rows at write time to “help” the UI. Tool-call intent, result, config facts, and assistant parts remain durably recorded exactly as they are observed. Any grouping or presentation repair happens either in grouped query projection or in the Svelte surface.

Alternative considered:

- Write additional synthetic rows or rewrite existing rows during streaming to make the UI easier.

Why rejected:

- It violates the user’s explicit requirement that persistence stay objective and makes later inspection/debugging less trustworthy.

### 2. Running tool parameter visibility will stay query-driven, not client-side reconstructed

The WebUI already treats grouped Heartbeat pages as the canonical render input. We will keep that law: when a running invocation receives richer durable input, the runtime publication path must invalidate or refresh the grouped Heartbeat slice so the same grouped row repaints with parameters. We will not introduce a second frontend-only merge path for running tool args.

Alternative considered:

- Merge raw `runtime.heartbeatPart` events directly into grouped UI state in the browser.

Why rejected:

- It duplicates grouping logic client-side and risks diverging from the grouped query contract.

### 3. Live elapsed duration belongs to a narrow wall-clock projection, not store churn

Running group headers need a clock that advances even when no runtime event arrives. That should be implemented as a small local wall-clock dependency scoped to visible running groups, rather than forcing the runtime client to republish the whole grouped Heartbeat slice every second.

Alternative considered:

- Emit periodic runtime publication updates just to refresh elapsed time.

Why rejected:

- It would create artificial store churn and violate the existing runtime-publication stability law.

### 4. Top pagination affordance must become flow content owned by the virtualized stream

The current absolute overlay causes overlap with the first group card. The pagination affordance should instead occupy a reserved top lane that participates in the scroll surface. During loading, the same affordance region should switch to a disabled loading treatment rather than moving elsewhere.

Alternative considered:

- Keep the overlay and increase top padding heuristically.

Why rejected:

- That is fragile, depends on magic spacing, and breaks again as soon as sizing or density changes.

### 5. Settings saves must be format-aware and schema-pointer-aware

Heartbeat config editing is not a free-form text editor. It is a schema-aware writer for an editable settings layer. The save path must therefore:

- preserve the layer’s file format;
- write valid JSON when the target file is JSON-backed;
- persist runtime knobs at canonical top-level `ai.*` pointers, including `ai.thinking`;
- avoid mutating `ai.providers.*` when the operator is editing next-call runtime knobs.

Alternative considered:

- Continue using YAML document rewriting for all editable layers regardless of extension.

Why rejected:

- It corrupts JSON-backed layers and breaks the settings loader’s contract.

### 6. Footer context must use the shared AI-elements primitive, not a local imitation

The footer context surface will be rebuilt around the AI-elements `Context` primitive family so trigger/content/header/body/footer remain aligned with the shared design system. The runtime-specific logic should only supply model id, token usage, max context, and optional estimated cost inputs.

Alternative considered:

- Keep the custom footer block and restyle it to look closer to the demo.

Why rejected:

- It preserves divergence from the shared component contract and makes later upgrades harder.

## Risks / Trade-offs

- [Risk] Live running timers could trigger too many rerenders in a long transcript. → Mitigation: scope ticking to visible running groups and avoid invalidating non-running rows.
- [Risk] Query-driven invocation refresh may still feel delayed if invalidation is coalesced too aggressively. → Mitigation: ensure invocation input hydration emits the same grouped-slice refresh path as completion events and cover it with runtime/client tests.
- [Risk] Moving the top pagination affordance into flow content may require virtualizer measurement changes. → Mitigation: treat the affordance as an explicit lane with deterministic sizing and verify blank-space regressions against the grouped virtualizer tests.
- [Risk] Existing malformed JSON settings files may already be on disk from earlier buggy saves. → Mitigation: keep write logic strict going forward and surface loader/save errors instead of silently preserving corrupted content.

## Migration Plan

1. Update the grouped Heartbeat publication and UI surface without changing durable ledger schemas.
2. Replace the footer context block with the shared AI-elements `Context` composition.
3. Move top pagination into a reserved in-flow lane and add the loading treatment.
4. Switch runtime settings saves to a format-aware serializer and canonical top-level `ai.*` writes.
5. Validate with unit/integration coverage plus real Heartbeat runtime walkthroughs.

Rollback is low-risk because this change does not introduce a new storage schema. Reverting the WebUI/publication code returns the system to the prior projection behavior.

## Open Questions

- None at the architecture level. Provider pricing-band richness remains an input-data completeness problem, not a blocker for this change.
