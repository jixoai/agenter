## 1. Trace analysis and hotspot mapping
- [x] 1.1 Analyze `/Users/kzf/Downloads/Trace-20260319T224942.json.gz` and extract renderer-main-thread hotspots plus React profiling reasons.
- [x] 1.2 Map the dominant closure-identity and shell-chrome hotspots back to concrete WebUI components and route scaffolds.

## 2. Shell and route stabilization
- [x] 2.1 Stabilize workspace shell/header/tab/navigation callbacks and item arrays where the trace shows repeated referential churn.
- [x] 2.2 Keep Chat long-history restoration and Devtools route scrolling behavior correct while applying the performance fixes.

## 3. Verification
- [x] 3.1 Add or extend behavior-level regression coverage for long-history Chat restoration and Devtools primary scroll ownership.
- [x] 3.2 Run targeted `@agenter/webui` unit, Storybook DOM, and Playwright desktop/mobile regressions after the performance-oriented refactor.
