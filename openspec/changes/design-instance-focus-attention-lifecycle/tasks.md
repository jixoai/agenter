## 1. Alignment / Investigation

- [x] 1.1 Confirm `plans/plan.md` captures the final boundary: kernel exposes lifecycle APIs/laws, shell-next owns terminal-room binding and reaction code, and no Product runtime reaction host is introduced.
- [x] 1.2 Confirm no destructive data migration or state reset is approved or required for this iteration.
- [ ] 1.3 Inspect current terminal lifecycle, room archive, attention focus, source ref, and shell-next product runtime code before implementation.

## 2. BDD Contract

- [ ] 2.1 Add a kernel behavior test: Given a room-backed attention context is active When the room is archived Then the room attention context becomes `muted` without rewriting the Avatar-authored summary.
- [ ] 2.2 Add a shell-next product behavior test: Given shell-next has a bound terminal and room When the bound terminal reaches killed lifecycle Then shell-next archives only the bound room through public APIs.
- [ ] 2.3 Add a negative shell-next behavior test: Given shell-next has terminal `A` bound to room `R` When unrelated terminal `B` is killed Then room `R` is not archived.
- [ ] 2.4 Add source/ref parser tests for `room:<roomId>`, `room:<roomId>#<entryId>`, and `msg:<superadminAddress>/<contact>` so room entries remain room-fragment refs and message refs remain contact locators.
- [ ] 2.5 Confirm task checkboxes are only checked after the current agent has implemented and verified the matching behavior in this working context.

## 3. Implementation

- [ ] 3.1 Run `bun run openspec:vision -- commit-check design-instance-focus-attention-lifecycle --phase apply` before product-code work starts and record any limitations caused by unrelated dirty worktree files.
- [ ] 3.2 Implement the room archive -> attentionContext muted kernel law at the runtime/message adapter boundary.
- [ ] 3.3 Implement source/ref parsing and formatting updates for room refs and message contact refs without adding hard-coded shared-kernel source switches.
- [ ] 3.4 Implement shell-next terminal killed -> archive bound room in shell-next product code using public lifecycle/API contracts, with no core import of shell-next and no shell-next import of core internals.
- [ ] 3.5 Add concise intent comments at critical effect points where lifecycle facts cause focus/archive consequences.
- [ ] 3.6 Update only current-context completed task checkboxes and keep implementation changes scoped away from unrelated `fix-web-chat-view-message-comment-polish` worktree changes.

## 4. Verification

- [ ] 4.1 Run targeted unit/integration tests for attention context state, source ref registry, and shell-next product lifecycle reaction.
- [ ] 4.2 Run `bun run openspec:vision -- validate design-instance-focus-attention-lifecycle`.
- [ ] 4.3 Run `bun run openspec:vision -- status design-instance-focus-attention-lifecycle` and confirm specs + tasks are visible to the workflow.
- [ ] 4.4 Run `bun run openspec:vision -- commit-check design-instance-focus-attention-lifecycle --phase self-review` before writing final review evidence.

## 5. Self-Review Loop

- [ ] 5.1 Generate `review/self-review.md` comparing implementation against `plans/plan.md` and all delta specs.
- [ ] 5.2 Generate `review/self-review.html` as structured evidence for the behavior and verification results.
- [ ] 5.3 If self-review reopens tasks or updates OpenSpec artifacts, keep those artifact changes separate from code changes.
- [ ] 5.4 If review cannot exit normally, run `bun run openspec:vision -- handoff design-instance-focus-attention-lifecycle` before returning to user discussion.
- [ ] 5.5 If review exits normally, run `bun run openspec:vision -- check design-instance-focus-attention-lifecycle` and prepare the change for archive.
