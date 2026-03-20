## Context

The browser performance profile exported at `/Users/kzf/Downloads/Trace-20260319T224942.json.gz` shows the renderer main thread carrying the overwhelming majority of CPU work. The trace includes React profiling markers for `Button`, `Tooltip`, `ScrollViewport`, `AppHeader`, `WorkspaceShellFrame`, and related shell chrome. The recorded reasons point to repeated prop identity churn such as `onClick() {} Referentially unequal function closure`, `onNavigate() {} Referentially unequal function closure`, and repeated child array replacement.

The current WebUI shell is intentionally workspace-first and session-driven, which means Chat, Devtools, and navigation chrome all stay mounted while runtime events continue to stream. That architecture is correct, but it raises the cost of unnecessary root-level or shell-level re-renders because background session activity now keeps touching visible React trees for longer periods.

## Goals / Non-Goals

**Goals:**
- Reduce avoidable shell and route-chrome re-renders caused by unstable callback and item-array identities.
- Keep Chat restoration and Devtools panel rendering responsive under long-history and live-runtime updates.
- Preserve the existing workspace-first interaction model, including sidebar running sessions, workspace header tabs, and Chat/Devtools/Settings route separation.
- Add regression coverage that protects the specific performance-sensitive surfaces revealed by the trace.

**Non-Goals:**
- Re-architect the runtime store or transport protocol in this change.
- Introduce virtualization everywhere; only apply it where large lists materially need it.
- Optimize every low-level UI primitive indiscriminately without trace-backed evidence.
- Add bundle-analysis or network-performance work unrelated to the renderer CPU problem.

## Decisions

### 1. Stabilize shell and route callback identities first
The trace directly attributes many updates to referentially-unequal closures on `onClick`, `onNavigate`, `onOpenNavigation`, `onValueChange`, and similar props. The first-line fix is to stabilize these handlers with `useCallback`/`useMemo` at the shell and route boundaries, rather than trying to suppress re-renders deeper in generic UI primitives.

Alternative considered:
- Memoize every low-level component aggressively. Rejected as the first step because it treats the symptom instead of the prop-identity source and risks spreading fragile memo assumptions across the UI kit.

### 2. Keep shell chrome pure and separately memoizable
`AppHeader`, `WorkspaceHeader`, `BottomNavBar`, and `Tabs` are shell-level chrome that should only update when their own route or status inputs change. These surfaces will be treated as pure chrome and wrapped with memo-friendly props so runtime activity in Chat or Devtools does not cascade into avoidable button/tooltip subtree work.

Alternative considered:
- Collapse shell chrome back into fewer larger components. Rejected because it would increase coupling and make perf regressions harder to isolate.

### 3. Use explicit scroll/clipping ownership as a performance boundary
The earlier scroll fixes showed that unstable height/overflow ownership causes both layout bugs and extra render/layout churn. `ViewportMask`, `ScrollViewport`, and async wrappers remain the only approved way to separate fixed chrome from scrolling content. The performance change extends that contract so async shells and technical panels do not accidentally recreate or compete with the primary scroll owner.

Alternative considered:
- Permit local `overflow-hidden` / `overflow-auto` fixes ad hoc. Rejected because it reintroduces the same regressions in slightly different wrappers.

### 4. Add regression checks at the behavior level, not micro-benchmark level
This change uses targeted DOM/e2e checks for long-history Chat restoration, Devtools timeline scrolling, and shell rendering stability. The goal is to lock in the behavior that prevents the trace-backed regressions, not to introduce brittle frame-time assertions that will be noisy in CI.

Alternative considered:
- Add hard CPU or frame-duration thresholds in CI. Rejected for now because the environment is too variable and the repository does not yet have a stable browser perf harness.

## Risks / Trade-offs

- [Memoization can hide stale closures] → Keep callbacks small and dependency lists explicit; prefer stabilizing route-level handlers over memoizing stateful business logic.
- [Shell chrome may still re-render when store selectors are too broad] → This change reduces known callback churn first and keeps the next step open for selector narrowing if trace evidence still points there.
- [Scroll/layout wrappers can regress again while optimizing renders] → Preserve the explicit overflow contract and verify Chat + Devtools with browser walkthroughs after every structural change.
- [Trace evidence is profile-specific] → Anchor fixes only on repeated, structural signals (main-thread React churn, repeated closure identity changes), not on one-off function names.

## Migration Plan

1. Land the shell/header/tab callback-stability changes behind existing components without changing routes or APIs.
2. Keep Chat and Devtools behavior verified through current unit, Storybook DOM, and Playwright coverage.
3. If further trace review still shows shell-level churn, follow up by narrowing runtime selector subscriptions in a separate iteration.
4. No data migration or rollback step is required; rollback is standard code revert.

## Open Questions

- Whether the next highest-value optimization is runtime-store selector narrowing in `AppRoot` and route views, or more memoization around tooltip/dialog-heavy session lists.
- Whether a lightweight browser perf harness should be added later for repeatable CPU-regression capture outside manual trace export.
