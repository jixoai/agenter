## Context

The current runtime ownership model in `app-kernel` assumes `stopSession()` means `SessionRuntime.stop()` plus runtime detachment. `SessionRuntime.stop()` is destructive: it disposes the terminal control plane, clears terminals, clears loop state, and closes the session DB. That behavior is closer to an abort than a pause.

The user requirement is explicit:
- `stop`: stop LoopBus and cancel the current model call only.
- `abort`: include `stop`, then destroy runtime-scoped resources such as terminals.

## Goals / Non-Goals

**Goals:**
- Add first-class paused session semantics.
- Separate pause from destructive runtime teardown.
- Ensure `stop` cancels in-flight model work through `AbortSignal`.
- Keep inspection/history available after pause.

**Non-Goals:**
- Rework archived session semantics.
- Add remote/offline synchronization for message-system.
- Redesign terminal APIs in this change.

## Decisions

### `stop` means pause, not teardown
`session.stop` transitions the session to `paused`, leaves the `SessionRuntime` instance registered, and stops further LoopBus scheduling until resumed.

Why: this matches the architecture where attention is central and systems remain attached unless explicitly aborted.

### `abort` is the destructive teardown path
`session.abort` first performs pause semantics, then disposes the runtime and removes it from `app-kernel` ownership.

Why: teardown remains necessary, but it must not be overloaded onto normal stop.

### `start` doubles as resume
`session.start` resumes a paused runtime in place, and only creates a new runtime when none exists.

Why: this keeps the API compact while preserving the desired lifecycle split.

### Paused state is explicit in types and UI
`SessionStatus` adds `paused`, and the primary UI copy becomes `Paused / Resume`.

Why: using `stopped` for both paused and aborted hides important lifecycle differences.

## Risks / Trade-offs

- [State drift] -> leaving runtimes resident after pause can expose stale subscriptions unless pause cancels waiters cleanly.
- [Implicit start regressions] -> endpoints that call `ensureRuntime()` must stay limited to explicit execution actions.
- [UI migration churn] -> existing `stopped` assumptions in selectors and notices must be updated consistently.

## Migration Plan

1. Add `paused` to session status types and runtime publication.
2. Split `SessionRuntime` into pause and abort operations.
3. Update `app-kernel` session procedures to map `stop` to pause and add `abort`.
4. Update client-sdk and WebUI selectors/toolbars to reflect `Paused / Resume`.
5. Add integration and UI regression tests before marking tasks done.
