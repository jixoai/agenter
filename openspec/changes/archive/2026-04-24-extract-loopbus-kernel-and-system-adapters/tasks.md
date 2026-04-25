## 1. Kernel Foundation

- [x] 1.1 Create the standalone `packages/loopbus-kernel` workspace package with neutral types, ports, and exports for ingress, dispatch, receipt, projection, and hook context.
- [x] 1.2 Implement kernel-side commit/dispatch/receipt stores plus the delivery state machine, including `pending`, `dispatching`, `accepted`, `errored`, `aborted`, and `completed`.
- [x] 1.3 Add kernel hook surfaces for dispatch and receipt while tightening existing commit hook semantics so commit truth cannot masquerade as delivery truth.
- [x] 1.4 Add kernel unit tests covering dispatch creation, first-valid-SSE acceptance, first-error failure, abort, completion, retry history, and latest-attempt projection.
- [x] 1.5 Run Review Gate B against the new kernel package and update OpenSpec if the kernel still leaks Message/Terminal/Skill specifics.

## 2. Runtime Host And Adapter Extraction

- [x] 2.1 Introduce a runtime kernel host layer in `app-server` that owns kernel lifecycle, persistence bridges, and adapter mounting instead of embedding those responsibilities inside `SessionRuntime`.
- [x] 2.2 Implement the Message adapter and remove direct message-to-attention glue from `SessionRuntime`, including room ingress translation and lifecycle attention commits.
- [x] 2.3 Implement the Terminal adapter and remove direct terminal dirty/lifecycle attention glue from `SessionRuntime`.
- [x] 2.4 Implement the Skill adapter so `RuntimeSkillSystem` publishes skill-domain facts through the adapter path instead of committing attention directly.
- [x] 2.5 Add adapter integration tests proving Message, Terminal, and Skill all enter the kernel through the same neutral contract.
- [x] 2.6 Run Review Gate C and verify `SessionRuntime` no longer contains system-specific direct attention/kernel mutation paths.

## 3. Delivery Binding, Publication, And Runtime Inspection

- [x] 3.1 Wire `AgenterAI` and `ModelClient` to create dispatch attempts, append receipts from stream boundaries, and bind `agentCallId -> sessionModelCallId` without redefining `ai_call running` as acceptance.
- [x] 3.2 Persist dispatch and receipt facts durably and publish explicit `runtime.attentionDispatch` and `runtime.attentionReceipt` events.
- [x] 3.3 Update runtime inspection/query surfaces, including router and local runtime tool descriptors, so delivery truth is available without reconstructing it from Heartbeat rows.
- [x] 3.4 Add runtime orchestration tests covering `running != accepted`, first-frame error, retry attempts, and dispatch binding to later `ai_call` rows.
- [x] 3.5 Run Review Gate D and confirm publication surfaces expose delivery truth separately from hook results, read-state, and grouped Heartbeat parts.

## 4. Client, UI, And Layered Acceptance

- [x] 4.1 Update `client-runtime-store` to normalize delivery summaries and attempt history separately from message read-state and `ai_call` lifecycle.
- [x] 4.2 Update Heartbeat and Devtools UI so they render read truth, hook outcomes, and delivery receipts as distinct inspection signals.
- [x] 4.3 Add regression and DOM/integration coverage for “message already read but not yet accepted”, “first receipt is error”, and “retry preserves attempt history”.
- [x] 4.4 Run the layered acceptance matrix: kernel unit, adapter integration, runtime orchestration, and UI/store contract suites.
- [x] 4.5 Run the final spec-vs-implementation review, compare the delivered structure to the original layering goal, and patch any drift before declaring the change ready.

## 5. Review Reopen And Closure

- [x] 5.1 Move terminal receipt law fully into `ModelClient`, including host-free `accepted` adjudication and a single terminal receipt per attempt.
- [x] 5.2 Add focused `ModelClient` and `AgenterAI` coverage for retry attempt receipts and delivery-event forwarding.
- [x] 5.3 Refresh `.chat` self-review / changelog / real-AI notes so they reflect the reopened review findings and the new verification evidence.
- [x] 5.4 Re-run the final acceptance check, including the best-available live Heartbeat/browser verification, before declaring the change ready again.
- [x] 5.5 Close the missing-credential / uncallable-provider receipt gap so selected attempts always converge to a terminal delivery outcome instead of remaining `dispatching`.
- [x] 5.6 Re-run focused delivery/provider suites and refresh OpenSpec + `.chat` notes so this follow-up is part of the durable acceptance contract.
