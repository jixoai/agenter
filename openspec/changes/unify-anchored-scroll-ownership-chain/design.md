## Context

The previous `codify-anchored-virtual-list-scroll-law` change solved the first-order problem: conversation surfaces now have semantic targets, transaction-aware scroll requests, and a shared host adapter instead of route-local raw `scrollHeight` math. That change was directionally correct, but it left one architectural hole open: multiple layers still retain permission to write the viewport.

Today the scroll runtime is split across at least three strata:

- the shared controller can preserve append/prepend mutations during `commit()`
- the timeline/render layer can correct insert-motion batches and imperative helpers
- feature consumers can still compose follow-up preserve/pin behavior around the transaction

That means the platform law already talks about one active transaction, but the implementation still behaves like stacked local scroll managers. The symptom is not just visual jitter; it is a law violation. One viewport can receive multiple terminal writes for the same mutation batch, which makes ordering, cancellation, and ownership impossible to reason about.

This change is therefore not a cosmetic cleanup. It is a second-step paradigm shift: keep the semantic transaction model from the previous round, but tighten it into a single-owner runtime where all scroll choreography flows through one ownership chain and one terminal writer.

## Goals / Non-Goals

**Goals:**

- Define a durable single-writer law for anchored virtual list viewports.
- Evolve transaction orchestration from a single closure helper into an ownership-chain runtime that can host shared middleware-style programs.
- Remove direct viewport writes from timeline/render hooks and feature-level mutation handlers.
- Re-express append/prepend preserve, latest pinning, older reveal, and insert-motion compensation as transaction-owned shared programs.
- Keep browser-native scroll transport first-class by letting the terminal writer use native `scrollTo` / `scrollIntoView` semantics and lifecycle signals such as `scrollend`.
- Make Storybook the acceptance surface for ownership conflicts and race reproduction.

**Non-Goals:**

- Introduce a custom scrollbar or require scrollbar-specific public API.
- Generalize this runtime to every `ScrollView` surface in the repository.
- Solve renderer-tiering, CodeMirror churn, or all remaining performance work in the same round.
- Depend on future CSS proposals as required runtime behavior, even if their vocabulary informs the API.

## Decisions

### Enforce one effective terminal scroll writer per viewport

The anchored virtual list runtime will now distinguish between:

- fact producers: host/timeline/feature layers that observe mutations, measurements, or visibility
- ownership programs: shared transaction middleware that decide what scroll outcome should happen
- the terminal writer: the only runtime layer allowed to issue browser scroll commands

Any layer above the terminal writer may publish mutation facts or scroll plans, but it may not directly write `scrollTop`, `scrollTo`, or an equivalent viewport mutation.

Alternative considered:

- Keep controller preserve logic and timeline preserve logic as separate "well-behaved" writers.
  - Rejected because two well-intentioned writers are still two owners. Ownership becomes probabilistic rather than declarative.

### Upgrade transaction orchestration into an ownership chain

The runtime will move from "single closure with helpers" toward a chained program model:

- shared programs run in order against the same transaction context
- each program may either handle the transaction or delegate with `await next()`
- once a program delegates, downstream ownership decides the terminal scroll outcome
- the runtime preserves structured abort semantics: transaction-owned await points still throw when ownership is lost

This keeps the expressive value of `transact(...)` while making ownership explicit. The public consumer story stays semantic; the internal composition story becomes middleware-like rather than ad-hoc callbacks.

Alternative considered:

- Replace `transact(...)` entirely with declarative config objects for every common mutation pattern.
  - Rejected because it regresses back to closed semantic bundles and reduces the orchestration freedom that made the transaction model valuable.

Alternative considered:

- Expose unrestricted multiple writer hooks and rely on ordering discipline.
  - Rejected because it encodes conflict as convention instead of law.

### Treat host and timeline code as fact publishers, not scroll owners

`bottom-anchored-timeline.svelte`, insert-motion controllers, and consumer harnesses still have valuable knowledge:

- inserted element selectors
- measured growth
- whether a batch is `latest` or `older`
- whether the runtime is at a meaningful edge

That information should remain available, but only as facts attached to the active transaction. The timeline layer will no longer correct the viewport directly when insert motion starts; instead it will publish batch facts that a shared ownership program can consume.

Alternative considered:

- Leave insert-motion compensation local to the timeline because it has the measurements.
  - Rejected because measurement locality does not justify scroll ownership; the proper shape is "publish measurement, let the runtime decide."

### Keep native-first execution, with frame-driven work only as a bounded internal tactic

The runtime philosophy remains semantic and platform-facing:

- prefer `scrollTo` / `scrollIntoView`
- prefer `scrollend`, DOM settle, and observer signals for lifecycle
- use `overflow-anchor` and related CSS features as hints, not as the sole source of truth
- only fall back to frame-driven waiting during active transactions when materialization or measurement genuinely requires it

This keeps the runtime aligned with the Web platform's direction without pretending the platform already solves virtual anchored lists by itself.

Alternative considered:

- Build a permanent rAF work loop as the primary execution model.
  - Rejected because it raises baseline cost and makes ownership less legible.

### Migrate consumers by deleting old writers, not by layering adapters on top

The migration strategy is intentionally destructive:

- controller-side direct preserve writes move into shared ownership programs
- timeline-side insert-motion corrections move into shared ownership programs
- consumer-side reveal/follow logic becomes transaction plans, not viewport writes

This may temporarily break stories or consumers during migration, but it is the only way to make the new law observable and enforceable.

Alternative considered:

- Keep old imperative helpers as a compatibility layer under the new runtime.
  - Rejected because the compatibility layer would preserve the exact conflict surface this change is meant to eliminate.

### Prove the law through interruption matrices, not just happy-path traces

The original regression proof only covered steady-state append/prepend success. That is necessary but insufficient for chat-like surfaces, because the real failure mode is ownership conflict while the viewport is already moving. The acceptance surface therefore needs two layers of evidence:

- primitive capability lab contracts that combine semantic requests with wheel, keyboard, and direct-manipulation interrupts
- consumer-level WebChat contracts that drive the actual latest affordance, then interrupt it and verify the transcript remains under user ownership

Alternative considered:

- Rely only on controller unit tests for interruption semantics.
  - Rejected because unit tests can prove arbitration rules, but they cannot prove that host wiring and Storybook-visible DOM state still obey the law once virtualization, affordances, and real browser scrolling are involved.

## Risks / Trade-offs

- [Risk] The runtime becomes harder to understand than a simple `scrollToLatest()` helper. → Mitigation: keep the public surface semantic, and move composition complexity into a small number of shared programs with Storybook demos.
- [Risk] Middleware ordering bugs could replace today's double-writer bugs. → Mitigation: make ownership order explicit, keep one terminal writer, and add unit coverage for delegation and supersession.
- [Risk] Consumer migrations may temporarily regress behavior while old writers are being removed. → Mitigation: migrate `Heartbeat` and `web-chat-view` through failing Storybook contracts that reproduce the known races first.
- [Risk] Browser-native features such as `overflow-anchor` or `scrollend` may not behave uniformly enough for all devices. → Mitigation: treat them as preferred signals with existing settle/reconcile fallback, not as exclusive dependencies.

## Migration Plan

1. Add the new ownership-chain requirements and design to OpenSpec before code changes continue.
2. Refactor the shared anchored virtual list runtime so transaction programs own choreography and only one terminal driver writes the viewport.
3. Remove direct viewport writes from `bottom-anchored-timeline.svelte` and re-express that logic as shared transaction programs.
4. Migrate `web-chat-view`, `VirtualConversation`, and `Heartbeat` to the unified runtime.
5. Add Storybook and unit tests that reproduce the existing double-writer race and prove the new ownership law.

Rollback strategy:

- The old code paths can remain on the branch during the refactor window, but the final merged state must not leave them active.
- If the runtime migration stalls, the branch should stop short of consumer adoption rather than shipping a mixed single-owner / multi-writer world.

## Open Questions

- Should the internal ownership-chain registration API itself be public, or should only `transact(...)` remain public while registration stays package-internal?
- Which mutation facts need first-class typed channels versus a generic transaction metadata bag?
- Should imperative helpers such as `scrollToLatest()` survive as thin wrappers over the runtime, or should consumers migrate fully onto transaction recipes?
