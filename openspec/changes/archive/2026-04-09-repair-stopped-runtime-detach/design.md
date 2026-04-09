## Context

The workspace-attention backend refactor already moved notification truth toward persisted attention state when no runtime is active. The remaining defect is that `AppKernel.stopSession()` still calls `runtime.stop()` and leaves the runtime registered in `AppKernel.runtimes`. That means stopped-session code paths still read the old in-memory runtime, so the kernel violates its own law that stopped or cold-start sessions must project from durable disk facts.

`SessionRuntime.stop()` is not a full teardown primitive. It pauses loop activity and drops presence, but it keeps subscriptions, stores, and runtime-owned resources alive for in-place resume. Because of that, simply hiding the runtime from one code path is not enough; the kernel must stop treating `session.stop` as "paused but still owned".

## Goals / Non-Goals

**Goals:**

- Make `session.stop` release runtime ownership from the kernel.
- Ensure stopped-session notification and attention reads immediately fall back to persisted attention state.
- Add regression tests and harness coverage for the stop -> persisted-truth law.

**Non-Goals:**

- Rework the raw `SessionRuntime.stop()` helper used by lower-level runtime tests.
- Introduce backward compatibility for the old paused-runtime ownership model.
- Make any frontend or WebUI changes.

## Decisions

### Decision: `AppKernel.stopSession()` SHALL fully detach kernel runtime ownership

`session.stop` will use a full runtime teardown path before removing the runtime from `AppKernel.runtimes`.

Why:

- A stopped session must no longer have a live in-memory truth source.
- `SessionRuntime.stop()` is pause-oriented and keeps runtime-owned resources alive, so detaching after that call would leave a ghost runtime behind.
- `startSession()` already supports rehydrating a runtime from persisted session state, so stop does not need to preserve in-memory ownership.

Alternatives considered:

- Call `runtime.stop()` and then only `detachRuntime(sessionId)`.
  Rejected because the paused runtime would keep subscriptions and open stores alive outside kernel ownership.
- Keep runtime ownership and special-case stopped-session notification reads.
  Rejected because that preserves dual truth and leaks the wrong lifecycle law into more callers.

### Decision: Stopped-session verification SHALL assert persisted attention fallback

Kernel regression tests and the backend harness will verify not only that the runtime disappears, but also that stopped-session notification reads are sourced from persisted attention data.

Why:

- The user-facing failure was not "a map entry exists", but "stopped sessions still behave like they never left memory".
- Verifying the projection path prevents future regressions where lifecycle and notification laws drift apart again.

## Risks / Trade-offs

- [Stop no longer preserves resumable in-memory runtime state] -> Mitigation: rely on existing persisted rehydration through `startSession()` and keep the contract explicit in tests.
- [Callers still assuming paused runtime ownership after stop] -> Mitigation: update targeted lifecycle tests to encode the new law.
- [Kernel stop and session stop could diverge] -> Mitigation: align `session.stop` with the same full-teardown ownership rule already used by kernel shutdown.

## Migration Plan

1. Update the repair change artifacts to encode the new stop law.
2. Change `AppKernel.stopSession()` to use the full teardown path and detach runtime ownership.
3. Rewrite the affected lifecycle test expectations and add a persisted-attention notification fallback test.
4. Re-run the backend workspace-attention harness before returning to the main refactor change.

## Open Questions

- None for this repair change.
