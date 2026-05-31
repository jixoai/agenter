## Context

The archived `rework-terminal-live-registry-and-history-projection` change moved the system toward the right law: live terminals, killed history, and archive are projections of one durable terminal-instance truth. The review found that the law is not yet fully enforced at the edges:

- daemon cold-start compensation currently happens during TerminalControlPlane construction, before app-server/runtime subscribers can observe the lifecycle event
- `daemon_recovery_killed` can be emitted as a generic `updated` signal, so runtime killed handlers may not run
- terminal death muting currently risks becoming a direct focus-state mutation plus a later fact, instead of a lifecycle attention consequence
- client/server naming still lets `globalHistory` mean "combined index", which makes it too easy for Studio or cli-shell to show killed terminals in live candidates
- runtime CLI and skill text still normalize "bootstrap killed-history terminal" as a common recovery path, even though app behavior should prefer a clean new terminal

The app story is simple:

1. A live terminal dies, or the daemon restarts and discovers an old running row with no PTY.
2. The terminal is now dead evidence, not an active shell.
3. It leaves live lists and live tabs.
4. Its attention context becomes muted through an auditable lifecycle fact.
5. Operators can inspect, archive, or delete it through explicit history/index surfaces.
6. Products such as cli-shell create or select a live terminal instead of silently reviving the dead one.

## Goals / Non-Goals

**Goals:**

- Make explicit stop, natural PTY exit, and daemon cold-start compensation converge on one observable killed pipeline.
- Ensure killed post-workflow includes live registry removal, focus/cache cleanup, approval/lease cleanup, runtime publication invalidation, and bound AttentionContext muting.
- Make projection names match behavior: live list is live-only, history is killed-only, index is live+killed.
- Keep cli-shell and Studio as consumers of core projections; they must not patch terminal lifecycle truth locally.
- Update runtime terminal descriptors and skill guidance so killed terminal bootstrap is an explicit forensic/recovery escape hatch, not the normal "continue" instruction.
- Add a change-local self-review loop that repeatedly checks implementation, tests, docs, and user-visible behavior against the user's original lifecycle expectation.

**Non-Goals:**

- Do not introduce a second `terminal_history` table.
- Do not make cli-shell own terminal lifecycle state.
- Do not remove history/archive/delete management.
- Do not redesign terminal transcript retention beyond making killed evidence explicit.
- Do not solve unrelated cli-shell tmux layout or Chat bugs in this change.

## Decisions

### Decision 1: Recovery emits a lifecycle-class killed consequence after the control plane is observable

Daemon cold-start compensation must not be only a constructor-time SQL normalization. The control plane should either defer recovery replay until observers are registered or expose a recovery-replay hook that app-server calls after binding terminal-system events.

The killed pipeline must produce a lifecycle-class consequence for `daemon_recovery_killed`, not a generic `updated` signal. Consumers should not need to special-case "updated might mean killed".

Alternative considered: keep constructor-time normalization and have clients infer killed rows by refetching all projections. Rejected because it misses AttentionContext muting and violates the "post-workflow" requirement.

### Decision 2: Terminal death attention changes are committed facts first

Terminal death should enter the runtime attention system through terminal lifecycle ingress. That ingress should carry the event (`terminal_killed`), source (`tty:<terminalId>`), payload, score, and boundary channel, then the runtime applies the focus-state consequence to `muted` as part of processing that lifecycle fact.

Directly flipping focus state is still allowed as an internal effect of applying the lifecycle consequence, but it must not be the primary cause. The auditable source of the visible effect is the committed terminal lifecycle ingress.

Alternative considered: keep `applyAttentionFocusState(..., "muted")` directly inside app/runtime event handlers and append a fact afterward. Rejected because the effect appears before the traceable cause.

### Decision 3: Projection API names must encode projection semantics

The platform should expose distinct concepts:

- live catalog: live-only terminal entries
- killed history: killed non-archived entries
- terminal index: live entries followed by killed non-archived entries
- archive: killed archived entries

The implementation may keep old wire names only during a very short local transition, but this change is allowed to be breaking. The preferred final shape is explicit names such as `globalList`, `globalHistory`, `globalIndex`, and `globalArchiveList`, where `globalHistory` is killed-only and `globalIndex` is live+killed.

Alternative considered: keep `globalHistory` as live+killed and rely on route-local filters. Rejected because the name itself keeps causing app drift.

### Decision 4: App binding recovery prefers a new live terminal

For cli-shell and other products, a killed binding is historical evidence. Re-entering `shell-7` should reuse a live binding if one exists, otherwise create a new terminal binding for that app resource. Killed bindings may be inspected to avoid confusing resource-key numbering or to show history, but they are not normal reusable live shells.

Explicit killed-terminal bootstrap remains possible only through history-oriented surfaces where the operator or AI deliberately asks to recover that exact durable instance.

Alternative considered: let generic app binding bootstrap killed entries when `start: true`. Rejected because it makes dead history look like a normal paused shell.

### Decision 5: Studio and cli-shell consume projections, not lifecycle internals

Studio terminal tabs and cli-shell startup navigation should both consume live projection APIs. Their code may display index/history management routes, but they must not reconstruct live status by scanning all terminal records. If a terminal disappears from live projection, live tabs and selectors should drop it and navigate to an explicit fallback.

Alternative considered: add feature-local filters everywhere. Rejected because it repeats the same rule in every app and hides core projection bugs.

### Decision 6: Self-review is a mandatory change workflow, not a app capability

This change needs a lightweight review loop after each implementation pass:

1. Restate the original user requirement in concrete terms.
2. Map current code paths to that requirement.
3. Run focused BDD tests and at least one real daemon restart scenario.
4. Inspect user-facing surfaces: cli-shell chooser, Studio live tabs, Studio history/index.
5. Record drift as tasks or spec updates before claiming completion.

This is intentionally not a runtime feature. It is a change-local guardrail because the previous implementation looked green in pieces but still drifted from the app law.

## Risks / Trade-offs

- [Risk] Deferred recovery replay can double-apply killed side effects if the system restarts during recovery.  
  -> Mitigation: make the killed pipeline idempotent per terminal id and last stopped timestamp/reason.

- [Risk] Renaming/splitting `globalHistory` can break Studio and client-sdk callers.  
  -> Mitigation: update all callers in one breaking pass and add projection-specific tests.

- [Risk] Making killed bootstrap exceptional may surprise workflows that intentionally recover the same terminal id.  
  -> Mitigation: keep explicit history-oriented bootstrap/recovery verbs and update help text to make intent clear.

- [Risk] Attention muting through lifecycle ingress may create duplicate lifecycle facts if explicit stop and natural exit both fire.  
  -> Mitigation: dedupe lifecycle commits by terminal id, event, and killed timestamp/reason.

- [Risk] Self-review can become a checkbox ritual.  
  -> Mitigation: each review pass must include at least one concrete mapping from original requirement to code/test/UI evidence, and unresolved drift must become an unchecked task.

## Migration Plan

1. Add focused failing BDD coverage for daemon recovery stale-running compensation, including AttentionContext mute and terminal live/history projection after restart.
2. Refactor TerminalControlPlane recovery so stale running rows replay the same killed pipeline through lifecycle-class observable consequences.
3. Update runtime terminal adapter/attention integration so `terminal_killed` ingress is the auditable cause of muting.
4. Split client/server terminal projections into live/history/index/archive semantics and update all typed store methods.
5. Update cli-shell navigation and app binding tests to prove killed bindings are not reusable Shell candidates.
6. Update Studio terminal workbench/history routes and DOM/contract tests to prove live tabs are live-only and killed terminals move to explicit history/index.
7. Update runtime descriptor and skill guidance to prefer new terminal creation over killed-terminal bootstrap for normal work.
8. Run the self-review loop, fix drift, and only then mark the change ready for apply completion.

## Open Questions

- Should the final API name for live+killed projection be `globalIndex`, `globalTerminalIndex`, or another project-standard term?
- Should explicit killed-terminal bootstrap require an additional flag such as `recover: true` to make intent unambiguous?
- Should terminal death lifecycle commits be deduped in TerminalSystem before publication or in runtime attention ingestion?
