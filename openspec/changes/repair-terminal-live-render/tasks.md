## 1. Terminal Truth Projection

- [ ] 1.1 Trace global terminal list payloads from terminal-system through app-server and patch any missing render-critical facts.
- [ ] 1.2 Update `client-runtime-store` reconciliation so snapshot, transport URL, renderer metadata, and absolute cwd survive refresh and incremental updates.

## 2. Terminal Route Rendering

- [ ] 2.1 Refactor the terminal route and surface so the selected terminal renders directly from normalized global terminal truth without blank refresh states.
- [ ] 2.2 Ensure terminal mutations keep `call as`, activity, and seat/access state live without manual refresh.

## 3. Shared Terminal Host Verification

- [ ] 3.1 Patch `terminal-view` and `TerminalViewHost` only where needed so snapshot hydration remains visible until live transport takes over.
- [ ] 3.2 Replace snapshot-only route harness assumptions with regression coverage that exercises the same host contract used in production.

## 4. Verification

- [ ] 4.1 Add BDD/unit/DOM tests for terminal refresh rendering and runtime-store reconciliation.
- [ ] 4.2 Run targeted typecheck and test suites for `terminal-system`, `client-sdk`, `terminal-view`, and `webui`, then update the task checklist.
