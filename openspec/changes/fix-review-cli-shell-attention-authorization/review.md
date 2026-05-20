# cli-shell Fix Review

This review covers the active cli-shell-related OpenSpec/code surface after landing the ChatTUI v9 work on `main`.

Reviewed OpenSpec surfaces:

- Archived `add-terminal-guard-authorization-mode`
- Active `separate-cli-shell-product-from-terminal-view-components`
- Active `complete-cli-shell-avatar-session-reset`
- Durable specs in `packages/cli-shell/SPEC.md`, `packages/terminal-system/SPEC.md`, and `packages/app-server/SPEC.md`
- Current code/tests in `packages/terminal-system`, `packages/app-server`, `packages/client-sdk`, `packages/terminal-view`, and `packages/cli-shell`

## Completion Matrix

| Area | Evidence reviewed | Completion | Current assessment | Gap to address in this change |
| --- | --- | ---: | --- | --- |
| Worktree hygiene and ChatTUI v9 merge | commits `cebd17d9`, `76beac26`; `cli-shell-tui`, `cli-shell-web-host`, `termless`, terminal-system composed tests | 100% | v9 work is merged and the worktree was clean before this review change started. | None for merge; remaining manual-native acceptance stays in the older active change. |
| Product/core boundary | `packages/cli-shell/SPEC.md`, `package-boundary.test.ts`, v9 metadata projection | 90% | cli-shell no longer needs platform types for bottom/dialogue state; product state is projected through metadata and product code. | Add regression tasks so future fixes do not push cli-shell state into TerminalSystem/core types. |
| Avatar/session reset | `complete-cli-shell-avatar-session-reset`, `cli-shell.test.ts`, real daemon integration | 95% | `--avatar`, `--create-avatar`, `--clear-avatar`, and `--session` are separated and tested. | Real AI behavior remains gated; no new action required in this change. |
| Shell Assistant current-terminal prompt law | `shell-assistant-avatar` delta, real prompt integration test, package SPEC | 75% | Prompt and grants now target the current opened terminal and avoid internal terminal exposure. | Existing avatars are seed-if-missing; prompt-law migration/versioning remains a future risk. |
| Native cli-shell authorization popup | `cli-shell-tui.test.ts` approval overlay scenarios | 70% | Popup renders, custom handler suppression works, approve/deny calls TerminalSystem for the current terminal. | It is UI/permission-request driven, not yet action/wait/attention-item driven. |
| cli-shell web-host authorization popup | `cli-shell-web-host.test.ts` current-terminal approval endpoint | 65% | Web host subscribes only to the visible terminal and approves through TerminalSystem. | It does not yet project action lifecycle, denial reason, timeout, wait, or cancel. |
| TerminalSystem guard ACL | `terminal-collaboration-access-control`, `control-plane.test.ts` guard/readonly/lease/history/subscription cases | 65% | Roles, request history, subscriptions, duplicate pending coalescing, stale request invalidation, and transport blocking are covered. | Approval only mints a lease; the original action is not resumed immediately. |
| Terminal action lifecycle | code trace through `enqueueAutomationInput`, `approveRequestAuthorized`, runtime tool descriptors | 20% | There is no first-class pending/executing/succeeded/failed/cancelled/denied terminal action state for guard writes. | Add action id, wait, cancel, bounded timeout, and state machine tests. |
| Attention-item causality for authorization | `session-runtime.ts` terminal approval listener, attention adapter specs/tests | 35% | Some approval updates enqueue terminal lifecycle attention commits for relevant actors. | Creation, approve, deny, timeout, wait, cancel, execution start, and execution result are not one coherent attention-item causal chain. |
| Real AI guard behavior | `real-cli-shell-guard-authorization.integration.test.ts` | 50% | A real AI test exists and checks no root/workspace bash substitution plus approval behavior. | It is gated by `AGENTER_RUN_REAL_LOOPBUS=1`; it currently compensates by asking the model to retry after approval, which should become unnecessary. |
| WebUI relationship | Product/spec review only | 40% | WebUI is correctly treated as an independent product. | Generic terminal-view/action lifecycle integration still needs BDD/DOM coverage outside cli-shell. |

## BDD Boundary Coverage Matrix

| Boundary behavior | Existing BDD coverage | Coverage grade | Missing scenario |
| --- | --- | ---: | --- |
| `readonly` cannot write | TerminalSystem control-plane tests assert denied writes. | Strong | Keep direct error shape stable when action lifecycle lands. |
| `writer/admin` immediate write | TerminalSystem write tests cover successful input delivery and activity rows. | Strong | Add side-by-side scenario with guard action lifecycle to prevent regression in result shape. |
| `guard` creates pending authorization | TerminalSystem tests cover approval request creation, duplicate coalescing, subscriptions, and stale invalidation. | Medium | Replace approval-request-only assertions with action id, state, waitability, expiry, and no PTY effect. |
| Approval resumes original action | Existing tests prove the opposite: approve mints a lease, then a second write succeeds. | Missing | Add failing test where one `plane.write(...)` remains pending and returns after approval without a second write call. |
| Denial with reason | Denial state exists, but no reason-bearing action result contract is covered. | Weak | Add denial reason propagation to original waiter, `terminal wait`, attention commit, and UI projection. |
| Timeout returns waitable id | Approval expiry exists, but command-level bounded wait with returned action id does not. | Missing | Add timeout result with terminal-scoped action id and follow-up `terminal wait` / `terminal cancel`. |
| `terminal wait` / `terminal cancel` | No first-class action API exists. | Missing | Add state-machine tests for waiting, cancel waiting authorization, cancel execution, wrong-purpose cancel, and waiter cleanup. |
| Attention-item causal chain | App-server commits some approval request lifecycle facts. | Weak | Add tests proving request, approve, deny, timeout, cancel, execution start, and result all go through the shared adapter commit path. |
| Native cli-shell popup | Native tests cover TopLayer rendering, current-terminal filtering, approve/deny callback, and managed-state isolation. | Medium | Update from request-row UI to action-state UI and assert approve resumes original action. |
| cli-shell web popup | Web-host tests cover current-terminal filtering and endpoint dispatch. | Medium | Update endpoint/UI to action id, deny reason, cancel, and execution result transition. |
| Real AI behavior | Gated real-AI tests cover no root/workspace bash substitution and approval awareness. | Medium | Remove the compensating second user prompt after approval; approval should wake/resume the original terminal action. |
| Product/core isolation | Package specs and tests protect cli-shell-specific chrome from TerminalSystem types. | Medium | Add regression around action lifecycle so cli-shell remains a projection and cannot become the authority store. |

## Code Evidence Anchors

- `packages/terminal-system/src/terminal-control-plane.ts` currently returns an `approvalRequest` from guard `write/input` before PTY execution. The original action has ended at that point.
- `packages/terminal-system/src/terminal-control-plane.ts` `approveRequestAuthorized(...)` creates a write lease and updates request status; it does not own or resume the original requested input.
- `packages/terminal-system/test/control-plane.test.ts` contains the clearest old-behavior proof: after approval, the test calls `plane.write(...)` a second time and expects that retry to succeed through the lease.
- `packages/app-server/src/session-runtime.ts` forwards `approvalRequest` facts from terminal write/input results and commits partial lifecycle attention for approval request events, but it does not model one coherent terminal action lifecycle.
- `packages/app-server/src/runtime-system-kernel-adapters/terminal-adapter.ts` can commit lifecycle ingress and wake LoopBus, but it has no terminal action transition vocabulary yet.
- `packages/cli-shell/src/tui/shell-terminal-view.ts` renders request rows and approve/deny regions; it does not render action state, timeout, wait, cancel, or denial reason.
- `packages/cli-shell/src/web/start-cli-shell-web-host.ts` posts approve/deny for request ids; it has no action id or cancel/reason/result flow.
- `packages/cli-shell/src/managed.ts` correctly documents that managed/takeover is hosting attention and must not become TerminalSystem authority. This boundary must be preserved while fixing guard actions.

## Key Findings

1. The approval delay is architectural. `terminal write/input` returns after creating `approvalRequest`; approval later only mints a lease, so there is no original action left to resume.
2. Current tests validate the lease-era behavior rather than the user's desired guard behavior. The most revealing existing test explicitly retries `plane.write(...)` after `approveRequestAuthorized(...)`.
3. Authorization facts are partially visible to attention, but not as the source of truth for the action lifecycle.
4. cli-shell has improved its current-terminal subscription law, but the popup is still a projection over approval request rows rather than an attention-backed terminal action.
5. The prior root/workspace bash bypass regression is now recognized in tests and memory, but it remains a policy gap until the guard action lifecycle makes the approved terminal action resume directly.
6. The durable `packages/terminal-system/SPEC.md` still contains the old split where approval timeout is TerminalSystem state and attention only projects approval work. This next change intentionally revises that law: TerminalSystem still owns live PTY authority, but every visible authorization transition must be committed as an attention-item fact.
