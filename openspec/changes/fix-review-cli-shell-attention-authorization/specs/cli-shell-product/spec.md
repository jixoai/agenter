## ADDED Requirements

### Requirement: Cli-shell SHALL project current-terminal attention-backed authorization actions

Cli-shell SHALL render authorization actions for the currently opened visible TerminalSystem instance. The rendered popup is a product projection over TerminalSystem action state and attention-item facts; it is not a second authorization store and it does not decide terminal authority locally.

#### Scenario: Current-terminal pending action appears in native cli-shell
- **GIVEN** cli-shell session `shell-4` has current opened terminal `T`
- **WHEN** TerminalSystem creates a pending guard action for terminal `T`
- **THEN** native cli-shell renders the default OpenTUI TopLayer approval surface for that action
- **AND** the surface identifies the action id, requester, requested input preview, and expiry

#### Scenario: Current-terminal pending action appears in cli-shell web host
- **GIVEN** cli-shell web host is attached to current opened terminal `T`
- **WHEN** TerminalSystem creates a pending guard action for terminal `T`
- **THEN** the browser host renders the default approval surface for that action
- **AND** it uses the same TerminalSystem action id as native cli-shell

#### Scenario: Approval uses TerminalSystem action API
- **WHEN** the user approves a cli-shell authorization popup
- **THEN** cli-shell calls the generic TerminalSystem approval API for that terminal action
- **AND** it does not directly write bytes to the terminal from product UI code
- **AND** it does not mutate managed/hosting attention

#### Scenario: Denial can carry a reason
- **WHEN** the user denies a cli-shell authorization popup
- **THEN** cli-shell calls the generic TerminalSystem denial API
- **AND** when the host UI collected a reason, the reason is included in the denial mutation

#### Scenario: Cancel stays terminal-action scoped
- **WHEN** the user cancels a cli-shell authorization popup or the action becomes stale
- **THEN** cli-shell calls the generic TerminalSystem cancel API with a cancellation purpose
- **AND** it does not settle unrelated hosting attention or delete room/terminal resources

#### Scenario: Hidden-terminal request is routing bug
- **GIVEN** cli-shell current opened terminal is `T`
- **WHEN** a pending action exists on internal or hidden terminal `U`
- **THEN** cli-shell does not subscribe to `U` to make the popup appear
- **AND** the implementation must fix the write target so Shell Assistant terminal work targets `T`

### Requirement: Cli-shell SHALL keep authorization separate from managed hosting

Managed/hosting mode SHALL remain attention scheduling state only. It SHALL NOT grant terminal write authority, approve pending terminal actions, cancel pending terminal actions, or change which terminal cli-shell subscribes to for authorization.

#### Scenario: Managed on does not approve terminal action
- **WHEN** managed/hosting mode is enabled
- **AND** a guard terminal action is pending
- **THEN** the action remains pending until the terminal manager approves, denies, cancels, or it expires

#### Scenario: Authorization decision does not toggle managed mode
- **WHEN** the user approves, denies, or cancels a terminal action
- **THEN** cli-shell managed/hosting state remains unchanged
- **AND** hosting attention scores are not modified by the authorization decision

### Requirement: Cli-shell BDD SHALL cover authorization boundary behavior

Cli-shell SHALL include BDD coverage for authorization behavior at the product boundary, including native TUI, cli-shell web host, and real AI acceptance where semantic behavior matters.

#### Scenario: Native approval resumes terminal action
- **WHEN** a native cli-shell authorization popup is approved while the original guard write is waiting
- **THEN** the original terminal action executes and returns through TerminalSystem
- **AND** the popup disappears because the action reached a final or executing state

#### Scenario: Web host approval resumes terminal action
- **WHEN** a cli-shell web-host authorization popup is approved while the original guard write is waiting
- **THEN** the original terminal action executes and returns through TerminalSystem
- **AND** the browser host observes the same action transition

#### Scenario: Real AI does not need user prompt retry after approval
- **WHEN** Shell Assistant submits a guard terminal action and the manager approves it
- **THEN** the requested visible-terminal command executes without requiring the user to send a second instruction telling the model to retry
- **AND** the assistant still avoids root/workspace bash substitution

