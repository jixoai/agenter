## 1. Baseline Review And Red Tests

- [ ] 1.1 Add failing TerminalSystem BDD tests for readonly direct error, writer/admin immediate result, and guard pending action wait behavior.
- [ ] 1.2 Add failing TerminalSystem BDD tests for approve-resumes-original-action without requiring a second write call.
- [ ] 1.3 Add failing TerminalSystem BDD tests for deny with optional reason, approval timeout with action id, `terminal wait`, and `terminal cancel`.
- [ ] 1.4 Add failing runtime adapter BDD tests proving request, approve, deny, timeout, cancel, execution-start, and execution-result transitions commit attention items through the shared adapter path.
- [ ] 1.5 Add failing cli-shell native BDD tests proving approve resumes the original pending terminal action and does not mutate managed/hosting state.
- [ ] 1.6 Update the real AI guard authorization test so approval no longer requires a second user instruction that tells the assistant to retry the command.

## 2. TerminalSystem Action Lifecycle

- [ ] 2.1 Introduce live TerminalInstance-scoped terminal action state with explicit states `waiting_authorization`, `executing`, `succeeded`, `failed`, `cancelled`, and `denied`.
- [ ] 2.2 Route guard `write/input` through action creation and bounded wait instead of immediate approvalRequest return only.
- [ ] 2.3 Change approval to resume the original pending action and return/record its result instead of only minting a future write lease.
- [ ] 2.4 Support denial with optional reason and propagate it to original waiters and `terminal wait`.
- [ ] 2.5 Invalidate pending actions on stop, kill, bootstrap, delete, or live-instance replacement.
- [ ] 2.6 Preserve explicit admin-granted write leases as separate authority, without making one-command approval default to broad future write access.

## 3. Terminal Wait And Cancel APIs

- [ ] 3.1 Add TerminalSystem `waitAction` / `cancelAction` APIs or equivalent methods with cancellation-safe waiter cleanup.
- [ ] 3.2 Add runtime tool descriptors and CLI command support for `terminal wait` and `terminal cancel`.
- [ ] 3.3 Add SDK/store methods and typed outputs for action state, wait result, cancel result, and denial reason.
- [ ] 3.4 Ensure `terminal wait` returns the same result shape as the original `terminal write/input` would have returned after approval.
- [ ] 3.5 Ensure `terminal cancel` supports purposes `authorization_wait`, `execution`, and `any`.

## 4. Attention-Item Integration

- [ ] 4.1 Extend the terminal runtime adapter so all terminal action transitions commit attention items with stable action identity and terminal source refs.
- [ ] 4.2 Ensure approval, denial, cancellation, timeout, and execution result commits wake relevant runtime work promptly.
- [ ] 4.3 Keep attention facts durable while keeping actionable pending authority live-instance scoped.
- [ ] 4.4 Add code comments at the TerminalSystem/runtime adapter boundary documenting that cli-shell products must not hardcode core behavior and all visible authorization effects must trace to attention-item commits.
- [ ] 4.5 Update durable `SPEC.md` files so they no longer state or imply that terminal approval attention is merely a projection; TerminalSystem keeps live PTY authority while attention items carry the visible authorization causal facts.

## 5. Product Projection Updates

- [ ] 5.1 Update native cli-shell authorization overlay to render terminal action identity, state, expiry, and optional denial reason affordance.
- [ ] 5.2 Update cli-shell native authorization UI to approve, deny, and cancel terminal actions for the current bound terminal only.
- [ ] 5.3 Update terminal-view component contracts so default approval UIs stay TopLayer projections and custom host callbacks preserve terminal/action identity.
- [ ] 5.4 Verify WebUI integration through generic terminal-view/TerminalSystem contracts without adding cli-shell coupling.

## 6. Validation

- [ ] 6.1 Run focused TerminalSystem action lifecycle tests.
- [ ] 6.2 Run focused app-server/runtime adapter attention tests.
- [ ] 6.3 Run cli-shell unit, TUI, and termless walkthrough tests.
- [ ] 6.4 Run terminal-view component tests and WebUI DOM/browser contracts affected by the generic terminal-view authorization surface.
- [ ] 6.5 Run the gated real AI cli-shell guard authorization suite with `AGENTER_RUN_REAL_LOOPBUS=1` and record evidence.
- [ ] 6.6 Run `bun run typecheck`, `openspec validate fix-review-cli-shell-attention-authorization --strict`, `openspec validate --specs --strict`, and `git diff --check`.
