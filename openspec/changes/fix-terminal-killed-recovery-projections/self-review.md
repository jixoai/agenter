## Original Requirement Alignment

### Pre-Implementation Review

The original lifecycle requirement for this change is:

- A killed terminal instance is dead evidence, not an active shell.
- Once a terminal is killed, it must leave live terminal surfaces and must not be selected as a reusable live terminal by products.
- Terminal death must complete its post-workflow: the terminal-system live projection is cleaned, the bound AttentionContext is muted, and downstream clients observe the same result after daemon restart as after explicit kill.
- Daemon cold-start recovery must replay the killed workflow for stale `running` rows instead of only normalizing database state.
- `terminal_instance` remains the durable truth. Live, killed history, combined index, and archive are projections over that truth; there is no separate `terminal_history` table.
- cli-shell and Studio are products. They must consume platform projections and SDK contracts, not reconstruct terminal lifecycle truth locally.
- Self-review is a development workflow guardrail only. It must not create runtime state, UI state, database rows, or public APIs.

### Acceptance Map To Fill During Apply

| Requirement | Code path | Test evidence | UI / real-flow evidence | Drift |
| --- | --- | --- | --- | --- |
| Killed terminals leave live surfaces | `packages/terminal-system/src/terminal-control-plane.ts`, `packages/app-server/src/app-kernel.ts`, `packages/app-server/src/trpc/router.ts`, `packages/client-sdk/src/runtime-store.ts`, `apps/studio/src/lib/features/terminals/terminal-history-route.svelte` | `packages/terminal-system/test/control-plane.test.ts`, `packages/app-server/test/trpc-router.test.ts`, `packages/client-sdk/test/runtime-store.test.ts`, `packages/cli/test/cli.e2e.test.ts` | `packages/cli/test/cli.e2e.test.ts` abrupt-daemon-death smoke proves a recovered terminal leaves live projection and enters killed history/index | Low |
| Daemon restart replays killed workflow | `TerminalControlPlane.replayRecoveredLifecycle()`, `AppKernel.start()`, `SessionRuntime.start()` | `packages/terminal-system/test/control-plane.test.ts`, `packages/app-server/test/session-runtime.attention-system.test.ts`, `packages/cli/test/cli.e2e.test.ts` | `packages/cli/test/cli.e2e.test.ts` kills the daemon process and restarts it against the same home root | Low |
| AttentionContext muting is caused by lifecycle ingress | `packages/app-server/src/session-runtime.ts`, `packages/app-server/src/runtime-system-kernel-adapters/terminal-adapter.ts` | `packages/app-server/test/session-runtime.attention-system.test.ts`, `packages/app-server/test/runtime-terminal-kernel-adapter.test.ts` | In-process runtime recovery smoke confirms the bound terminal context is muted and the commit meta carries terminal lifecycle ingress details | Low |
| Products do not reuse killed shells as live candidates | `apps/cli-shell/src/navigation-model.ts`, `packages/client-sdk/src/app-runtime.ts`, `apps/cli-shell/src/run-cli-shell.ts` | `apps/cli-shell/test/navigation-model.test.ts`, `packages/client-sdk/test/app-runtime.test.ts`, `apps/cli-shell/test/cli-shell.test.ts` | CLI startup chooser tests only see live Shells; killed terminals remain historical and only affect numbering / explicit recovery | Low |
| History/index/archive remain projections over terminal_instance | `packages/app-server/src/app-kernel.ts`, `packages/app-server/src/trpc/router.ts`, `packages/client-sdk/src/runtime-store.ts`, `apps/studio/src/lib/features/terminals/terminal-history-route.svelte`, `apps/studio/src/routes/(app)/terminals/+page.svelte` | `packages/app-server/test/trpc-router.test.ts`, `packages/client-sdk/test/runtime-store.test.ts`, `apps/studio/src/lib/features/terminals/terminal-history-route-contract.spec.ts`, `apps/studio/src/lib/features/terminals/terminals-root-route-contract.spec.ts` | Studio route contracts now treat `/terminals` as live-only entry and `/terminals/history` as index/history surface | Low |
| Self-review stays out of runtime app behavior | This file and `openspec/changes/fix-terminal-killed-recovery-projections/tasks.md` only | N/A | N/A | None |

### Apply Round 1 Notes

- `TerminalControlPlane.bootstrap(...)` now requires explicit `recoveryIntent: "killed-history"` before a killed terminal can re-enter live state.
- `replayRecoveredLifecycle()` moves stale `running` rows through the same killed pipeline after observers bind, instead of silently normalizing them in the constructor.
- The killed pipeline emits one lifecycle-class change, deduplicates repeated recovery replay, and keeps killed rows queryable in history/index while dropping them from live projection.
- `SessionRuntime` now forwards terminal lifecycle ingress metadata, and terminal-kill recovery mutes the bound attention context through the committed lifecycle commit path.
- `RuntimeStore` now understands live/history/index/archive as distinct families instead of route-local filters over one blob of terminal truth.
- `cli-shell` startup navigation now reads live terminals from projection APIs and treats killed bindings as history-only evidence.

### Apply Round 2 Notes

- The restart smoke is now stronger than the earlier in-process evidence: `packages/cli/test/cli.e2e.test.ts` kills the real daemon process, restarts it on the same authority, and checks that the live list no longer contains the dead terminal while history/index do.
- `packages/app-server/test/trpc-router.test.ts` proves the server projection split after a cold-start recovery seed.
- `apps/studio/src/lib/features/terminals/*.spec.ts` and route contracts keep the live/history/archive surfaces separated at the source level.
- `packages/client-sdk/test/runtime-store.test.ts` proves the store keeps the live cache, the killed history cache, the combined index cache, and the archive cache independent.

### Apply Round 3 Notes

- The implementation is aligned with the original user requirement on the platform laws now:
  - killed terminals leave live surfaces,
  - restart replays the killed workflow,
  - attention mute is caused by lifecycle ingress,
  - products consume projections instead of reconstructing lifecycle truth locally.
- Residual risk is mostly around human UX verification, not contract drift:
  - the cli-shell chooser is covered by model and dependency tests, but not by a fresh manual TTY walk in this session;
  - Studio route contracts are covered, but a full browser walk for the updated `/terminals` live-first experience has not been rerun in this session.

### Apply Round 4 Failed Review Finding

The previous "Low" risk judgment for cli-shell startup navigation was wrong. It proved only the positive contract "killed terminals are not selectable" and missed the stronger app contract "only user-resumable Shell roots are selectable".

The missed counterexamples are:

- `not_started` terminal rows: live from the platform perspective because they are not killed, but not resumable app Shells.
- Legacy `shell-N:terminal-M` resource keys: evidence of old sub-binding layout, not a canonical Shell root to show in the chooser.
- Non-canonical verification/test resource keys: useful during tests or migrations, but not user-facing startup Shell choices.

The repaired self-review rule is:

- First name the platform projection being consumed.
- Then name the app projection being displayed.
- Then test at least one negative dirty-data row for every projection boundary before marking user-facing alignment complete.

This is a development workflow rule only. It must not add runtime UI, daemon state, public API, or database state.

### Apply Round 5 Repaired Gate Result

The repaired gate is now backed by a failing-then-passing BDD scenario in `apps/cli-shell/test/navigation-model.test.ts`.

The scenario builds a dirty platform-live projection containing:

- a `not_started` cli-shell terminal row,
- a legacy `shell-3:terminal-1` cli-shell terminal row,
- a non-canonical `shell-verify-shell-frame` cli-shell row,
- and a canonical running `shell-14` row.

The expected app projection is:

- selectable existing Shells only include `shell-14`,
- New Shell chooses `shell-2`, because `shell-1` is known and `shell-3` is reserved by the legacy root,
- none of the dirty rows appear as user-resumable Shell choices.

The implementation now separates:

- `readCanonicalShellRoot(...)`: selectable app Shell root, exact `shell-N` only;
- `readKnownShellRoot(...)`: numbering evidence, exact `shell-N` or legacy `shell-N:terminal-M`;
- `isCliShellTerminal(...)`: selectable rows must be `processPhase === "running"`.

The default `agenter-app-shell` test script now includes `test/navigation-model.test.ts`, so this regression is part of the package-level BDD gate instead of a one-off command.
