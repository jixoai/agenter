## 1. Law and Review Alignment

- [x] 1.1 Review the proposal and delta specs against the original user law: attention only owns `AttentionItem` and `AttentionContext`, not foreign timer/receipt semantics.
- [x] 1.2 Record Review A conclusions in the change notes before implementation starts, including any scope corrections needed to stay aligned.
- [x] 1.3 Update package-level durable specs (`SPEC.md` and relevant package specs) if the accepted law introduces new long-term ownership boundaries.

## 2. BDD Contract First

- [x] 2.1 Add failing BDD in `packages/attention-system` for independent durable ingress and cold-start recovery without a live session runtime.
- [x] 2.2 Add failing BDD in `packages/message-system` proving due follow-up can persist attention truth while the owner runtime is offline.
- [x] 2.3 Add failing BDD in `packages/app-server` proving runtime cold start consumes already-persisted attention truth instead of requiring source replay.
- [x] 2.4 Review the failing scenarios with the user as Review B before broad implementation proceeds.

## 3. Attention Control Plane Extraction

- [x] 3.1 Introduce the independent attention ingress/control-plane API and shared persistence helpers.
- [x] 3.2 Refactor attention commit application so runtime and external writers share one semantics implementation.
- [x] 3.3 Add package-level tests proving external control-plane writes preserve context mutation, score, and focus-state law.

## 4. First Source Migration

- [x] 4.1 Migrate message follow-up due handling to write durable attention through the new control plane.
- [x] 4.2 Ensure runtime lifecycle no longer acts as the mandatory write gateway for that source path.
- [x] 4.3 Run focused BDD for `attention-system`, `message-system`, and `session-runtime.attention-system` after the first migration.
- [x] 4.4 Perform Review C on the first migrated source path before migrating any additional source-owned ingress.

## 5. Runtime Recovery and Cleanup

- [x] 5.1 Update runtime startup/recovery flow to restore and schedule attention that was written while runtime was offline.
- [ ] 5.2 Remove remaining runtime-private external ingress residue that duplicates the new control-plane ownership.
- [ ] 5.3 Audit inspection/diagnostic surfaces so they stop implying runtime-local ownership where attention now owns durable truth.

## 6. Final Verification and Realignment

- [x] 6.1 Run targeted BDD suites for `packages/attention-system`, `packages/message-system`, and `packages/app-server`.
- [ ] 6.2 Run broader regression verification for affected runtime/message surfaces.
- [ ] 6.3 Re-read the original user goal and perform a final deviation audit before archive, documenting any intentional debt that remains.
