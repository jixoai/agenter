## 1. Prompt and skill law

- [x] 1.1 Update `AGENTER.mdx` prompt sources so external-fact tasks bias Avatars toward shell-first objective verification instead of memory-backed guessing.
- [x] 1.2 Update runtime skill/reference docs so `root_workspace_bash` is clearly described as a one-shot Linux shell with outbound network verification capability, without adding rigid query recipes.

## 2. Test-only Avatar harness

- [x] 2.1 Extend the real-provider test harness so external-fact scenarios can run with a dedicated test Avatar and a dedicated `AGENTER.mdx`.
- [x] 2.2 Ensure the harness exposes durable diagnostics for room truth, tool trace, model calls, and prompt/avatar identity when an external-fact scenario stalls or times out.

## 3. Real-provider validation

- [x] 3.1 Add or update a real-provider external-fact scenario that proves acknowledgement, `root_workspace_bash` usage, semantic final answer, and settled attention.
- [x] 3.2 Run the required real-AI validation for the external-fact scenario and record whether the new shell-first behavior is stable enough to keep as the next gate.

Validation note:

- `2026-04-13`: `AGENTER_RUN_REAL_LOOPBUS=1 bun test packages/app-server/test/real-loopbus.integration.test.ts --test-name-pattern "external fact"` passed in `404.84s`; the test-only Avatar acknowledged first, used `root_workspace_bash`, returned the verified npm `ccski` latest version, and settled attention.
