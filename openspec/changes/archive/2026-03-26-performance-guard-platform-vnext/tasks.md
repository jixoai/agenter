## 1. Diagnostics Platform

- [x] 1.1 Finalize the performance-guard platform proposal, design, and delta specs for diagnostics, bounded windows, scoped publication, and render stability
- [x] 1.2 Implement shared runtime/client diagnostics counters for publication churn, hydration windows, and active heavy-surface subscriptions
- [x] 1.3 Define the standard browser evidence workflow for desktop and iPhone 14 performance investigation

## 2. Data Plane And Store Boundaries

- [x] 2.1 Unify long-history technical resources on the shared reverse-time list envelope needed by bounded virtualized surfaces
- [x] 2.2 Refactor `packages/client-sdk` to keep bounded resource windows and reusable long-list controller state instead of unbounded per-panel hydration
- [x] 2.3 Ensure inactive heavy surfaces stay cold by tightening visibility-scoped runtime subscriptions and fetch boundaries

## 3. WebUI Surface Migration

- [x] 3.1 Introduce or refine shared long-list/loading primitives so technical panels reuse the same async and pagination treatments
- [x] 3.2 Stabilize heavy structured viewers and dense-list previews so unrelated runtime updates do not recreate editor-grade renderers
- [x] 3.3 Migrate the highest-cost technical panels onto the shared bounded-window and render-stability contracts

## 4. Verification And Standards

- [x] 4.1 Add unit coverage for bounded resource windows, publication diagnostics, and inactive-surface subscription discipline
- [x] 4.2 Add Storybook DOM and browser walkthrough regression coverage for desktop/mobile long-list loading, renderer stability, and route switching
- [x] 4.3 Update project best-practice guidance with the new diagnostics workflow, long-list contract, and performance investigation checklist
