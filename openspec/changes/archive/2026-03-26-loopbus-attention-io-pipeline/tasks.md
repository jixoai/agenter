## 1. Plugin runtime

- [x] 1.1 Add delta spec `loopbus-attention-output-pipeline`
- [x] 1.2 Extend `LoopBusPluginRuntime` with egress adapter registration and dispatch
- [x] 1.3 Add model lifecycle hooks with signal propagation

## 2. Runtime integration

- [x] 2.1 Route committed attention items through the new dispatch path
- [x] 2.2 Keep message-system and terminal-system integration behind adapters only

## 3. Verification

- [x] 3.1 Add tests for dispatch ordering and first-match semantics
- [x] 3.2 Add tests for abort-aware lifecycle hooks
