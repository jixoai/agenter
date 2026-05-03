## ADDED Requirements

### Requirement: Root bash SHALL expose dedicated seat-management commands as frontend clients for shared resources

The root-workspace shell surface SHALL expose `terminal-manage` and `message-manage` as dedicated JSON-first command helpers for manager-authorized seat operations. These commands SHALL act as frontend clients of the corresponding system backend and SHALL coexist with `terminal` and `message` instead of overloading their existing inspection or communication verbs.

#### Scenario: Root shell discovers dedicated manage commands

- **WHEN** the AI or operator runs `which terminal-manage` or `which message-manage` inside `root_bash`
- **THEN** each command is discoverable and executable from that shell session
- **THEN** `terminal` and `message` remain available for their existing inspection and communication contracts

#### Scenario: Manage command uses backend authority rather than direct local mutation

- **WHEN** `terminal-manage` or `message-manage` performs invite, accept, config, or revoke
- **THEN** the command talks to the corresponding system backend through endpoint, token, and proof-bearing requests
- **THEN** the command is not treated as the durable owner of terminal or room truth

#### Scenario: Invite returns a share descriptor instead of a live access token

- **WHEN** `terminal-manage invite` or `message-manage invite` succeeds
- **THEN** the command returns the opaque invitation token plus deep-link or HTTP share descriptors
- **THEN** the command does not pretend that the invited principal already has active resource authority

### Requirement: Seat-management CLI SHALL share acceptance mechanics without forcing one permission grammar

The dedicated management CLI SHALL share descriptor parsing and acceptance mechanics across resources without forcing one universal permission grammar. `accept` SHALL accept a raw token, a deep link, or an HTTP wrapper URL. When invoked from `root_bash`, `accept` SHALL sign with the injected runtime principal private key before submitting the acceptance proof. Resource-specific invite/config commands SHALL remain free to expose their own authority vocabulary.

#### Scenario: Resource-specific authority grammar stays local

- **WHEN** an operator uses `terminal-manage invite` and `message-manage invite`
- **THEN** terminal-manage may expose terminal-native authority inputs such as `RO`, `RW`, or `TM`
- **THEN** message-manage first exposes direct room-native authority inputs `readonly`, `member`, and `admin`
- **THEN** the shared runtime CLI layer does not force both commands into one identical role dictionary

#### Scenario: Accept consumes any supported invitation descriptor

- **WHEN** the recipient runs `terminal-manage accept` or `message-manage accept` with a raw token, deep link, or HTTP wrapper URL
- **THEN** the command resolves all forms to the same invitation token
- **THEN** the resulting acceptance targets the same pending invitation fact

#### Scenario: Accept signs with the runtime principal key

- **WHEN** the recipient runs `terminal-manage accept` or `message-manage accept` from `root_bash`
- **THEN** the command signs the acceptance payload with the injected runtime principal private key
- **THEN** the control plane verifies the proof against the invited principal before activating the seat

#### Scenario: HTTP wrapper bootstrap still resolves to the same backend invitation

- **WHEN** a recipient opens an HTTP wrapper invitation link and hands it to `terminal-manage accept` or `message-manage accept`
- **THEN** the client resolves that link to the same backend invitation token used by deep links or raw tokens
- **THEN** the backend system remains the authority that validates and activates the invitation

#### Scenario: First implementation does not require a persistent preview page

- **WHEN** the delivery layer emits an HTTP wrapper invitation link
- **THEN** the link may resolve directly to token import or CLI handoff without requiring a durable invitation preview page
- **THEN** the acceptance still targets the same backend invitation fact

#### Scenario: Message-delivered descriptor preserves terminal invitation truth

- **WHEN** principal `A` posts a terminal invitation descriptor for principal `B` into a room that `B` can read
- **THEN** `B` can copy that raw token, deep link, or HTTP wrapper URL into `terminal-manage accept`
- **THEN** the acceptance still resolves to the original pending terminal invitation fact rather than minting a second invitation through message transport

#### Scenario: Cross-instance message transport can deliver terminal authority onboarding

- **WHEN** Avatar-A on agenter-A and Avatar-B on agenter-B already share a room hosted by one agenter endpoint
- **AND** Avatar-B sends Avatar-A a terminal invitation descriptor for a terminal hosted by agenter-B
- **THEN** Avatar-A can accept that descriptor from agenter-A without locally re-hosting the terminal authority
- **THEN** the acceptance still resolves against agenter-B's terminal backend as the authority that owns the invitation truth
