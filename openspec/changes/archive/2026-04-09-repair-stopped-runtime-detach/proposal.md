## Why

Backend self-walk for `refactor-workspace-system-and-attention-core` exposed that `AppKernel.stopSession()` still leaves the stopped runtime inside `AppKernel.runtimes`. That breaks the new single-source law because stopped or cold-start session flows are supposed to read attention truth from disk, but they continue to see stale in-memory runtime state instead.

## What Changes

- **BREAKING** Change `session.stop` so the kernel releases live runtime ownership after the stop completes, instead of keeping a paused runtime in memory.
- Ensure stopped-session notification and attention projection paths fall back to persisted attention state immediately after `session.stop`.
- Add regression coverage for stop -> disk-truth fallback in kernel tests and the backend workspace-attention harness.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `session-pause-abort-lifecycle`: `session.stop` must detach the live runtime from kernel ownership so later reads and resumes rehydrate from persisted state instead of a hidden paused runtime.

## Impact

- Affected code: `packages/app-server/src/app-kernel.ts`, backend verification harness, and kernel lifecycle tests.
- Affected APIs: `session.stop` no longer implies that a stopped session still has a live in-memory runtime.
- Affected runtime law: stopped-session inspection, notification, and attention reads return to persisted session state immediately after stop.
