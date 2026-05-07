## Why

`add-cli-shell-product` needs only minimal attention-cli compatible `commit/query/settle` operations so `shell-assistant` can express self-evolution without kernel special cases. That is enough for the first product, but it does not fully cover richer user-defined loops such as "review my day later, update memory, and keep improving across time".

This follow-up change records the future platform proposal: attention-cli should eventually expose generic watch and schedule primitives for assistant-composed self-evolution loops. The proposal exists so the idea is not lost, but it is not part of the current cli-shell implementation.

## What Changes

- Define generic attention-cli `watch` and `schedule` primitives for recurring or delayed self-evolution work.
- Keep named rituals such as `auto-dream` out of core; they are user/assistant-composed behaviors built from attention, memory, and skills.
- Model scheduled reflection as attention debt with explicit provenance, timing, retry/backoff, and settlement rather than as hidden prompt text.
- Preserve orthogonality with hosting: self-evolution schedules do not imply `hosting`, terminal write authority, or managed mode.
- Require long-running real AI evaluation for any future implementation because scheduled self-evolution is semantic behavior, not a deterministic state transition.

## Capabilities

### New Capabilities

- `attention-cli-self-evolution-runtime`: attention-cli can express generic delayed and watched self-evolution loops that assistants compose without adding named kernel features.

## Impact

- `packages/attention-system/` attention context and item APIs
- `packages/app-server/skills/attention/` or equivalent attention-cli skill surface
- `packages/app-server/src/*` LoopBus wakeup, backoff, and durable attention scheduling integration
- `packages/app-server/test-support/real-model-cache.ts`
- Real AI semantic judge test support for long-running self-evolution scenarios

## Out Of Scope

- Implementing this proposal during `add-cli-shell-product`.
- Adding a built-in `auto-dream` command, score key, or scheduler branch.
- Granting terminal write authority from self-evolution attention alone.
