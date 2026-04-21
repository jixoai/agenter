## 1. OpenSpec + durable law

- [x] 1.1 Add delta specs for runtime tool surface, workspace capabilities, descriptor law, and runtime guidance so the current breaking contract is explicit before code cleanup.
- [x] 1.2 Update repository/package durable SPEC files touched by the new tool law and remove active `root_workspace_*` contract text.

## 2. Workspace mount identity

- [x] 2.1 Extend `WorkspaceMountRecord` persistence with runtime-local workspace ids and mount aliases, including deterministic default alias generation.
- [x] 2.2 Reuse the same runtime-local id/alias/exec profile when the same runtime re-attaches the same workspace path and kind.
- [x] 2.3 Add store/kernel helpers to read richer mounted workspace surfaces and mutate aliases through runtime control.

## 3. Runtime tool surface refactor

- [x] 3.1 Replace direct model tools with `workspace_list`, `root_bash`, and `workspace_bash`.
- [x] 3.2 Keep runtime-local system CLI only behind `root_bash`; ensure `workspace_bash` stays a pure workspace shell with isolated authority.
- [x] 3.3 Extend the runtime `workspace` descriptor namespace with alias mutation and richer workspace-list output for root control-plane use.

## 4. Projection / guidance / cleanup

- [x] 4.1 Update runtime projections, tool traces, and heartbeat parsing to snapshot workspace alias/id at execution time.
- [x] 4.2 Update client/WebUI rendering so command rows display `root · command` or `<alias> · command`.
- [x] 4.3 Rewrite runtime skill guidance, generated skill catalog, fixtures, and tests to remove active `root_workspace_*` residue.

## 5. Verification

- [x] 5.1 Add/update unit and integration coverage for workspace ids, aliases, `workspace_bash` isolation, and root-only CLI control.
- [x] 5.2 Reconcile real `ai_call.requestBody` / tool-trace evidence with the new direct-tool contract and confirm only `workspace_list`, `root_bash`, and `workspace_bash` remain.
