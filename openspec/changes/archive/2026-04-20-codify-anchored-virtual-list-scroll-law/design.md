## Context

The repository already has a durable `ScrollView` law for standard scrolling surfaces and a newer bottom-anchored conversation path for latest-first transcript surfaces. That solved immediate reverse-flow regressions, but the public abstraction is still too implementation-shaped for the actual problem.

WebChat-like virtual long lists are not just "another scroll view". They have additional physical constraints:

- a meaningful stream edge such as `latest`
- prepend/append/resize/collapse mutations that can shift layout after the fact
- virtualization, so some targets are not yet mounted in the DOM
- mixed user input sources on Web: direct manipulation, wheel/trackpad, keyboard, and momentum
- native browser scrollbars that must continue to work even when the platform cannot reliably classify scrollbar-thumb drag as a first-class input source
- a need to coordinate browser-native capabilities (`overflow-anchor`, `overscroll-behavior`, `scrollend`, `scrollIntoView`) with fallback reconciliation when those capabilities are insufficient

If the platform law keeps exposing raw scroll primitives or business-specific target types, every consumer will keep rebuilding an ad-hoc scroll manager around the shared package.

## Goals / Non-Goals

**Goals:**

- Define one durable, future-facing scroll law for WebChat-like anchored virtual lists on the Web platform.
- Keep the public target model minimal and orthogonal: `edge`, `element`, and `position`.
- Model programmatic scrolling as transactions with source, priority, interruption policy, and settle lifecycle.
- Make user-input conflict handling explicit for direct manipulation, wheel, keyboard, and momentum.
- Preserve native browser scrollbar behavior and avoid requiring a custom scrollbar for the first version of the law.
- Keep virtualization materialization and temporary anchor insertion inside the host adapter rather than in the public target API.
- Align the public interface language with emerging platform terms such as scroll target, current scroll target, eventual scroll position, anchoring policy, and boundary behavior.

**Non-Goals:**

- Replace native browser scrolling or ship a custom scrollbar as part of the first version.
- Generalize this law to every scrolling surface in the repository.
- Depend on immature CSS proposals as required runtime behavior.
- Remove `ScrollView` from standard static or non-anchored virtual surfaces.
- Create a separate package before the shared Svelte structural package boundary proves insufficient.

## Decisions

### Introduce a dedicated anchored virtual list scroll law instead of stretching `ScrollView`

Standard panels and WebChat-like anchored lists solve different problems. `ScrollView` remains the durable law for ordinary scroll ownership, while the new anchored virtual list contract owns latest-edge anchoring, mutation stabilization, and input arbitration.

Alternative considered:

- Keep extending `ScrollView` with more bottom-anchor and scroll-manager hooks.
  - Rejected because it keeps one primitive responsible for two different physical models and makes the public API harder to explain.

### Keep the public target model to `edge | element | position`

The public API will not expose business terms such as message, unread marker, or heartbeat group, and it will not expose `virtual-row` as a first-class target kind. Instead:

- `edge` covers stream-level positions such as `latest`
- `element` covers concrete or lazily resolved DOM targets
- `position` remains available for reconcile-only cases where element semantics are insufficient

Virtualized rows are host concerns. The host may materialize a temporary 1px anchor or degrade to a position target, but that logic stays behind `materializeTarget()` and `resolveTarget()`.

Alternative considered:

- Expose virtual-row ids directly in the public target model.
  - Rejected because it leaks virtualization mechanics into the durable interface and makes non-virtual consumers pay for implementation detail.

### Model scroll as transactions, not naked commands

The coordinator will treat every programmatic scroll as a transaction with:

- source
- priority
- interruption policy
- active ownership
- settle lifecycle

This borrows the right lessons from Compose (`MutatorMutex` / `MutatePriority`) and SwiftUI (`ScrollPosition` / target-oriented scrolling) without pretending the Web platform has the same primitives.

Alternative considered:

- Keep imperative `scrollToLatest()` / `scrollTowardStart()` commands as the only top-level API.
  - Rejected because command-only APIs hide ownership conflicts and make cancellation / interruption semantics impossible to explain.

### Make transaction closures the primary orchestration surface

The public API should not force feature code to manually assemble mutation records, follow-up requests, and timing hooks as separate declarative objects. Instead, the primary authoring surface should be a closure-based transaction:

- the coordinator captures a stable `before` snapshot
- the caller mutates list data inside the closure
- the caller declares mutation facts and anchoring intent through a transaction controller
- the caller can suspend only through transaction-owned await points such as `commit()`, `settled()`, and semantic scroll helpers
- if user input, a higher-priority transaction, or host failure invalidates the transaction while it is suspended, the transaction runtime aborts the flow by throwing

This keeps the orchestration style close to `startViewTransition(() => ...)` while preserving explicit viewport ownership and interruption semantics.

Alternative considered:

- Force all transaction closures to stay synchronous.
  - Rejected because append/prepend choreography often needs staged execution after commit or settle, and forbidding suspension entirely would move those stages back into ad-hoc callback glue.

Alternative considered:

- Allow arbitrary `await` inside the transaction closure.
  - Rejected because uncontrolled suspension points make the `before` snapshot stale and let user input or later mutations race ahead without a structured abort boundary.

### Make user-input conflict handling a first-class concern

The coordinator state machine must explicitly distinguish:

- direct manipulation
- wheel
- keyboard
- momentum
- programmatic scrolling
- reconcile traffic

This is required on the Web because mouse + touch + keyboard inputs all coexist, and wheel/trackpad behavior is a first-class desktop path rather than an afterthought.

The first version intentionally does **not** model `scrollbar-drag` as a required top-level input kind. Native scrollbar-thumb drag is not a sufficiently portable signal across browsers to build the public law around it. Instead:

- native scrollbars remain the default transport
- any host that can identify scrollbar-thumb drag may fold it into `direct manipulation`
- the public contract does not require a custom scrollbar or custom scrollbar-specific state machine

Alternative considered:

- Treat all user input as one generic `user` source.
  - Rejected because it is too coarse to reason about interruption, settle timing, and desktop-vs-touch behavior.

### Prefer browser-native semantics first, then reconcile

The first implementation should use browser-native capabilities where they match the semantic contract:

- `scrollIntoView` / `if-needed` planning for element targets
- `overscroll-behavior` for boundary control
- `overflow-anchor` as a browser hint, not the only source of truth
- `scrollend` for transaction completion where available

The coordinator remains necessary because browser-native semantics do not fully cover virtualized target materialization, latest-edge anchoring, or prepend/resize stabilization in long dynamic lists.

Alternative considered:

- Replace all reconciliation with native browser semantics immediately.
  - Rejected because the Web platform is moving in the right direction, but it does not yet fully solve virtualized anchored lists.

### Storybook is the acceptance surface for this round

This round should close against Storybook capability labs and Storybook DOM contracts rather than a separate browser-trace artifact pipeline. The acceptance focus is:

- residual jitter after append/prepend mutation choreography
- near-latest append auto-follow behavior
- near-start prepend auto-reveal behavior
- manual operator controls that make those paths inspectable in one Storybook surface

Desktop/mobile manual browser evidence may still be useful later, but it is not the blocking acceptance gate for this round.

### Export the new law from `@agenter/svelte-components`

The shared Svelte structural package remains the only correct home for this law. `web-chat-view`, `Heartbeat`, and future anchored long-list surfaces should consume the same package-level contract instead of rebuilding scroll coordination inside feature code.

Alternative considered:

- Keep the coordinator local to `web-chat-view` and let other surfaces copy the pattern.
  - Rejected because that would repeat the same platform drift the change is meant to remove.

Alternative considered:

- Create a standalone scroll package immediately.
  - Rejected because the current reuse boundary is still the shared Svelte structural package, and introducing another package before the contract settles would add packaging churn without reducing architectural uncertainty.

## Risks / Trade-offs

- [Risk] The abstraction is more complex than a plain `ScrollView`. → Mitigation: keep the scope intentionally narrow to anchored virtual long lists instead of trying to design a repo-wide universal scroll manager.
- [Risk] Browser proposals such as `scroll-state`, `scroll-start-target`, or `::scroll-button()` may evolve differently than expected. → Mitigation: use their vocabulary as naming guidance, but keep the first implementation grounded in stable Web APIs.
- [Risk] User-input arbitration may feel too aggressive or too permissive on different devices. → Mitigation: model source, priority, and interruption policy explicitly and validate them with desktop + iPhone 14 evidence.
- [Risk] Position targets could become a backdoor for leaking raw scroll math into feature code. → Mitigation: reserve `position` for coordinator/host reconciliation paths and keep feature-level intents biased toward `edge` and `element`.
- [Risk] Native scrollbar-thumb drag may need more detail than `direct manipulation` in some future host. → Mitigation: keep the first public contract input model coarse, and allow host-specific detail fields later without forcing a custom scrollbar architecture now.

## Migration Plan

1. Land the new `anchored-virtual-list-scroll` capability and delta specs first.
2. Publish the shared TypeScript contracts, state model, and host adapter from `@agenter/svelte-components` rather than from a new package.
3. Reclassify `ScrollView` as the standard surface law and route WebChat-like transcript surfaces to the anchored virtual list contract.
4. Migrate `web-chat-view` first as the proving ground for the shared law.
5. Migrate `Heartbeat` / `VirtualConversation` and other latest-anchored consumers after the shared package contract stabilizes.
6. Add regression coverage for wheel, touch, keyboard, and momentum interactions on desktop and iPhone 14.

Rollback strategy:

- The split is additive at first. Standard `ScrollView` surfaces keep their current contract.
- If the anchored virtual list contract regresses, consumers can temporarily remain on the current bottom-anchored path while the shared package API is corrected.

## Open Questions

- Should `latest` remain the only stream-specific `edge` value, or do some consumers need an explicit remapped latest edge alias at the host level?
- Which parts of `scrollend` / settle lifecycle should become public package API versus remaining host/coordinator internals?
- When browser support improves, should `containerScope` and `scroll-state` move from optional hints to stronger normative behavior in this contract?
