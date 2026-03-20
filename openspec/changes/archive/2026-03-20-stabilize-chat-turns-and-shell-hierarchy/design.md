## Context

The current implementation already stores full LoopBus cycles and exposes them through `chatCyclesBySession`, but the WebUI still uses those cycles too directly for the main Chat stage. That causes background startup work such as terminal diffs, attention bookkeeping, or tool-only assistant activity to show up as if they were user-facing turns. Separately, model calls are only persisted when the full model interaction returns, so Devtools cannot reliably show an in-flight call, and a stalled model request leaves the UI in a vague “preparing” state. The shell also duplicates app, workspace, and session facts across `SidebarNav`, `AppHeader`, `WorkspaceShellFrame`, and `SessionToolbar`.

## Goals / Non-Goals

**Goals:**
- Make model calls observable from start to finish, with a persisted running state and a deterministic timeout-to-error path.
- Keep Chat strictly user-facing by filtering out cycles that are not part of the conversation stage.
- Preserve full technical fidelity in Devtools and cycle/storage APIs.
- Re-establish a fixed shell hierarchy where each chrome layer owns one level of information.

**Non-Goals:**
- Redesign LoopBus persistence or replace cycle storage with a different ledger model.
- Remove background cycles from storage or from Devtools.
- Change provider routing or prompt construction beyond what is needed for lifecycle visibility and timeout handling.

## Decisions

### Model calls become lifecycle records
- Add lifecycle fields to `SessionModelCallRecord` and allow the database row to be updated in place.
- Persist the row once at request start with the full request body and `status = "running"`.
- Update the same row on completion with response or error details plus `completedAt`.
- Rationale: Devtools needs a stable identifier for an in-flight call, and completion-only inserts cannot represent hangs or request-start state.

### Model timeouts are enforced in the app-server runtime
- Add a fixed timeout around the runtime model request path and convert timeout into a normal error completion for the active call.
- Rationale: the user explicitly prefers auto-timeout over indefinite waiting, and the runtime already owns user-facing recovery semantics.
- Alternative rejected: UI-only timeout. It would not persist failure facts or resolve the backend hang state.

### Chat projection filters by chat visibility, not by raw cycle existence
- Introduce a visibility predicate in the WebUI/client projection layer: a cycle is chat-visible only if it contains a user message input, a `/compact` user command, a `to_user` output/live stream, or a turn-scoped failure summary.
- Background cycles remain in `chatCyclesBySession` and Devtools cycle lists, but Chat uses only the visible subset.
- Rationale: storage fidelity and chat readability are different concerns; hiding background cycles in Chat should not erase them from expert tooling.

### Shell hierarchy is enforced by ownership boundaries
- `SidebarNav` owns application identity and running-session entry.
- `AppHeader` owns only app-level route context and passive connectivity/runtime state.
- `WorkspaceShellFrame` owns workspace context plus route tabs/bottom nav.
- `SessionToolbar` owns only route-local session state and the single start/stop action.
- Rationale: repeated context is the main cause of visual noise, so the fix is structural ownership rather than styling tweaks alone.

## Risks / Trade-offs

- [Risk] Updating model-call rows in place may break existing client assumptions that rows are append-only. → Mitigation: keep the same id stable, update runtime-store merge logic, and add explicit tests for running→done/error transitions.
- [Risk] Filtering cycles for Chat may hide useful debugging information from expert users. → Mitigation: keep Devtools `Cycles` as the authoritative technical view and add tests that background cycles still exist there.
- [Risk] Timeout handling may surface false negatives on very slow providers. → Mitigation: choose a conservative fixed timeout, persist the exact timeout error, and keep session recovery explicit through retry/start-stop flows.
- [Risk] Shell cleanup may regress compact layouts. → Mitigation: cover desktop and compact layouts with Storybook DOM tests and browser walkthroughs.
