## 1. Runtime Recovery Control

- [ ] 1.1 Add a formal manual retry control path for runtime sessions as a one-shot live control
- [ ] 1.2 Publish policy-resolved recovery diagnostics needed by the runtime shell from existing scheduler/runtime facts
- [ ] 1.3 Ensure manual retry does not mutate provider transport retry, runtime retry policy, or compact policy settings

## 2. Runtime Shell Recovery Surface

- [ ] 2.1 Add a recovery disclosure surface in the existing runtime shell for latest error, retry state, blocked reason, and next wake
- [ ] 2.2 Keep Heartbeat quick config limited to next-call execution knobs and keep recovery controls out of that dialog
- [ ] 2.3 Keep durable retry/compact policy editing in Runtime Settings rather than the live recovery surface

## 3. Verification

- [ ] 3.1 Add or update focused tests for runtime recovery publication and manual retry control behavior
- [ ] 3.2 Add or update runtime-shell tests for recovery disclosure rendering and action availability
- [ ] 3.3 Run targeted verification for blocked, backoff, error, and manual retry flows in the runtime shell
