## 1. Terminal-system purity and approval history

- [x] 1.1 Add BDD coverage for pure inspection, full snapshot hydration, and approval-history queries in `packages/terminal-system/test`
- [x] 1.2 Refactor `TerminalControlPlane` and related types so reads are pure by default, snapshots return full renderable state, and approval queries read durable history
- [x] 1.3 Split explicit read activity recording from pure inspection paths and update terminal-system tests

## 2. Runtime and client surface projection

- [x] 2.1 Push the new read/snapshot contract through `packages/app-server` and `packages/client-sdk` shared terminal types
- [x] 2.2 Replace terminal activity/grant/approval refresh glue with a single terminal surface projection invalidation path in `packages/client-sdk`
- [x] 2.3 Add runtime-store and app-server coverage for terminal surface projection invalidation and non-duplicated activity facts

## 3. WebUI terminal surface and viewport primitives

- [x] 3.1 Refactor `terminal-route` and `terminal-system-surface` to consume authoritative seat projection data and preserve drafts across failed or approval-requested writes
- [x] 3.2 Reduce `@agenter/terminal-view` to a viewport primitive and move terminal chrome responsibilities into WebUI host surfaces
- [x] 3.3 Add Storybook DOM contracts for terminal write failure, approval-requested writes, users-pane actions, and snapshot-first viewport hydration

## 4. Cleanup and verification

- [x] 4.1 Remove low-value terminal source-string tests once DOM/integration coverage replaces them
- [x] 4.2 Run targeted terminal-system, client-sdk, terminal-view, and WebUI verification suites and update task progress
