## 1. Runtime Config Layering

- [x] 1.1 Move Heartbeat runtime knobs to root-level `ai.*` settings schema and loader behavior
- [x] 1.2 Update session config and related runtime readers to consume root-level runtime knobs instead of provider mutations

## 2. Heartbeat Config Persistence

- [x] 2.1 Make scoped settings graphs treat avatar settings as first-class editable and jump-target layers
- [x] 2.2 Update Heartbeat config state and save flow so Avatar runtime surfaces write to the avatar layer

## 3. Verification

- [x] 3.1 Add or update focused tests for settings loading, settings scope, session config, and Heartbeat config state
- [x] 3.2 Run targeted verification and leave the change ready to archive
