## 1. BDD Baseline

- [x] 1.1 Add a failing terminal-system BDD test for daemon cold-start recovery: Given a persisted `running` terminal row has no live PTY When the daemon starts Then the row becomes `killed`, leaves live projection, appears in killed history, and emits a lifecycle-class terminal-death consequence.
- [x] 1.2 Add an app-server/runtime BDD test for daemon recovery attention replay: Given a focused terminal is recovered as killed When runtime receives the terminal lifecycle event Then the bound AttentionContext is muted through committed lifecycle ingress, not by a silent direct mutation.
- [x] 1.3 Add projection contract tests proving live list, killed history, combined index, and archive return different semantic sets with no route-local filtering required.
- [x] 1.4 Add client-sdk/product-runtime tests proving a killed terminal binding is not treated as a reusable live product shell and a clean live terminal is created when normal product startup needs one.
- [x] 1.5 Add cli-shell startup chooser tests proving only live cli-shell terminal bindings are selectable, while killed bindings may only affect numbering/history metadata.
- [x] 1.6 Add Studio contract or DOM tests proving live terminal tabs consume live projection only and killed terminals appear only in explicit history/index/archive surfaces.

## 2. Terminal Lifecycle Law

- [x] 2.1 Move stale-running recovery out of unobservable constructor-only normalization or add a post-subscription replay hook so app-server/runtime observers can see daemon recovery killed events.
- [x] 2.2 Emit `daemon_recovery_killed` as a lifecycle-class terminal-death consequence instead of a generic `updated` event.
- [x] 2.3 Make explicit stop, natural PTY exit, and daemon recovery converge on one idempotent killed pipeline covering live registry removal, approval/lease cleanup, cache cleanup, publications, and projection invalidation.
- [x] 2.4 Deduplicate killed side effects by terminal id and killed timestamp/reason so recovery replay and natural exit cannot double-commit terminal death.
- [x] 2.5 Ensure killed terminals remain durable terminal-instance rows for history/index/archive, but cannot be returned from live projection after recovery.

## 3. Runtime Attention Integration

- [x] 3.1 Preserve the terminal lifecycle ingress fields required for attention processing, including event name, source terminal id, payload, score, and boundary channel or equivalent routing metadata.
- [x] 3.2 Change terminal death muting so the committed lifecycle ingress is the auditable cause and `muted` focus state is the applied consequence.
- [x] 3.3 Add regression coverage that fails if runtime mutates terminal focus state before committing or ingesting the terminal-death fact.
- [x] 3.4 Verify daemon restart compensation replays the same attention mute behavior as explicit terminal kill.

## 4. Projection APIs And Consumers

- [x] 4.1 Split or rename server/client APIs so `globalList` means live-only, `globalHistory` means killed non-archived only, `globalIndex` means live plus killed non-archived, and archive APIs mean archived killed entries only.
- [x] 4.2 Update all typed client-sdk stores and runtime subscriptions to use projection names that match their semantics.
- [x] 4.3 Update Studio terminal routes so `/terminals/*` live tabs cannot show killed terminals after daemon restart; add an explicit index/history surface for live-first and killed-by-killed-time browsing.
- [x] 4.4 Update cli-shell startup navigation to source selectable shells from the live projection only and to create a new terminal when the prior binding is history-only.
- [x] 4.5 Update product binding recovery so killed terminal bootstrap is only reachable through an explicit recovery/forensic path, not normal product startup.
- [x] 4.6 Update runtime JSON tool descriptors and built-in terminal skill guidance so normal work prefers new terminal creation and killed bootstrap is described as exceptional recovery.

## 5. Real Flow Verification

- [x] 5.1 Run a daemon restart smoke test with at least one previously live terminal and record evidence that the recovered terminal is absent from live list, present in killed history/index, and no longer shown as a Studio live tab.
- [x] 5.2 Run a cli-shell startup smoke test after daemon restart and verify the chooser excludes killed shell bindings while still allowing creation or selection of a live shell.
- [x] 5.3 Verify AttentionContext state after recovery by inspecting the committed lifecycle fact and the resulting muted state for the terminal-bound context.
- [x] 5.4 Verify explicit killed-terminal recovery remains possible only through the intended history/recovery action and is not presented as the default resume path.
- [x] 5.5 Run focused package tests for terminal-system, app-server runtime attention, client-sdk, Studio terminal routes, and cli-shell navigation before requesting user acceptance.

## 6. Change-Local Self Review Loop

- [x] 6.1 Before implementation, write a short review note inside this change that restates the original user requirement in concrete acceptance bullets: killed terminals must leave live surfaces, AttentionContext must mute, restart must replay the killed workflow, and products must not locally patch lifecycle truth.
- [x] 6.2 After the terminal-system/runtime pass, perform self-review iteration 1: map each original acceptance bullet to the exact code path, focused tests, and any missing evidence; convert every mismatch into an unchecked task before continuing.
- [x] 6.3 After the client-sdk/Studio/cli-shell pass, perform self-review iteration 2: map each user-facing surface to the intended projection contract and verify there is no product-local lifecycle reconstruction.
- [x] 6.4 After real flow verification, perform self-review iteration 3: compare actual daemon restart behavior against the original requirement and record remaining drift, even if all automated tests are green.
- [x] 6.5 Treat self-review as non-product workflow only: do not add runtime UI, daemon state, database rows, or public APIs solely to represent the review loop.
- [x] 6.6 Do not mark this change ready to archive until the final self-review note says whether the implementation is fully aligned, partially aligned with documented residual risk, or blocked by a named architectural decision.
- [x] 6.7 Repair the self-review method: distinguish platform projections from product-specific selectable projections and require negative dirty-data samples before declaring user-facing alignment.
- [x] 6.8 Add cli-shell startup chooser regression coverage for dirty live projections containing `not_started`, legacy `shell-N:terminal-M`, and non-canonical verification/test resource keys.
- [x] 6.9 Update cli-shell startup navigation so selectable existing Shells are only canonical running cli-shell roots, while non-selectable known roots can still reserve numbering.
- [x] 6.10 Re-run focused cli-shell navigation tests and OpenSpec validation, then update the self-review note with the failed review cause and repaired gate.
