## MODIFIED Requirements

### Requirement: Terminals page SHALL visualize actor state through AvatarGroup semantics

The `Terminals` page SHALL render attached actors through an AvatarGroup that encodes online/focus state with badge colors and permission state with border colors.

#### Scenario: Badge colors reflect online and focus state
- **WHEN** the page renders attached actors for a terminal
- **THEN** badge colors distinguish offline, online-unfocused, and online-focused states
- **THEN** the legend remains stable across desktop and compact layouts

#### Scenario: Border colors reflect terminal grant state
- **WHEN** the page renders attached actors for a terminal
- **THEN** border colors distinguish `readonly`, `guard`, `writer`, and `admin`
- **THEN** the user can identify write authority without opening a secondary inspector first

#### Scenario: Users panel shows per-seat focus state
- **WHEN** the terminal page renders attached actors for a terminal
- **THEN** each actor row can display whether that seat currently focuses the terminal
- **THEN** explicit focus or unfocus actions act on that seat rather than on one shared terminal flag

### Requirement: Terminals page SHALL warn before allowing multiple writers

When a terminal configuration action would leave more than one actor with `writer` authority, the UI SHALL present a downgrade prompt before applying the change.

#### Scenario: Multiple writers trigger a downgrade prompt
- **WHEN** the user grants `writer` access to an actor while another actor already has `writer`
- **THEN** the UI warns that shared unrestricted writers can conflict
- **THEN** the prompt offers a downgrade path that changes the other writer to `guard` before confirming

### Requirement: Terminal users UI SHALL expose Guard approval workflow

The terminal users UI SHALL present Guard as the named approval-gated write role and SHALL show pending approval requests, approval decisions, and resulting write leases from terminal authority.

#### Scenario: Role selector offers Guard
- **WHEN** the operator opens terminal user management
- **THEN** the role selector offers `guard` as a distinct option between read-only and direct writer authority
- **THEN** the UI does not expose `requester` as the canonical role name

#### Scenario: Pending guard approval is actionable
- **WHEN** a guard seat creates a terminal write approval request
- **THEN** the terminal users UI shows the pending request with actor, requested input, expiry, Approve, and Deny actions
- **THEN** approving the request mints and displays the resulting write lease for that seat
- **THEN** denying the request leaves the guard seat without a write lease

### Requirement: WebUI SHALL support global and terminal-scoped permission request interactions

WebUI SHALL consume the TerminalSystem permission request subscription in two modes: a global all-terminal mode for notification and routing, and a terminal-scoped mode for inline approval inside terminal surfaces. Both modes SHALL observe the same TerminalSystem authority facts and SHALL NOT create a WebUI-local approval truth.

#### Scenario: Global subscription drives WebNotification
- **WHEN** a guard permission request is created for any observable terminal
- **THEN** WebUI's global subscription can show an app notification or badge
- **THEN** the notification can route the user to the relevant terminal
- **THEN** it does not approve or deny the request by itself
- **THEN** WebUI does not receive unauthorized request previews and rely on client-only hiding

#### Scenario: Terminal detail subscribes only to the selected terminal
- **WHEN** the user views terminal `T`
- **THEN** the terminal detail surface subscribes to permission requests filtered to `terminalId=T`
- **THEN** requests for other terminals do not interrupt the selected terminal view

#### Scenario: Inline terminal approval uses terminal-view default UI
- **WHEN** `web-terminal-view` receives a permission request for its terminal
- **AND** the WebUI host does not provide a custom approval callback
- **THEN** the component renders its default HTML-Popover TopLayer approval UI
- **THEN** Approve and Deny call the same TerminalSystem commands used by the users panel

#### Scenario: Terminal users panel remains administrative history
- **WHEN** the user opens the terminal users panel
- **THEN** it can list pending and recent approval requests for the selected terminal
- **THEN** this panel is not the only place where a live permission request can be approved

#### Scenario: Denied and expired requests stay visible as terminal outcomes
- **WHEN** a guard approval request is denied or expires
- **THEN** WebUI shows the request as denied or expired rather than as a generic terminal failure
- **THEN** it does not offer an action that reruns the same requested input through another shell

#### Scenario: Repeated request updates do not stack notifications
- **WHEN** TerminalSystem refreshes an equivalent pending request
- **THEN** WebUI updates the existing badge, notification, users-panel row, or inline popover state
- **THEN** it does not create a second visible approval item for the same request id
