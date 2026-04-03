## 1. Terminal Truth Projection

- [x] 1.1 Trace global terminal list payloads from terminal-system through app-server and patch any missing render-critical facts.
- [x] 1.2 Update `client-runtime-store` reconciliation so snapshot, transport URL, renderer metadata, and absolute cwd survive refresh and incremental updates.

## 2. Terminal Route Rendering

- [x] 2.1 Refactor the terminal route and surface so the selected terminal renders directly from normalized global terminal truth without blank refresh states.
- [x] 2.2 Ensure terminal mutations keep `call as`, activity, and seat/access state live without manual refresh.

## 3. Shared Terminal Host Verification

- [x] 3.1 Patch `terminal-view` and `TerminalViewHost` only where needed so snapshot hydration remains visible until live transport takes over.
- [x] 3.2 Replace snapshot-only route harness assumptions with regression coverage that exercises the same host contract used in production.

## 4. Verification

- [x] 4.1 Add BDD/unit/DOM tests for terminal refresh rendering and runtime-store reconciliation.
- [x] 4.2 Run targeted typecheck and test suites for `terminal-system`, `client-sdk`, `terminal-view`, and `webui`, then update the task checklist.
