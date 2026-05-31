> Boundary note:
> This design remains relevant for terminal authorization lifecycle and attention-item causality.
> But any references to cli-shell-visible terminal identity must now be read through the boundary in `realign-cli-shell-with-core-system-boundaries`: cli-shell projects one bound TerminalSystem terminal rather than reviving a app-specific `terminal-2` truth.

## Context

The current implementation already covers many app-level surfaces:

- cli-shell parses `--avatar`, `--create-avatar`, `--clear-avatar`, and `--session` separately.
- cli-shell needs one current bound TerminalSystem terminal for the current app session, and Shell Assistant terminal tools must target that bound terminal rather than guessing from historical residue.
- native cli-shell app surfaces subscribe to permission requests for the current bound terminal only.
- TerminalSystem enforces `readonly`, `writer`, `guard`, and `admin` roles, stores approval request history, supports approval/denial, and emits approval request events.
- session runtime can turn terminal observations into attention history through the terminal adapter path.

The broken part is the guard write chain:

1. A guard actor calls `terminal write/input`.
2. TerminalSystem rejects the write and returns an `approvalRequest`.
3. cli-shell renders the request and the manager approves it.
4. TerminalSystem mints a write lease.
5. The original write has already returned, so nothing resumes immediately.
6. The model must notice the approval later and retry the write in another turn.

That explains the user-visible delay after approval. The UI is not merely slow; the system is missing a waitable action object and an attention-backed causal transition for the original command.

## Goals / Non-Goals

**Goals:**

- Make guard terminal writes behave like a single pending action that can continue after approval.
- Preserve the user's simple mental model:
  - `readonly` write returns permission error.
  - `writer/admin` write returns command result.
  - `guard` write waits for manager decision, then returns approved result, denial warning, or timeout action id.
- Ensure authorization popup creation, approval, denial, timeout, cancel, and final result are committed as attention-item facts.
- Keep live authorization authority bound to the live TerminalInstance, not a long-lived database row that can survive kill/bootstrap as actionable authority.
- Keep cli-shell app code out of core laws. cli-shell only projects current-bound-terminal requests and calls generic terminal APIs.
- Keep WebUI and cli-shell independent products over shared terminal-view/TerminalSystem primitives.

**Non-Goals:**

- Do not make managed/hosting imply terminal write authority.
- Do not add cli-shell-specific branches to TerminalSystem, SessionRuntime, or WebUI.
- Do not make root/workspace bash a fallback for a blocked bound-terminal action.
- Do not preserve backward compatibility for old approval-request/lease-only behavior.
- Do not persist actionable guard approval authority across TerminalInstance death. Historical attention facts may remain durable, but actionable state dies with the instance.

## Decisions

### 1. Terminal action is the missing physical object

Introduce a terminal-scoped action object for guard writes and inputs. It is not a cli-shell concept. It belongs to TerminalSystem because TerminalSystem owns PTY input, terminal grants, and live-instance lifetime.

Minimal action fields:

- `actionId`: terminal-scoped monotonic integer or another stable short id accepted by `terminal wait/cancel`
- `terminalId`
- `actorId`
- `mode`: `raw` or `mixed`
- `text`
- `state`: `waiting_authorization`, `executing`, `succeeded`, `failed`, `cancelled`, `denied`
- `createdAt`, `updatedAt`, `expiresAt`
- `decision`: approved/denied/cancelled metadata, actor, optional reason
- `result`: write event id, returned read, failure, or cancellation outcome

The existing `requestId` may remain as an external alias during migration, but the user-facing follow-up contract should use the action id.

Alternative considered: keep approval rows and rely on the model to retry after a lease appears. Rejected because it creates the exact delay observed in cli-shell and makes the manager's approval a future-permission mutation rather than the cause of the requested command.

### 2. Guard write waits, but only within a bounded command window

For a guard actor:

- create a pending action
- commit the attention item for the pending request
- wait for decision until the command-level approval wait timeout
- if approved in time, execute the original action and return its result
- if denied in time, return denial result and reason
- if not decided in time, return a timeout warning and action id

After timeout, the pending action remains valid until its TerminalInstance/action expiry or until it is decided/cancelled. The actor can run `terminal wait` with the id to await the final result, or `terminal cancel` to stop waiting/stop execution.

Alternative considered: block forever. Rejected because model calls, CLI calls, HTTP requests, and UI flows need bounded behavior and observable post-timeout recovery.

### 3. Approval no longer means generic future write authority

Approving a pending action authorizes that action to proceed. It must not only mint a broad write lease and require the guard to retry. Explicit write leases can remain as a separate administrator operation, but approval of a pending command is action-scoped by default.

Alternative considered: approve both the pending action and a timeboxed lease. This can be added later as an explicit manager choice, but the default must satisfy the command the manager reviewed.

### 4. Attention items are the causal ledger and wake source

Every visible authorization transition must be committed through the same attention-item law used by other runtime systems:

- action requested
- approval popup/action request became visible
- manager approved
- manager denied with optional reason
- caller timed out waiting
- caller waited again
- caller cancelled waiting, execution, or any phase
- action began executing
- action succeeded or failed

TerminalSystem remains the authority for live state and PTY effects. AttentionSystem records the causal facts and wakes the runtime. This avoids prompt glue, UI-only state, and hidden retries.

Alternative considered: emit only `terminal.permissionRequest` subscription events. Rejected because subscription events are UI projection, not the durable causal source the model/runtime can reason over.

### 5. TerminalInstance lifetime owns pending authority

Pending guard actions are bound to the live TerminalInstance. Stop, kill, bootstrap, delete, or process replacement cancels/invalidates pending actions and commits attention-item updates that explain why they can no longer execute.

Attention history remains durable, but it is history. It must not be enough to approve and execute a command against a new live PTY instance.

### 6. cli-shell stays a app projection

cli-shell should:

- subscribe only to the current bound terminal
- render the default OpenTUI/HTML approval UI for that terminal
- call generic approve/deny/cancel APIs
- include reason entry where the host supports denial reasons
- never mutate managed/hosting state when rendering or deciding authorization
- never subscribe to internal/hidden terminals to make the popup appear

This keeps the app from polluting the platform and keeps WebUI independent.

## Risks / Trade-offs

- [Risk] Existing approval request rows are database-backed while the desired pending action state is live-instance scoped. -> Mitigation: make actionable pending state live-instance owned, and keep only history/projection rows if needed for inspection.
- [Risk] Hanging `terminal write` can tie up model/tool calls. -> Mitigation: require bounded approval wait timeout and `terminal wait/cancel` follow-up operations.
- [Risk] Approval result may race with timeout. -> Mitigation: action state transitions must be atomic and idempotent; timeout returns a recoverable id, not a false final failure.
- [Risk] Denial/cancel reason UX differs across native cli-shell, other future hosts, and WebUI. -> Mitigation: TerminalSystem accepts optional reason; hosts can initially pass a default reason and improve UI later.
- [Risk] Real AI tests can be slow and flaky. -> Mitigation: keep deterministic BDD coverage for state machines and use gated real AI tests as acceptance evidence for prompt/behavior.

## Migration Plan

1. Add failing BDD tests for the new terminal action lifecycle before changing implementation.
2. Introduce action state behind TerminalSystem input APIs and route guard writes through it.
3. Change approval/denial/cancel APIs to update action state and wake any waiters.
4. Add attention-item commits for all action transitions through the terminal runtime adapter.
5. Add `terminal wait` and `terminal cancel` descriptors, SDK methods, and CLI command coverage.
6. Update cli-shell native app surfaces to use the new action payloads while keeping current-bound-terminal-only subscriptions.
7. Update terminal-view component contracts and any other app hosts independently, without coupling WebUI to cli-shell.
8. Remove or demote old lease-only approval behavior from guard action approval.

## Open Questions

- Should approved guard actions ever grant an additional lease as an explicit manager choice, or should leases remain a separate admin command only?
- What is the default approval wait timeout for model-facing `terminal write/input`: reuse the approval expiry, or use a shorter tool-call timeout?
- Should `terminal cancel` denial/cancel reasons be required for manager-initiated cancellation, or optional for all callers?
