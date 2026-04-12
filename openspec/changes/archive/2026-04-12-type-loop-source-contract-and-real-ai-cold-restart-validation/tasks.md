## 1. Spec and protocol alignment

- [x] 1.1 Add OpenSpec delta specs for typed LoopBus source coordinates and real AI cold-restart validation.
- [x] 1.2 Remove durable spec language that still allows generic source-ref or read-result metadata escape hatches.

## 2. LoopBus source contract cleanup

- [x] 2.1 Replace `LoopSourceRef.meta` with typed built-in source coordinates and update built-in source creators/usages.
- [x] 2.2 Remove `LoopSourceReadResult.meta` and keep only first-class scheduler fields on source read results.
- [x] 2.3 Ensure message/task/terminal adapters still derive AI-visible detail only from typed draft/body builders rather than source metadata.

## 3. Verification updates

- [x] 3.1 Update focused unit/integration tests across `packages/app-server` for the typed source contract.
- [x] 3.2 Add a real-provider cold-restart scenario that validates delivery, stop/start recovery, and resumed update on the same session.
- [x] 3.3 Run focused backend tests plus the relevant opt-in real-provider scenarios.
