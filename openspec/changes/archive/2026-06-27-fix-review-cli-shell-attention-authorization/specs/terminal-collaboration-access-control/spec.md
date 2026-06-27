## MODIFIED Requirements

### Requirement: Guard writes SHALL create approval requests

Actors with the `guard` role SHALL NOT write directly to the PTY without a prior decision. Instead, each blocked write/input attempt SHALL create or refresh one live TerminalInstance-scoped approval action with an explicit, configurable expiry whose default is `90s`. The action SHALL preserve the exact requested input and SHALL be waitable by the original caller. The action SHALL remain unable to reach the PTY until approved.

#### Scenario: Guard submit creates approval action
- **WHEN** a guard attempts to submit terminal input without a valid action approval
- **THEN** the control plane creates a pending approval action targeted at the current terminal admin
- **AND** the requested raw or mixed input is stored on that action
- **AND** the input does not reach the PTY while the action is waiting for authorization

#### Scenario: Guard submit waits for decision within command window
- **WHEN** a guard submits terminal input and the caller allows waiting for approval
- **THEN** the write/input call waits for an approval, denial, cancellation, or timeout decision up to the bounded command wait
- **AND** it does not return success before the requested bytes actually reach the PTY

#### Scenario: Approval timeout returns action id
- **WHEN** a guard submit remains pending beyond the bounded command wait
- **THEN** the write/input call returns a timeout warning with the pending terminal action id
- **AND** the caller can pass that id to `terminal wait` or `terminal cancel`
- **AND** the control plane does not execute the input merely because the caller timed out waiting

#### Scenario: Expired approval action does not unlock writes
- **WHEN** an approval action reaches its expiry without an approval decision
- **THEN** the action is no longer actionable for write execution
- **AND** later writes still require a new approval action or stronger terminal authority

#### Scenario: Offline admin timeout falls back to denied action
- **WHEN** an approval action is waiting while no current terminal admin is online to process it
- **THEN** the action remains pending only until the configured expiry window
- **AND** if no admin comes online and decides before expiry, the action transitions to denied or expired without reaching the PTY

## REMOVED Requirements

### Requirement: Approved requests SHALL mint timeboxed write leases

**Reason**: Lease-only approval does not resume the original terminal action. It explains the observed cli-shell delay after approval because the original `terminal write/input` already returned and only a later retry can use the lease.

**Migration**: Approval of a pending guard action SHALL authorize and resume that exact pending action. Explicit write leases MAY remain as separate administrator grants, but they are not the default effect of approving one reviewed command.

## ADDED Requirements

### Requirement: Approved guard actions SHALL resume the original pending terminal action

When a manager approves a pending guard action, TerminalSystem SHALL execute the original requested input exactly once for that action. If the original caller is still waiting, the original `terminal write/input` call SHALL return the execution result immediately after the PTY write and optional return-read settle. If the original caller already timed out, the result SHALL be available through `terminal wait`.

#### Scenario: Approval resumes still-waiting write
- **WHEN** a guard `terminal write` is waiting for approval
- **AND** the terminal manager approves that action before the command wait timeout
- **THEN** TerminalSystem writes the original input to the PTY
- **AND** the original `terminal write` call returns the executed write result

#### Scenario: Approval result remains waitable after caller timeout
- **WHEN** a guard `terminal write` returned an approval timeout with action id `N`
- **AND** the terminal manager later approves action `N`
- **THEN** TerminalSystem writes the original input to the PTY
- **AND** `terminal wait N` returns the final execution result

#### Scenario: Denial returns warning without PTY effect
- **WHEN** the terminal manager denies a pending guard action
- **THEN** the action transitions to `denied`
- **AND** the original caller or later `terminal wait` receives a denial warning
- **AND** the requested input never reaches the PTY

#### Scenario: Denial may include manager reason
- **WHEN** the terminal manager denies a pending guard action with a reason
- **THEN** the denial result includes that reason
- **AND** the reason is committed as part of the terminal authorization fact

### Requirement: Guard action states SHALL be explicit and terminal-scoped

TerminalSystem SHALL expose terminal action state for guard writes and inputs. The state set SHALL include at least `waiting_authorization`, `executing`, `succeeded`, `failed`, `cancelled`, and `denied`.

#### Scenario: Pending action starts as waiting authorization
- **WHEN** a guard write/input creates an approval action
- **THEN** the action state is `waiting_authorization`
- **AND** no terminal write event is appended yet

#### Scenario: Approved action records execution state
- **WHEN** a pending action is approved
- **THEN** the action transitions to `executing` before the input reaches the PTY
- **AND** it transitions to `succeeded` or `failed` after the PTY write path finishes

#### Scenario: Cancelled action exposes cancellation state
- **WHEN** a pending or executing action is cancelled
- **THEN** the action transitions to `cancelled`
- **AND** waiters receive a cancellation result instead of hanging

#### Scenario: Terminal instance death invalidates pending actions
- **WHEN** the live TerminalInstance is stopped, killed, bootstrapped, or deleted
- **THEN** pending approval actions for that live instance are cancelled or expired
- **AND** those actions cannot later be approved to write into the replacement PTY

