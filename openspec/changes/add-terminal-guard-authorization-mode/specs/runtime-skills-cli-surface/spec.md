## MODIFIED Requirements

### Requirement: Seat-management CLI SHALL share acceptance mechanics without forcing one permission grammar

The dedicated management CLI SHALL share descriptor parsing and acceptance mechanics across resources without forcing one universal permission grammar. `accept` SHALL accept a raw token, a deep link, or an HTTP wrapper URL. When invoked from `root_bash`, `accept` SHALL sign with the injected runtime principal private key before submitting the acceptance proof. Resource-specific invite/config commands SHALL remain free to expose their own authority vocabulary.

#### Scenario: Resource-specific authority grammar stays local

- **WHEN** an operator uses `terminal-manage invite` and `message-manage invite`
- **THEN** terminal-manage may expose terminal-native authority inputs such as `RO`, `GUARD`, `RW`, or `TM`
- **THEN** message-manage first exposes direct room-native authority inputs `readonly`, `member`, and `admin`
- **THEN** the shared runtime CLI layer does not force both commands into one identical role dictionary

#### Scenario: Accept consumes any supported invitation descriptor

- **WHEN** the recipient runs `terminal-manage accept` or `message-manage accept` with a raw token, deep link, or HTTP wrapper URL
- **THEN** the command resolves all forms to the same invitation token
- **THEN** the resulting acceptance targets the same pending invitation fact

#### Scenario: Accept signs with the runtime principal key

- **WHEN** the recipient runs `terminal-manage accept` or `message-manage accept` from `root_bash`
- **THEN** the command signs the acceptance proof with the injected runtime principal key
- **THEN** acceptance cannot be completed by a different principal without that proof

## ADDED Requirements

### Requirement: Runtime terminal skills SHALL teach guard approval as pending terminal work

AI-facing terminal skill guidance SHALL teach that guard write approval is pending TerminalSystem work. It SHALL NOT teach models to satisfy the same visible terminal action through `root_bash` or `workspace_bash` after a guard approval request is created.

#### Scenario: Guard approval blocks fallback execution
- **WHEN** the built-in terminal skill describes a guard write result with `approvalRequest`
- **THEN** it tells the AI that the requested terminal action is waiting for admin approval
- **THEN** it tells the AI not to run an equivalent command through `root_bash` or `workspace_bash` and present it as visible terminal work

#### Scenario: Guard approval encourages status reporting
- **WHEN** a guard write creates a pending approval request
- **THEN** the skill guidance tells the AI to report or wait on that approval request through the relevant room/terminal context
- **THEN** it treats the approval request as progress owned by TerminalSystem authority

#### Scenario: Denied and expired approvals are terminal outcomes
- **WHEN** the built-in terminal skill describes a denied or expired guard approval request
- **THEN** it tells the AI that the requested terminal action did not occur
- **THEN** it tells the AI not to retry the same visible terminal action through `root_bash` or `workspace_bash`

#### Scenario: Existing pending approval should be reused
- **WHEN** the built-in terminal skill describes an existing pending approval request for an equivalent terminal action
- **THEN** it tells the AI to wait/report on that request rather than repeatedly submitting duplicate terminal writes
