# Vision-Driven Self Review

## Review State

- Change: `design-instance-focus-attention-lifecycle`
- Iteration: 1
- Recurring issue counts: none
- Exit-condition judgment: normal implementation loop can exit; archive is not performed yet because the operator has not accepted this implementation batch.
- Next loop action: commit implementation/test/task evidence, then archive after acceptance.

## Intent Alignment

| Intent point                                                                                   | Evidence                                                                                                                                                                                                                                    | Verdict |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| Kernel owns generic lifecycle consequences, not shell-next policy.                             | `SessionRuntime.archiveMessageChannel(...)` and `handleArchivedMessageChannelLifecycle(...)` now route room archive through `applyArchivedMessageChannelLifecycle(...)`; shell-next does not mutate attention focus directly.               | Aligned |
| Room archive mutes the bound room attention context without rewriting Avatar-authored summary. | BDD scenario added in `packages/app-server/test/session-runtime.attention-system.test.ts`; targeted run passed.                                                                                                                             | Aligned |
| `room:` owns room lifecycle and transcript entry refs; `msg:` is a contact locator.            | `packages/app-server/src/attention-src.ts` now registers `room` and `msg` separately; `packages/app-server/test/attention-src-registry.test.ts` covers `room:<roomId>`, `room:<roomId>#<entryId>`, and `msg:<superadminAddress>/<contact>`. | Aligned |
| Shell-next owns terminal-room binding reaction in product code.                                | `extensions/shell-next/src/product/lifecycle-reaction.ts` is product-local and uses public store APIs. `runtime.ts` wires it into attach lifecycle.                                                                                         | Aligned |
| No product runtime reaction host or core shell-next branch.                                    | No core module imports shell-next. Product runtime store only exposes `archiveGlobalRoom`; the reaction lives under `extensions/shell-next`.                                                                                                | Aligned |
| Unrelated terminal death does not archive the bound shell-next room.                           | Negative BDD scenario added in `extensions/shell-next/test/run-shell-next.test.ts`; targeted run passed.                                                                                                                                    | Aligned |
| Task checkboxes reflect current-context work only.                                             | Tasks 1.3 through 4.4 were checked after implementation and verification in this context; self-review tasks remain unchecked until this artifact exists.                                                                                    | Aligned |

## Deviations From Intent

1. No visible UI evidence exists because this iteration is backend/product runtime behavior only; evidence is command output and tests.
2. Full package typecheck did not pass because of pre-existing unrelated type drift:
   - `@agenter/app-server typecheck`: `../cli/src/trpc-server.ts` cannot resolve `@agenter/message-system`.
   - `agenter-ext-shell-next typecheck`: existing `senderActorId` / `readActorIds` fixture drift and missing room fields in other tests.
3. The legacy `formatMessageAttentionSrc` / `parseMessageAttentionSrc` helpers remain in `attention-src.ts` for old persisted/source detail readability; new runtime room lifecycle and row refs use `room:`.

## New Questions For User

1. Should we schedule a follow-up cleanup to remove the legacy `formatMessageAttentionSrc` room-row helper entirely after all remaining tests and persisted fixtures are migrated?
2. Should global room archive mute inactive runtimes' persisted attention contexts immediately, or is active-runtime propagation plus startup reconciliation acceptable for this stage?

## Evidence

- HTML report: `review/self-review.html`
- Git commits reviewed:
  - `92ee3c09 docs(spec): start instance focus lifecycle change`
- Uncommitted relevant paths:
  - `packages/app-server/src/attention-src.ts`
  - `packages/app-server/src/session-runtime.ts`
  - `packages/app-server/src/app-kernel.ts`
  - `packages/app-server/src/trpc/router.ts`
  - `packages/app-server/src/loopbus-plugin-runtime.ts`
  - `packages/client-sdk/src/product-extension-runtime.ts`
  - `packages/message-system/src/message-control-plane.ts`
  - `extensions/shell-next/src/product/runtime.ts`
  - `extensions/shell-next/src/product/lifecycle-reaction.ts`
  - matching BDD tests and `tasks.md`
- Known unrelated dirty paths:
  - `openspec/changes/fix-web-chat-view-message-comment-polish/*`
  - `packages/web-chat-view/*`
- Task checkboxes updated by this working context:
  - `1.3`, `2.1` through `2.5`, `3.1` through `3.6`, `4.1` through `4.4`

## Command Evidence

- `bun test packages/app-server/test/attention-src-registry.test.ts packages/app-server/test/loopbus-plugin-runtime.test.ts packages/app-server/test/runtime-message-kernel-adapter.test.ts packages/app-server/test/workspace-settings-notifications.test.ts packages/app-server/test/runtime-system-kernel-adapters.integration.test.ts packages/app-server/test/runtime-kernel-host.test.ts packages/app-server/test/runtime-tool-views.test.ts` -> pass
- `bun test packages/app-server/test/session-runtime.attention-system.test.ts --test-name-pattern "room-backed attention context is active|room lifecycle mutations|sent acknowledgement arms follow-up"` -> pass
- `bun test extensions/shell-next/test/run-shell-next.test.ts --test-name-pattern "bound terminal is killed|unrelated terminal B|background-run exits product attach"` -> pass
- `bun test packages/message-system/test/message-system.test.ts --test-name-pattern "follow-up"` -> pass
- `bun test packages/app-server/test/app-kernel.test.ts --test-name-pattern "global room authority|notification"` -> pass
- `bun run openspec:vision -- validate design-instance-focus-attention-lifecycle` -> pass
- `bun run openspec:vision -- status design-instance-focus-attention-lifecycle` -> specs and tasks visible, self-review pending before this file
- `bun run openspec:vision -- commit-check design-instance-focus-attention-lifecycle --phase self-review` -> pass, with unrelated dirty worktree paths reported

## Exit Handling

- Normal exit is available after this review artifact and `review/self-review.html` are written.
- No handoff is required.
- Archive should wait until the user accepts the implementation batch.
