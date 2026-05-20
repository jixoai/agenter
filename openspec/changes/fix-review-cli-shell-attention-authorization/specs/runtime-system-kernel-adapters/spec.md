## ADDED Requirements

### Requirement: Terminal authorization transitions SHALL publish attention items through the shared adapter

Terminal authorization transitions SHALL enter the runtime through the shared runtime-system adapter law. TerminalSystem owns live action state and PTY effects, while the terminal adapter commits attention-item facts for model/runtime reasoning. cli-shell, WebUI, and terminal-view components MUST NOT inject prompt glue or local-only state as a replacement for those committed facts.

#### Scenario: Pending guard action commits an attention item
- **WHEN** a guard write/input creates a pending terminal action
- **THEN** the terminal adapter commits an attention item that identifies the terminal, action id, requester, requested input preview, state `waiting_authorization`, and expiry
- **AND** the item is scoped to the relevant terminal attention context

#### Scenario: Manager approval commits before execution result
- **WHEN** a manager approves a pending terminal action
- **THEN** the adapter commits an attention item for the approval decision
- **AND** TerminalSystem may then execute the original pending input
- **AND** the later execution result is committed as a separate action outcome fact

#### Scenario: Manager denial commits reason
- **WHEN** a manager denies a pending terminal action
- **THEN** the adapter commits an attention item for the denial decision
- **AND** any denial reason is preserved in the committed fact

#### Scenario: Timeout and cancel are attention facts
- **WHEN** a guard caller times out waiting for approval or cancels a terminal action
- **THEN** the adapter commits an attention item for that timeout or cancellation
- **AND** later model turns can reason from the committed fact without guessing from UI state

#### Scenario: Adapter path does not become cli-shell-specific
- **WHEN** cli-shell renders an approval popup or a browser host approves an action
- **THEN** the same terminal adapter path commits the attention facts
- **AND** the runtime kernel does not add cli-shell product branches for authorization

### Requirement: Terminal authorization attention SHALL wake relevant runtime work promptly

Authorization transitions that change whether a pending terminal action can proceed SHALL wake the relevant runtime work through the existing attention/LoopBus path instead of relying on arbitrary polling or a future unrelated user message.

#### Scenario: Approval wakes waiting work
- **WHEN** a manager approves a pending action for a runtime actor
- **THEN** the approval commit wakes or resolves the waiting terminal action promptly
- **AND** the original waiting call can continue without waiting for the next model retry

#### Scenario: Denial wakes waiting work
- **WHEN** a manager denies a pending action for a runtime actor
- **THEN** the denial commit wakes or resolves the waiting terminal action promptly
- **AND** the original waiting call returns the denial outcome

#### Scenario: Cancel wakes waiting work
- **WHEN** a terminal action is cancelled
- **THEN** all waiters for that action are resolved or rejected through cancellation outcome
- **AND** no stale waiter remains attached to the action

