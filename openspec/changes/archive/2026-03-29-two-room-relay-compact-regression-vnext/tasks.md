## 1. Deterministic Kernel Harness

- [x] 1.1 Add app-server test support for a local completion-compatible mock provider and temporary workspace settings.
- [x] 1.2 Add scenario helpers that boot a real session, manually configure the `kzf` and `gaubee` rooms, and observe public runtime facts.

## 2. Relay And Compact Regression

- [x] 2.1 Add a non-GUI integration test that verifies `kzf -> gaubee -> kzf` relay through the real kernel/message-channel path.
- [x] 2.2 Add a non-GUI integration test that triggers manual `/compact` and verifies the next `中午吃什么` follow-up still resolves correctly.
- [x] 2.3 Apply the smallest runtime/kernel fix needed if the new deterministic regressions expose a missing LoopBus or compact rule.

## 3. Verification

- [x] 3.1 Run the targeted app-server integration test file and confirm both scenarios pass.
- [x] 3.2 Confirm cycle projection exposes the manual compact marker used by the regression.
