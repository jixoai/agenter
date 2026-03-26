## Context

The repository already contains partial performance fixes: runtime publication coalescing, virtualized chat history, some selector tests, and archived trace analysis. Those fixes helped specific incidents but did not establish one platform law. As a result, the same failure modes keep reappearing in new forms: hot runtime facts leak into broad React subscriptions, technical lists hydrate too much data, panels invent bespoke loading states, and heavy renderers such as Markdown/JSON/YAML editors get recreated under unrelated state churn.

This change is deliberately downstream of `attention-runtime-error-containment`. It assumes the runtime no longer burns tokens or spins indefinitely, because profiling a system that is still in an error loop does not produce trustworthy performance evidence.

## Goals / Non-Goals

**Goals:**
- Establish one shared diagnostics plane for runtime publication, hydration, render churn, and memory investigation.
- Bound long-list memory growth through shared reverse-time windowing and resource-controller state.
- Keep inactive heavy surfaces cold and active surfaces narrowly subscribed.
- Standardize long-list loading treatments and verification across desktop and mobile.
- Convert performance knowledge into repository-level best practices and reusable tooling.

**Non-Goals:**
- Fix every slow surface in one pass regardless of evidence.
- Introduce a new global state library or replace the current runtime store architecture wholesale.
- Optimize bundle size, server compute cost, or non-WebUI native clients in this change.

## Decisions

### 1. Performance becomes a platform contract, not a panel-by-panel patch queue
The change will define shared laws for diagnostics, bounded list hydration, selector publication, and heavy-renderer stability, then migrate panels onto those laws.

Why: the same categories of bugs keep resurfacing because the repository still treats performance as a local fix instead of a platform concern.

Alternative considered: keep shipping narrow fixes for whichever route currently feels slow. Rejected because it preserves drift and does not produce reusable tools or standards.

### 2. Add a first-class diagnostics plane
Runtime and WebUI performance debugging will rely on shared counters and evidence capture rather than only anecdotal UX reports. The diagnostics plane will cover publication counts, hydration/page-window stats, route-level active subscriptions, and browser walkthrough evidence for desktop and mobile.

Why: optimizing without stable evidence is how false fixes and regressions slip through.

Alternative considered: rely only on external browser profiling traces. Rejected because traces are necessary but too heavyweight to be the only diagnostic interface.

### 3. Bound long-list memory through shared resource windows
Long-lived resources such as chat, cycles, terminal activity, model calls, and loop/attention timelines will share one reverse-time window model. The server returns newest windows plus explicit older-page cursors, and the client store tracks bounded windows per resource instead of accumulating the entire history indefinitely.

Why: the memory problem is not only rendering cost; it is also unbounded list hydration and duplicated panel state.

Alternative considered: virtualize without changing data retention. Rejected because virtualization alone does not solve heap growth.

### 4. Keep hot subscriptions visibility-scoped and measurable
Only visible or explicitly active surfaces may subscribe to heavy hot slices. Publication diagnostics will expose whether a selector is republishing because the underlying selected value changed or because a consumer boundary is too broad.

Why: render stability depends on data-flow discipline, not only memoization.

Alternative considered: add more memo wrappers around current broad subscriptions. Rejected because memoization cannot compensate for needless republishing.

### 5. Treat heavy renderers as stable surfaces with lightweight previews in lists
Structured viewers and editor-like renderers will keep stable instance identity when their content has not changed. Dense lists will render lightweight previews by default and only upgrade to heavier surfaces when detail is expanded or focused.

Why: repeatedly recreating editor-grade surfaces inside scrolling lists is a major source of GC churn and input lag.

Alternative considered: switch all technical content to a new renderer stack. Rejected because the immediate issue is instability and density misuse, not the existence of the current renderers.

## Risks / Trade-offs

- [Diagnostics become noisy or expensive] -> Keep counters lightweight, development-focused, and scoped to explicit inspection entrypoints.
- [Bounded windows surprise users who expect everything hydrated] -> Make older history explicitly fetchable and keep visible windows stable while pagination occurs.
- [Surface migration stalls because too many panels differ] -> Start with shared primitives and migrate the highest-cost routes first, then widen coverage incrementally.
- [Performance budgets drift back into folklore] -> Encode verification in Storybook DOM, unit tests, and browser walkthrough checklists instead of prose alone.

## Migration Plan

1. Add the diagnostics capability and the delta specs for bounded windows, scoped publication, async list treatment, and render stability.
2. Implement shared runtime/client diagnostics counters plus list-resource controller primitives.
3. Migrate the highest-cost long-list panels to the shared window/loading primitives and visibility-scoped subscriptions.
4. Stabilize heavy renderer identity and lightweight list previews where dense technical rows currently mount expensive surfaces.
5. Add regression tests and browser walkthrough evidence for desktop and iPhone 14.
6. Promote the new diagnostics and performance workflow into repository best-practice guidance.

## Open Questions

- Whether bounded resource windows should support automatic eviction for backgrounded routes immediately, or only after explicit memory pressure thresholds are crossed.
- Whether the diagnostics plane should be visible only in Devtools or also available through an internal debug endpoint for automated capture.
