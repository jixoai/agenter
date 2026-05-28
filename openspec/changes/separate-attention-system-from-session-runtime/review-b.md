## Review B

### Why this review exists

`tasks.md` originally required a behavior review after the first failing BDD and before broad implementation expanded. In practice the code path moved faster than the artifact cadence: the first migrated source path is already implemented and the three focused BDD suites are already passing.

This review exists to realign the change against the original user law before any additional ingress source gets migrated.

### Behavior under review

The reviewed behavior is now:

- `message-system` owns follow-up scheduler durability in its own database
- when a follow-up becomes due, `message-system` writes durable attention truth directly through `AttentionControlPlane`
- this write succeeds even when the owner `SessionRuntime` instance is offline
- later runtime cold start does not replay the source event; it restores and consumes the already-persisted attention truth

### Evidence checked

- `packages/attention-system/test/attention-system.test.ts`
  - proves an external durable writer can commit `preserve` attention without rewriting Avatar-authored context content
- `packages/message-system/test/message-system.test.ts`
  - proves a due follow-up writes reminder attention while the owner runtime is offline
- `packages/app-server/test/session-runtime.attention-system.test.ts`
  - proves runtime cold start wakes from persisted attention truth instead of requiring the original source replay

### Alignment verdict

This migrated path still matches the original law.

In plain language:

- the timer belongs to `message-system`, not `attention-system`
- the reminder fact belongs to `attention-system`, not `SessionRuntime`
- runtime startup now behaves like a reader/recoverer of truth, not the only writer of truth

That is exactly the boundary split requested by the user.

### Drift found in this review

1. **Artifact drift**
   - Review B happened after the first implementation wave instead of before it.
   - This did not invalidate the code path, but it did put OpenSpec notes behind repo truth.

2. **Control-plane target is still too local-first and explicit**
   - `MessageFollowUpRequest` currently carries `attentionRoot`, `attentionContextId`, and `attentionOwner`.
   - This is acceptable as the smallest local-runtime bridge for now.
   - It is not the long-term clean abstraction.

3. **Shared commit semantics are not fully extracted yet**
   - runtime and external writers already behave compatibly on this migrated path
   - but they still need a single shared attention commit application primitive so future paths cannot drift

### Decision after Review B

Proceed with:

- `3.2` shared attention commit application extraction
- `3.3` package-level parity tests for external writers
- then `4.4 / 5.x` cleanup and inspection review before any additional source-owned ingress migration
