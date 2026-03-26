## Context

The frontend still explains the runtime through `LoopBus`, `inputs`, `facts`, and `reply`. That mismatches the current architectural direction and hides the new attention primitives from the product. The result is a Devtools surface that still tells the legacy story even though runtime code and user requirements are moving toward attention contexts, attention items, cycle frames, model calls, and trace.

## Goals / Non-Goals

**Goals:**
- Make attention the primary information architecture of Devtools.
- Keep cycles, model calls, and trace as complementary views instead of competing sources of truth.
- Add direct inspection for attention contexts and items, including cross-context relationships.
- Keep Chat conversation-first by moving technical attention detail behind explicit expert affordances.
- Tighten loading, empty, and heavy-subscription behavior for hot Devtools panels.

**Non-Goals:**
- Finalize runtime persistence or trace schemas; those belong to the runtime and trace changes.
- Rebuild the Chat composer or future chat-channel UX in this change.
- Preserve the current LoopBus-first vocabulary for backward compatibility.

## Decisions

### Devtools navigation becomes attention-first
The top-level Devtools experience will organize around attention contexts, cycles, model calls, trace, terminals, and tasks. `LoopBus` stops being a primary user-facing panel label.

Why: attention is the semantic model; cycles and trace are supporting inspection lenses.

Alternative considered: keep the existing LoopBus panel and add an attention tab beside it. Rejected because that preserves the wrong primary narrative.

### Context inspection becomes a first-class flow
Users can open a context directly, inspect its items, and traverse linked work without first entering a cycle row.

Why: the current UI makes attention feel secondary even though it is supposed to be the primary model.

Alternative considered: keep context data embedded only inside cycle detail. Rejected because it still makes cycles the accidental root object.

### Cycle detail becomes attention-linked rather than fact-bucket-based
Cycle detail will show attention refs, model-call records, merged tool traces, and egress outcomes. The old `inputs / facts / reply` sections are retired.

Why: flattened buckets are a symptom of the old architecture and obscure causal relationships.

Alternative considered: keep the old sections and append more attention metadata. Rejected because it creates duplication without solving the conceptual problem.

### Publication and loading are owned panel-by-panel
Each heavy Devtools panel owns its own selector subscriptions, loading states, empty states, and scroll viewport.

Why: the current hot-path performance issues come from broad subscriptions and over-eager derived projections.

Alternative considered: keep one larger mixed panel store and optimize later. Rejected because the information architecture refactor is the right moment to fix the ownership boundaries.

## Risks / Trade-offs

- [Users familiar with the old LoopBus naming will need reorientation] -> Mitigation: keep cycles, model calls, and trace visible so the new mental model remains inspectable.
- [Attention inspection can become too dense] -> Mitigation: use compact summary rows with progressive drill-down into structured detail.
- [Frontend refactor depends on runtime publication changes] -> Mitigation: anchor the design to explicit contracts from the runtime and trace changes instead of hand-built adapters.

## Migration Plan

1. Introduce attention-native runtime selectors and panel view-models in client-sdk/WebUI.
2. Add the attention contexts inspector and route-local loading state model.
3. Rework cycle detail to consume attention refs, merged tool traces, model calls, and egress outcomes.
4. Retire LoopBus-first panel naming and legacy fact/reply sections.
5. Prove the new surface through Storybook DOM contracts and desktop/mobile browser walkthroughs.

## Open Questions

- Whether contexts should be the default landing panel or whether Devtools should remember the last active panel per session.
- Whether related-item traversal should open in-place, in a side sheet, or through nested panel navigation on compact viewports.
