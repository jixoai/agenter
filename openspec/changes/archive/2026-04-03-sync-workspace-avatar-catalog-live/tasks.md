## 1. Store and Transport

- [x] 1.1 Add live workspace avatar catalog state and watch helpers to `RuntimeStore`
- [x] 1.2 Add server-side avatar catalog invalidation/subscription plumbing for workspace and global avatar roots

## 2. Workspaces Quick Start

- [x] 2.1 Replace route-local avatar fetch state with store-backed catalog state in the Svelte `Workspaces` route
- [x] 2.2 Implement optimistic avatar copy/fork behavior and automatic selection of the created avatar
- [x] 2.3 Ensure starting the copied avatar immediately creates or focuses the stable session and updates `Running Avatars`

## 3. Verification

- [x] 3.1 Add unit coverage for avatar catalog normalization and optimistic reconciliation
- [x] 3.2 Add Playwright BDD coverage for copy-avatar, refresh, and launch-from-Quick-Start behavior
