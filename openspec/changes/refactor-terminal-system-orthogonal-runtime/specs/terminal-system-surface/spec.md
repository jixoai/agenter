## ADDED Requirements

### Requirement: Terminal write composer SHALL preserve draft text across rejected writes
The terminal-system route SHALL preserve the current write draft whenever a terminal write fails or degrades into an approval request. The draft MAY only be cleared after a confirmed successful write.

#### Scenario: Failed write preserves draft
- **WHEN** the operator submits a terminal write and the request fails
- **THEN** the composer keeps the original draft text
- **THEN** the operator can retry without retyping the message

#### Scenario: Approval request preserves draft
- **WHEN** the operator submits a terminal write that becomes an approval request
- **THEN** the composer keeps the original draft text
- **THEN** the UI surfaces the approval-request state without pretending the write already succeeded

### Requirement: Terminal users pane SHALL share one seat-management behavior model across layouts
The terminal-system route SHALL use one shared seat-management behavior model for compact and wide layouts so grant, focus, revoke, and approval actions remain behaviorally identical regardless of pane width.

#### Scenario: Compact and wide panes execute the same grant behavior
- **WHEN** the operator grants a seat from either compact or wide users pane layout
- **THEN** both layouts run the same validation and action flow
- **THEN** layout changes do not require duplicate business logic

## MODIFIED Requirements

### Requirement: Terminal tool actions SHALL require an explicit acting actor
Terminal read/write or other tool-call actions initiated from the UI SHALL let the operator choose which auth-backed actor performs the action, and the route SHALL derive those actor options from the authoritative terminal surface projection rather than reconstructing them from multiple client-side sources.

#### Scenario: Tool call with actor selection
- **WHEN** the operator selects an actor and invokes a terminal tool action
- **THEN** the request is sent using that actor selection rather than an implicit global identity

#### Scenario: Call-as options come from one surface projection
- **WHEN** the terminal detail route renders or refreshes
- **THEN** the visible `call as` options come from the authoritative terminal surface projection
- **THEN** the route does not need to merge `access`, `grants`, and `actors` locally to reconstruct seat truth

#### Scenario: Actor authority missing
- **WHEN** the chosen actor lacks valid terminal authority
- **THEN** the UI surfaces the failure as a credential/access problem and does not silently fall back

### Requirement: Terminal detail SHALL restore durable activity after refresh
Refreshing the terminal route SHALL restore previously renderable terminal evidence from durable backend state, including the latest terminal surface projection, renderable terminal snapshot truth, transport endpoint, renderer metadata, absolute cwd, and recent terminal activity. After hydration, the route SHALL continue receiving live updates without requiring a second manual refresh.

#### Scenario: Refresh terminal detail
- **WHEN** the browser refreshes while viewing a terminal
- **THEN** the transcript/activity pane reloads previously available terminal activity rather than appearing empty
- **THEN** subsequent live terminal events continue updating the selected terminal in place

#### Scenario: Refresh restores renderable terminal viewport
- **WHEN** the selected terminal was previously running and had renderable output
- **THEN** the route restores a renderable terminal viewport from durable snapshot truth before or while live transport reconnects
- **THEN** the page does not regress to a permanently blank terminal surface

#### Scenario: Absolute cwd display
- **WHEN** terminal metadata includes the current working directory
- **THEN** the UI displays the absolute path rather than a workspace-relative shorthand such as `.`
