## 1. Runtime migration

- [x] 1.1 Add message-system and attention-system adapters to session-runtime
- [x] 1.2 Replace queue-based chat ingestion with control-plane-backed chat channels
- [x] 1.3 Replace old attention gateway/tool contracts with native context/item APIs

## 2. Lifecycle

- [x] 2.1 Split stop and abort semantics across runtime, model call, and transports
- [x] 2.2 Ensure reply routing only reaches chat channels, not raw chat UI facts

## 3. Verification

- [x] 3.1 Add runtime tests for attention ingress/egress and stop/abort behavior
- [x] 3.2 Verify terminal attention does not leak into chat output
