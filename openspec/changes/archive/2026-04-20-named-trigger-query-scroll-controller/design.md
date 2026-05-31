## Context

The previous two anchored scroll rounds established two durable ideas:

- anchored virtual long lists need a dedicated scroll law, not a stretched `ScrollView`
- one viewport must resolve through one effective scroll writer at a time

Those rounds also exposed the next architectural gap. The runtime already contains a transaction kernel, but the public authoring model is still too imperative and too local:

- `request(...)` is still a manual dispatch surface
- `notifyMutation(...)` leaks mutation-to-scroll mapping into consumer code
- `transact(...)` is still exposed broadly enough that multiple layers can compete for ownership
- scroll observations such as `atLatest`, `userInput.active`, insert batches, or older-page deltas are not represented as named facts with stable query structure

If we stop here, each future chat-like surface will keep rebuilding a partial observer system around the shared package.

## Goals

- Make named triggers the only reusable fact-publishing model for anchored virtual list scroll behavior.
- Make `query.<name>.*` the only durable way for programs to inspect scroll-relevant facts.
- Keep `tx(...)` as the only side-effect surface, and expose it only through the installed program controller.
- Preserve the existing tx/arbitration kernel as the low-level execution engine instead of rewriting browser scroll execution again.
- Migrate WebChat and Heartbeat to the new law and prove it through Storybook contracts.

## Non-Goals

- Generalize this law to every non-anchored scroll surface.
- Remove the internal tx kernel or native browser scroll transport.
- Add a public derived-query registry in the same round.
- Depend on high-cost per-frame metrics for standard WebChat / Heartbeat flows.

## Decisions

### Introduce a named trigger namespace instead of one global scroll state object

Each trigger registers a single JS-safe name at connect time. The controller exposes a query tree where each subtree belongs to exactly one trigger family, for example:

- `query.edge.atLatest`
- `query.userInput.active`
- `query.returnToLatest.fired`
- `query.transportDelta.direction`

This avoids a monolithic `ScrollTriggerState` type and keeps trigger families orthogonal.

### Keep trigger families split into base and high-order layers

Base triggers map directly to browser capabilities:

- `VisibilityTrigger`
- `ResizeTrigger`
- `ActionTrigger`
- `UserInputTrigger`
- `ScrollMetricsTrigger`

High-order triggers are programmed from browser capabilities plus a small amount of host logic:

- `EdgeTrigger`
- `OverflowTrigger`
- `CollectionDeltaTrigger`
- `MaterializationTrigger`
- `InsertBatchTrigger`

This keeps the vocabulary future-facing and aligned with the Web platform's direction without forcing every consumer to hand-roll the same observers.

### Preserve the tx kernel and wrap it in a new public controller

The current anchored virtual list controller already owns:

- browser scroll planning and execution
- request prioritization
- user-input interruption
- guarded await points
- insert-motion reconciliation hooks

That execution kernel remains correct. The refactor therefore adds a new public controller layer around it instead of replacing it:

- named trigger registration
- query graph flushing
- program installation
- program-only `tx(...)`

### Flush query changes once and treat edge fields as one-cycle facts

Trigger changes are coalesced:

- event / observer trigger changes flush in a microtask
- frame-cost trigger changes flush in RAF
- each flush runs the installed program at most once

Fields such as `entered`, `exited`, `fired`, and `changed` are edge facts that live for one flush cycle. Stable facts such as `atLatest`, `active`, or `overflowing` persist.

### Do not add a public derived-query registry

This round keeps derived state local to the program:

```ts
const q = controller.query;
const canAutoFollowLatest =
  q.edge.atLatest &&
  !q.userInput.active &&
  q.transportDelta.changed &&
  q.transportDelta.direction === "append";
```

That keeps the shared law minimal and avoids adding another registry surface before the trigger model settles.

### Migrate feature code by deleting old ownership paths, not by stacking another helper layer

The end state must remove business-path usage of:

- `request(...)`
- `notifyMutation(...)`
- raw `transact(...)`
- direct `scrollTop` writes for semantic actions

Compatibility shims may remain inside the shared package during migration, but feature code, Storybook harnesses, and route code must move to named triggers and installed programs.

## Migration Shape

1. Add the new public controller and trigger families to `@agenter/svelte-components`.
2. Keep the old controller as the internal tx/arbitration kernel.
3. Update `AnchoredVirtualList` to expose the new controller alongside compatibility handle bindings during migration.
4. Move Storybook capability labs to the new controller first so the architecture is inspectable.
5. Migrate `web-chat-view`, `VirtualConversation`, and `Heartbeat` to installed programs and named triggers.
6. Update durable specs after the new public model lands.

## Risks

- [Risk] Query edges become hard to reason about.  
  Mitigation: keep each trigger family's query shape separate and add unit tests per family.

- [Risk] The new controller becomes a thin shell that still leaks old imperative APIs into consumers.  
  Mitigation: migrate Storybook harnesses and app code in the same round instead of only exporting the new runtime.

- [Risk] Insert-batch and collection-delta programs regress pinned-latest behavior.  
  Mitigation: keep the existing tx kernel, preserve Storybook append/prepend race contracts, and add explicit interruption matrix coverage.
