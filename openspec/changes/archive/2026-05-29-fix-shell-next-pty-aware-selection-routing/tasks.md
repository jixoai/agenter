## 1. Alignment / Investigation

- [x] 1.1 Confirm `plans/plan.md` records the relevant code survey, existing OpenSpec survey, and user Q&A.
- [x] 1.2 Confirm no destructive migration, cleanup, or state reset is required for this internal terminal interaction change.

## 2. BDD Contract

- [x] 2.1 Add backend-utils BDD tests for plain drag selection, active mouse-tracking passthrough, wheel passthrough, Shift override, and explicit pointer effects.
- [x] 2.2 Add termless-core BDD tests proving DECSET/DECRST mouse modes update `TerminalMouseTrackingState`.
- [x] 2.3 Add terminal-transport-protocol BDD tests proving mouse state roundtrips in full frame and patch variants.
- [x] 2.4 Add terminal-system BDD tests proving projected frames carry mouse state with selection interaction truth.
- [x] 2.5 Add Shell-Next renderable BDD tests proving scrolled double-click and scrolled drag send absolute backend rows.
- [x] 2.6 Add Shell-Next app BDD tests proving `pty-mouse` pointer-up does not trigger primary copy.

## 3. Implementation

- [x] 3.1 Run `bun run openspec:vision -- commit-check fix-shell-next-pty-aware-selection-routing --phase apply` before app-code work starts and keep unrelated `bun.lock` unstaged.
- [x] 3.2 Add `TerminalMouseTrackingState` to termless-core interaction/frame state and expose it from `XtermBridge`.
- [x] 3.3 Propagate mouse state through terminal-system frame projection and terminal-transport-protocol encoding/decoding.
- [x] 3.4 Implement xterm mouse encoding and PTY-aware pointer routing in `termless-backend-utils`.
- [x] 3.5 Wire Shell-Next terminal views to pass modifiers, viewport-local points, and `selectionSources.sourceStartRow`.
- [x] 3.6 Restrict Shell-Next primary-copy mirroring to `selection-finalized` results.
- [x] 3.7 Remove or avoid redundant Shell-Next local pointer/selection glue made unnecessary by backend-utils routing.

## 4. Verification

- [x] 4.1 Run focused backend/core/transport/system/Shell-Next tests for selection and interaction.
- [x] 4.2 Run `bun run openspec:vision -- validate fix-shell-next-pty-aware-selection-routing`.
- [x] 4.3 Run `bun run openspec:vision -- check fix-shell-next-pty-aware-selection-routing` after review artifacts exist.
- [x] 4.4 Confirm unrelated dirty files, especially `bun.lock`, were not staged or rewritten by this change.

## 5. Self-Review Loop

- [x] 5.1 Generate `review/self-review.md` comparing implementation against `plans/plan.md`, specs, and tasks.
- [x] 5.2 Generate `review/self-review.html` with command/test evidence and remaining risk.
- [x] 5.3 If review updates OpenSpec artifacts or reopens tasks, commit those artifact changes before the next apply loop.
- [x] 5.4 If review cannot exit normally, run `bun run openspec:vision -- handoff fix-shell-next-pty-aware-selection-routing` and commit the handoff evidence before returning to user discussion.
- [x] 5.5 If review exits normally, leave archive for user acceptance and do not archive silently.

## Agent Checkbox Law

- [x] 6.1 Update only task checkboxes completed and verified in the current working context.
