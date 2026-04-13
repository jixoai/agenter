## 1. Prompt and skill law

- [ ] 1.1 Update `AGENTER.mdx` prompt sources so external-fact tasks bias Avatars toward shell-first objective verification instead of memory-backed guessing.
- [ ] 1.2 Update runtime skill/reference docs so `root_workspace_bash` is clearly described as a one-shot Linux shell with outbound network verification capability, without adding rigid query recipes.

## 2. Test-only Avatar harness

- [ ] 2.1 Extend the real-provider test harness so external-fact scenarios can run with a dedicated test Avatar and a dedicated `AGENTER.mdx`.
- [ ] 2.2 Ensure the harness exposes durable diagnostics for room truth, tool trace, model calls, and prompt/avatar identity when an external-fact scenario stalls or times out.

## 3. Real-provider validation

- [ ] 3.1 Add or update a real-provider external-fact scenario that proves acknowledgement, `root_workspace_bash` usage, semantic final answer, and settled attention.
- [ ] 3.2 Run the required real-AI validation for the external-fact scenario and record whether the new shell-first behavior is stable enough to keep as the next gate.
