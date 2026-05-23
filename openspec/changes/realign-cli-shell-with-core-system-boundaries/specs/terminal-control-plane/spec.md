## MODIFIED Requirements

### Requirement: Terminal control plane SHALL remain the only shell operation and authorization authority

TerminalSystem control plane SHALL remain the canonical authority for shell lifecycle, input, read, await, grants, guard approvals, leases, and activity. Product TUIs MAY present controls for these operations, but product-local hosts such as tmux or OpenTUI SHALL NOT create a parallel shell authorization or input truth.

#### Scenario: Product terminal write uses TerminalSystem authorization
- **WHEN** an Avatar writes to a terminal from a cli-shell session
- **THEN** the write targets the TerminalSystem terminal id bound to that session
- **AND** TerminalSystem grants, guard approval, or leases decide whether the write proceeds
- **AND** tmux pane focus or local TUI state does not grant write authority

#### Scenario: Product approval popup controls TerminalSystem request
- **WHEN** cli-shell displays a terminal write approval popup
- **THEN** the request id, terminal id, requested input, status, approve/deny action, and resulting lease remain TerminalSystem facts
- **AND** cli-shell owns only how the request is drawn and how clicks/keys dispatch the approve or deny action

#### Scenario: Product host cannot bypass stopped terminal lifecycle
- **WHEN** a bound TerminalSystem terminal is stopped
- **THEN** product-local host state cannot make terminal write succeed
- **AND** the user or Avatar must use explicit TerminalSystem lifecycle operations to bootstrap or create the terminal
