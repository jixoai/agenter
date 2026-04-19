# terminal-system-surface Specification

## Purpose
TBD - created by archiving change ship-terminal-system-core-surface. Update Purpose after archive.
## Requirements
### Requirement: Terminal-system SHALL present global terminals as a standalone product surface
The WebUI SHALL expose a dedicated terminal-system route that lists global terminals, renders the selected terminal transcript, and provides terminal-specific actions and user/access management without requiring workspace ownership. The route SHALL use shared split and scaffold primitives so the terminal viewport, tool composer, and collaboration rail each keep explicit layout ownership.

#### Scenario: Global terminal navigation
- **WHEN** the operator opens the terminal-system route
- **THEN** they can browse and select global terminals directly

#### Scenario: Terminal detail layout
- **WHEN** a terminal is selected
- **THEN** the route shows the terminal transcript plus a side panel with separate Actions and Users tabs
- **THEN** the bottom tool panel lets the operator invoke terminal actions as an explicit seat

#### Scenario: Terminal-system route uses shared shell primitives
- **WHEN** the operator opens the terminal-system route
- **THEN** the route derives its primary columns and panel shells from shared split/scaffold primitives
- **THEN** terminal rendering, tool composition, and seat management no longer depend on repeated page-local shell classes

### Requirement: Terminal tool actions SHALL require an explicit acting actor
Terminal read/write or other tool-call actions initiated from the UI SHALL let the operator choose which auth-backed actor performs the action.

#### Scenario: Tool call with actor selection
- **WHEN** the operator selects an actor and invokes a terminal tool action
- **THEN** the request is sent using that actor selection rather than an implicit global identity

#### Scenario: Session-backed terminal actor prefers canonical session identity even after stop
- **WHEN** a terminal seat or `call as` option resolves to a session-backed actor that still exists in active client session metadata
- **AND** that session exposes both a human `avatar` label and an opaque runtime `name`
- **THEN** the terminal Users pane and `call as` selector use the avatar label as the primary visible text
- **THEN** any raw runtime id remains secondary detail only when needed for disambiguation

#### Scenario: Actor authority missing
- **WHEN** the chosen actor lacks valid terminal authority
- **THEN** the UI surfaces the failure as a credential/access problem and does not silently fall back

### Requirement: Browser-facing global terminal control SHALL require an authenticated operator
The browser-side terminal-system workbench SHALL require an authenticated operator before it can create terminals, hydrate the global terminal catalog, or use terminal seat tokens for terminal read/write or administration. A terminal `accessToken` is a capability within the authenticated control plane, not an anonymous browser identity.

#### Scenario: Unauthenticated browser cannot create terminals
- **WHEN** the browser opens the `New terminal` route without an authenticated operator session
- **THEN** the route shows an explicit `auth token required` notice
- **THEN** the `Create terminal` action stays disabled instead of issuing anonymous terminal mutations

#### Scenario: Terminal token alone does not authorize browser control
- **WHEN** the browser is not authenticated but still holds a stale terminal id or terminal seat token
- **THEN** terminal read/write or administration actions do not stay active from that stale token alone
- **THEN** the route surfaces `auth token required` until the operator authenticates again

### Requirement: Terminal users SHALL own focus state per seat
Terminal focus behavior in the UI SHALL be modeled per user seat rather than as one terminal-global toggle.

#### Scenario: User-specific focus
- **WHEN** the operator focuses one user for a terminal
- **THEN** that user's seat state changes without implicitly focusing every other user

#### Scenario: No terminal-global focus affordance
- **WHEN** the terminal detail renders
- **THEN** focus/unfocus controls are available in the user list instead of as one page-level terminal action

### Requirement: Terminal detail SHALL restore durable activity after refresh
Refreshing the terminal route SHALL restore previously renderable terminal evidence from durable backend state, including the latest terminal snapshot, transport endpoint, renderer metadata, absolute cwd, and recent terminal activity. After hydration, the route SHALL continue receiving live updates without requiring a second manual refresh.

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

### Requirement: Terminal-system route SHALL reflect seat and approval changes live
The terminal-system route SHALL react to terminal activity, grant changes, approval changes, and seat focus changes without requiring page refresh or timer-based polling to reveal those facts.

#### Scenario: Activity and seat state update in place
- **WHEN** a write, read, or seat focus action occurs for the selected terminal
- **THEN** the Actions and Users panes update in place from the live terminal event stream
- **THEN** `call as` options remain consistent with the latest visible grants

#### Scenario: Call-as options update after seat change
- **WHEN** the operator grants or revokes a seat for the selected terminal
- **THEN** the `call as` selector updates from the same live terminal state without requiring a page refresh
- **THEN** subsequent tool invocations can use the new seat immediately

#### Scenario: Approval queue updates in place
- **WHEN** a terminal approval request is created, approved, or denied
- **THEN** the Users pane reflects that approval state without manual refresh
- **THEN** the current administrator can act on the latest approval queue immediately

### Requirement: Terminal Users pane SHALL keep grant controls independently hittable across pane widths
The terminal Users pane SHALL derive its grant-access control layout from the pane width itself, not only from the browser viewport, so the actor selector, role selector, and `Grant seat` action remain independently interactable inside narrow collaboration rails.

#### Scenario: Narrow desktop detail pane falls back to stacked grant controls
- **WHEN** the operator opens `Terminals > Users` on a desktop viewport whose collaboration rail is still narrow
- **THEN** the Users pane falls back to the stacked grant-access layout
- **THEN** `Grant actor`, `Grant role`, and `Grant seat` remain separately hittable instead of overlapping

#### Scenario: Mobile users pane keeps grant access usable
- **WHEN** the operator opens `Terminals > Users` on a compact mobile viewport
- **THEN** the Users pane continues to show the stacked grant-access layout
- **THEN** the actor selector and role selector can still be opened before granting a seat
