## Step

dynamic runtime skill change propagation audit

## Request

verify that dynamic skill add/update/remove really triggers attention commits that the runtime can collect, instead of only returning local mutation results.

## Evidence

- initial targeted test shape was wrong:
  - when the test used `runtime.start()` plus `runtime.pause()`, the background loop could still settle and consume the dirty attention state before manual `collectLoopInputs()`
  - evidence from the failing run:
    - `ctx-skill-system` contained the new reminder commit
    - `scoreMap.runtime-skill-system = 100`
    - `dirtyContextIds = []`
- conclusion:
  - production skill reminder commits were not lost
  - the failing proof was a test concurrency artifact
- final deterministic proof:
  - run without starting the background loop
  - mutate skills through real `root_bash` commands:
    - `skill upsert`
    - second `skill upsert` with changed content
    - `skill remove`
  - after each mutation, `collectLoopInputs()` returns attention protocol `items`
  - the collected items contain:
    - `Added runtime skill live-bridge`
    - `Updated runtime skill live-bridge`
    - `Removed runtime skill live-bridge`

## Files

- `packages/app-server/test/session-runtime.attention-system.test.ts`

## Notes

- this closes the direct proof gap for the user's earlier question about dynamic skill add/modify/delete triggering commit-attention-item behavior.
- durable lesson: manual loop-input assertions must avoid running the background loop at the same time, otherwise dirty attention can be consumed before inspection.
