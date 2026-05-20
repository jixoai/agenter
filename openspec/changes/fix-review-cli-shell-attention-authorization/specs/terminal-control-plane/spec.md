## ADDED Requirements

### Requirement: Terminal control plane SHALL expose waitable action results

The terminal control plane SHALL expose a `terminal wait` operation, or equivalent API, that waits for a terminal action id to reach a final state and returns the same result shape that the original `terminal write/input` would have returned if it had remained waiting.

#### Scenario: Wait returns approved execution result
- **WHEN** a guard write returned a timeout with action id `N`
- **AND** the manager later approves action `N`
- **AND** the caller runs `terminal wait N`
- **THEN** the wait returns the executed terminal write/input result
- **AND** any return-read evidence remains attached to that result

#### Scenario: Wait returns denial result
- **WHEN** a guard write returned a timeout with action id `N`
- **AND** the manager denies action `N`
- **AND** the caller runs `terminal wait N`
- **THEN** the wait returns a denial warning
- **AND** the result identifies the denied action id

#### Scenario: Wait is cancellation safe
- **WHEN** a caller cancels an in-flight `terminal wait`
- **THEN** the control plane releases the waiter
- **AND** the underlying terminal action remains in its current state unless cancellation explicitly targeted the action itself

### Requirement: Terminal control plane SHALL expose cancellable terminal actions

The terminal control plane SHALL expose a `terminal cancel` operation, or equivalent API, that accepts an action id and a cancellation purpose. Supported purposes SHALL include `authorization_wait`, `execution`, and `any`.

#### Scenario: Cancel authorization wait
- **WHEN** a terminal action is still `waiting_authorization`
- **AND** the caller cancels it with purpose `authorization_wait`
- **THEN** the action transitions to `cancelled`
- **AND** manager approval after cancellation cannot execute the input

#### Scenario: Cancel execution
- **WHEN** a terminal action is `executing`
- **AND** the caller cancels it with purpose `execution`
- **THEN** TerminalSystem attempts to stop or abort the in-flight execution path where the backend supports it
- **AND** the action result records whether execution cancellation succeeded or arrived too late

#### Scenario: Cancel any phase
- **WHEN** a terminal action is either waiting for authorization or executing
- **AND** the caller cancels it with purpose `any`
- **THEN** TerminalSystem applies the appropriate cancellation for the current state
- **AND** waiters receive the final cancellation result

#### Scenario: Wrong cancellation purpose is rejected
- **WHEN** a caller cancels an executing action with purpose `authorization_wait`
- **THEN** the control plane rejects or no-ops the cancellation with an explicit state mismatch result
- **AND** it does not silently cancel execution under the wrong stated purpose

### Requirement: Terminal action ids SHALL be local to terminal action state

Terminal action ids SHALL identify one action within TerminalSystem action state. They MUST NOT be confused with MessageRoom ids, AvatarRuntime session ids, or cli-shell product session keys.

#### Scenario: Action id resolves only with terminal scope
- **WHEN** a caller waits or cancels action id `N`
- **THEN** TerminalSystem resolves `N` under the intended terminal or action namespace
- **AND** the operation cannot affect an unrelated terminal action by sharing a numeric id

#### Scenario: Product session key is not an action id
- **WHEN** cli-shell session `shell-4` creates a guard action
- **THEN** `shell-4` remains only the product resource key
- **AND** the guard action id is a separate terminal action identifier

