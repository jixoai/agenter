## 1. Attention CLI primitives

- [ ] 1.1 Define generic `attention watch` semantics for self-evolution obligations that remain active until evidence, policy, or user action settles them.
- [ ] 1.2 Define generic `attention schedule` semantics for delayed or recurring self-evolution wakeups.
- [ ] 1.3 Define query, revoke, and settle behavior for watched and scheduled loops.
- [ ] 1.4 Ensure named rituals such as `auto-dream` remain user/assistant-composed behaviors, not core branches.

## 2. Runtime integration

- [ ] 2.1 Decide the durable timing source for scheduled attention wakeups.
- [ ] 2.2 Integrate scheduled/watched loops with LoopBus containment, backoff, blocked, and settlement facts.
- [ ] 2.3 Preserve separation from `hosting` score and terminal delegation authority.

## 3. Validation

- [ ] 3.1 Add deterministic contract tests for watch/schedule/revoke/settle data semantics.
- [ ] 3.2 Add long-running real AI scripts for scheduled reflection across compact or restart.
- [ ] 3.3 Add semantic judge scoring for learning direction, memory quality, orthogonality, and anti-overfit behavior.
- [ ] 3.4 Use model-response cache support where possible while keeping real AI acceptance explicit.
