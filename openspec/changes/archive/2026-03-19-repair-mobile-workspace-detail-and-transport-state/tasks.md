## 1. Implementation

- [x] 1.1 Add the `runtime-transport-state` capability by extending `packages/client-sdk` transport state, reconnect handling, browser online/offline reactions, and retained API-call stream recovery.
- [x] 1.2 Update the WebUI shell and Workspaces master-detail flow so compact workspace selection opens the Sessions detail sheet via `selectedWorkspacePath`, remove workspace double-click activation, and render transport status from the new shared transport metadata.
- [x] 1.3 Adjust shared helpers and type contracts so `connected` remains a derived compatibility field while new UI surfaces consume the richer `connectionStatus` state.

## 2. Validation

- [x] 2.1 Add or update BDD tests in `packages/client-sdk/test/runtime-store.test.ts` for offline, reconnecting, and retained-stream recovery behavior.
- [x] 2.2 Add or update WebUI DOM/Storybook coverage for compact Workspaces selection and header transport-status rendering.
- [x] 2.3 Run focused WebUI and client-sdk test suites, then perform a real browser walkthrough covering compact Workspaces detail flow and offline/reconnect behavior.
