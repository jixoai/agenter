## Why

LoopBus source refs and read results still retain a generic `meta` escape hatch even after attention payload cleanup. That means the scheduler-side protocol is still more open than the platform law intends, and it leaves one last place where systems can hide routing or lookup facts outside typed contracts.

At the same time, the real-provider suite still does not validate the most important recovery promise: after a real Avatar has already delivered work, `session.stop` and later `session.start` must let that same Avatar continue from disk-backed facts instead of from hidden in-memory state. This needs to be proven now with a real provider, not inferred from unit tests.

## What Changes

- Replace generic LoopBus source-ref metadata with typed source coordinates for built-in systems, and remove generic read-result metadata bags. **BREAKING**
- Keep source-adapter AI-visible detail in typed draft/body fields only; scheduler/read-layer contracts will expose only minimal typed lookup or fingerprint fields. **BREAKING**
- Add a real-provider cold-restart validation scenario: one Avatar delivers a tiny app, the runtime is stopped, then restarted, and the Avatar resumes the same task through durable room/workspace/attention facts.
- Reuse the existing real room-terminal harness instead of inventing a parallel CLI truth source.

## Capabilities

### New Capabilities
- `real-ai-cold-restart-validation`: executable real-provider acceptance scenarios that prove cold restart recovery for one Avatar after prior room delivery and workspace/terminal-backed work.

### Modified Capabilities
- `attention-source-plugins`: source references and source reads now use typed coordinates instead of open metadata bags.
- `loopbus-plugin-pipeline`: plugin/runtime source contracts now forbid generic metadata escape hatches in source refs and read results.
- `attention-runtime-kernel`: real cold restart recovery is now an explicit backend validation expectation over the persisted runtime law.

## Impact

- Affected code: `packages/app-server/src/loopbus-plugin-runtime.ts`, `packages/app-server/src/session-runtime.ts`, related LoopBus/runtime tests, and real-provider harness/scenario files.
- Affected APIs: internal LoopBus source adapter contracts and test-support real-provider scenario helpers.
- Affected operations: opt-in real-provider validation will add a new restart-resume scenario on top of the existing real room/terminal suite.
