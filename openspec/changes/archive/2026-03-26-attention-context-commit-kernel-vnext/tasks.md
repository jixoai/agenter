## 1. Context / commit kernel

- [x] 1.1 Replace the attention-system item model with context heads plus immutable commit history.
- [x] 1.2 Implement `attention_commit` with `update / diff / clean` semantics and remove AI-facing append/patch tools.
- [x] 1.3 Update persistence and runtime publication so context state and commit history are the canonical snapshot.

## 2. Loop scheduling and model flow

- [x] 2.1 Make LoopBus wake from active contexts (`context.scoreMap`) instead of active items.
- [x] 2.2 Change attention input serialization so model rounds receive context state plus bounded recent commit history.
- [x] 2.3 Update prompts, model-call recording, and runtime tests for the single-tool commit contract.

## 3. Verification

- [x] 3.1 Add unit tests for context state mutation, diff/update/clean behavior, and head commit evolution.
- [x] 3.2 Add integration coverage proving unresolved context scores keep the loop alive until zero.
