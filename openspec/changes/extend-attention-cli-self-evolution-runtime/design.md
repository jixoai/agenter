## Context

`add-cli-shell-app` intentionally keeps the first attention-cli requirement small: products and assistants need to commit, query, and settle self-evolution attention. That avoids delaying cli-shell on a larger scheduler design.

The missing future capability is still important. Users may teach an assistant recurring or delayed habits: nightly reflection, weekly skill review, memory cleanup, or "watch this condition and reconsider later". Those loops should be built from platform attention law, not from hard-coded app features.

## Goals / Non-Goals

Goals:

- Add generic attention-cli primitives for delayed and watched self-evolution loops.
- Preserve named behavior as user/assistant composition rather than core features.
- Make scheduled reflection durable across compact/restart.
- Integrate with containment, backoff, and explicit settlement.
- Keep terminal write authority separate from self-evolution attention.

Non-goals:

- Do not implement `auto-dream` as a app command or kernel branch.
- Do not use scheduled self-evolution as a bypass for managed mode.
- Do not replace real AI evaluation with deterministic-only assertions.

## Decisions

### 1. The primitive is a loop, not a named ritual

The platform should expose generic primitives such as:

- `attention watch`: keep a queryable obligation active until evidence or policy settles it.
- `attention schedule`: create a delayed or recurring attention wakeup with provenance.
- `attention settle`: close the specific loop when memory/skill work is complete.

`auto-dream` is only an example of what a user might name on top of those primitives.

### 2. Scheduled self-evolution is attention debt

A scheduled reflection should persist as attention debt with:

- owner Avatar,
- reason,
- next wakeup or watch condition,
- recurrence policy if any,
- backoff/retry policy,
- provenance explaining who created it,
- settlement criteria.

The model sees the obligation body. Metadata remains provenance and scheduling input, not hidden instructions.

### 3. Self-evolution remains orthogonal to hosting

Scheduled self-evolution may wake the assistant and cause memory/skill work. It does not imply `scores: {"hosting": 1000}` and does not grant terminal write authority. If the assistant needs terminal effects, it must still obtain delegation or terminal-native approval through the normal law.

### 4. Real AI tests are the acceptance path

Implementation must include long-running real AI scripts. A useful test should simulate the assistant receiving user guidance, scheduling a future reflection, compacting or restarting, waking later, updating memory, and demonstrating that later behavior changed in the right direction. Semantic judge scoring and model-response cache should be used to make the suite repeatable enough for local/release validation.

## Open Questions

- What exact timing source should drive scheduled wakeups: LoopBus timers, daemon scheduler, file-backed workspace events, or a separate attention scheduler?
- Should recurring schedules be first-class recurrence rules or repeated one-shot AttentionItems?
- How should users inspect and revoke scheduled self-evolution loops from CLI and TUI surfaces?
