## ADDED Requirements

### Requirement: Runtime terminal writes SHALL expose guard approval requests

Runtime terminal `write` and `input` operations SHALL preserve TerminalSystem guard approval facts in their model-visible results. A guard write that creates an approval request is a pending authorization result, not a silent PTY write and not a generic tool failure.

#### Scenario: Guard terminal write returns approval request
- **WHEN** a runtime actor with `guard` terminal authority calls `terminal write` without an active write lease
- **THEN** the runtime requests approval creation through TerminalSystem
- **THEN** the result includes `ok: false`
- **THEN** the result includes the created `approvalRequest` fact
- **THEN** no bytes are written to the PTY

#### Scenario: Equivalent guard terminal write returns existing approval request
- **WHEN** a runtime actor repeats an equivalent `terminal write` while the original approval request is still pending
- **THEN** the runtime returns the existing or refreshed `approvalRequest` fact from TerminalSystem
- **THEN** the result remains terminal-local pending work rather than a generic failure
- **THEN** no duplicate PTY write is attempted

#### Scenario: Guard terminal input returns approval request
- **WHEN** a runtime actor with `guard` terminal authority calls `terminal input` without an active write lease
- **THEN** the runtime requests approval creation through TerminalSystem
- **THEN** the result includes `ok: false`
- **THEN** the result includes the created `approvalRequest` fact with the mixed input mode
- **THEN** no input is applied to the PTY

#### Scenario: Denied or expired guard result remains terminal authorization state
- **WHEN** a guard approval request is denied or expires
- **THEN** subsequent runtime terminal write/input calls without a valid lease still return an authorization result instead of writing to the PTY
- **THEN** the result does not instruct callers to execute the same visible terminal action through `root_bash` or `workspace_bash`

#### Scenario: Approved guard lease permits runtime write
- **WHEN** the same guard actor has an active write lease minted from approval
- **THEN** runtime `terminal write` and `terminal input` calls may reach the PTY under that lease
- **THEN** terminal activity preserves the actor and lease provenance

#### Scenario: Product hosting attention does not affect runtime write authorization
- **GIVEN** cli-shell hosting attention is active for a shell
- **WHEN** the bound Shell Assistant calls runtime `terminal write` or `terminal input`
- **THEN** runtime authorization still checks only TerminalSystem grant, approval request, and terminal-native write lease facts
- **THEN** runtime does not consult product delegation or hosting attention as write authority
