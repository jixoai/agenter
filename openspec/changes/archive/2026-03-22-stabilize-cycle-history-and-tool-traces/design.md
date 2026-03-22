## Context

`RuntimeStore.clearRuntimeState()` currently clears `chatCyclesBySession`, so a stopped session can lose persisted cycle inspection data even though history still exists on disk. Separately, `CycleInspectorDetail` still renders technical messages individually, so tool-call and tool-result are not paired into one coherent trace card.

## Goals / Non-Goals

**Goals:**
- Preserve persisted cycle/chat history across runtime state clearing.
- Merge tool-call/result records by shared call identity.
- Keep cycle detail scroll behavior stable.

**Non-Goals:**
- Redesign Chat transcript presentation.
- Add new backend persistence tables.
- Expand terminal inspection in this change.

## Decisions

### Runtime clearing only removes volatile state
Clearing runtime state removes live runtime data, terminal snapshots, and volatile recording state, but not persisted chats/cycles already loaded into the client store.

Why: the user still needs to inspect prior cycles after stop or abort.

### Tool traces are assembled before rendering
Cycle detail first groups technical messages by tool call identity, then renders one structured card per pair.

Why: the UI already has a `toolTrace` rendering path, so the missing step is normalization, not a new component model.

### Timeline and detail keep separate scroll owners
The timeline owns its own scroll viewport and detail owns its own scroll viewport; the parent panel stays overflow-hidden.

Why: this preserves predictable interaction on desktop and narrow layouts.

## Risks / Trade-offs

- [Legacy records] -> older tool messages may not have ideal pairing metadata, so grouping needs a stable fallback.
- [Store staleness] -> preserving persisted cycles must not also preserve stale live runtime projections.
- [DOM regression] -> scroll fixes can regress virtualization if measurement ownership changes incorrectly.

## Migration Plan

1. Narrow runtime-store clearing to volatile runtime slices only.
2. Normalize technical messages into merged tool traces in cycle detail.
3. Keep scroll ownership explicit in cycle timeline/detail.
4. Add store, DOM, and Storybook regression coverage.
