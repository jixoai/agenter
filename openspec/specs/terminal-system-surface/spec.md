# terminal-system-surface Specification

## Purpose
Define the durable WebUI contract for the standalone terminal-system route, including its shared split-detail shell, route-owned toolbar, actor-bearing tool composers, and live action-management surfaces.
## Requirements
### Requirement: Terminal-system SHALL present global terminals as a standalone product surface
The WebUI SHALL expose a dedicated terminal-system route that lists global terminals, renders the selected terminal transcript, and provides terminal-specific actions and user/access management without requiring workspace ownership. The route SHALL use shared scaffold primitives for pane interiors and the shared split-detail workbench shell law so the terminal viewport, tool composer, and collaboration rail each keep explicit layout ownership on desktop while compact widths reuse the shared right-sheet fallback.

#### Scenario: Global terminal navigation
- **WHEN** the operator opens the terminal-system route
- **THEN** they can browse and select global terminals directly

#### Scenario: Terminal detail layout
- **WHEN** a terminal is selected on a width that can satisfy the split-detail minimums
- **THEN** the route shows the terminal transcript in the main pane and a resizable right detail rail for `Actions`
- **THEN** terminal user and seat management remains reachable through a dedicated toolbar-opened dialog
- **THEN** the bottom tool panel lets the operator invoke terminal actions as an explicit seat

#### Scenario: Terminal-system route uses shared shell primitives
- **WHEN** the operator opens the terminal-system route on desktop width
- **THEN** the route derives its primary `main + detail` shell from the shared split-detail workbench host
- **THEN** the desktop detail width persists through the shared split-detail ratio contract instead of a page-local fixed column

#### Scenario: Compact split fallback keeps activity reachable
- **WHEN** the terminal-system route width falls below the shared split-detail threshold
- **THEN** the route exits persistent split mode through the shared compact-collapse math
- **THEN** the `Actions` surface remains reachable through the shared right sheet instead of disappearing behind a desktop-only shell
- **THEN** terminal user management remains reachable through the toolbar dialog even after the split collapses

#### Scenario: Selected terminal page owns the page-toolbar
- **WHEN** the operator opens a concrete shared terminal route
- **THEN** the route injects terminal-local toolbar content through the shared `WorkbenchPageToolbar` host instead of relying on static shell subtitle copy
- **THEN** the toolbar identity reflects the active terminal facts such as the terminal label and cwd
- **THEN** the toolbar status reflects authoritative runtime facts such as `running/stopped` and `busy/idle`
- **THEN** toolbar lifecycle actions surface explicit pending copy such as `Bootstrapping PTY…` or `Killing PTY…` while the action is locked
- **THEN** explanatory product copy is available through help affordance instead of occupying the primary identity row
- **THEN** the help popup remains readable above compact shell chrome instead of rendering underneath navigation layers

#### Scenario: Terminal users management lives behind a toolbar dialog
- **WHEN** the operator needs to inspect seats, approvals, or grants
- **THEN** the `Actions` toolbar affordance remains the stateful current-detail toggle for the right rail
- **THEN** the shared page-toolbar exposes a `Users` affordance that opens a dedicated management dialog
- **THEN** the right detail rail remains focused on `Actions` instead of repeating a second local tab strip or inline users pane

#### Scenario: Terminal workbench body stays neutral
- **WHEN** the selected terminal route renders inside the workbench window
- **THEN** the outer window body stays visually neutral instead of wrapping both panes in a second oversized rounded card
- **THEN** the terminal stage pane and the detail pane remain the only visible content surfaces

#### Scenario: Actor-bearing selectors share one avatar contract
- **WHEN** terminal seat selection or room viewer selection renders an actor dropdown
- **THEN** the trigger shows avatar + nickname for the selected actor
- **THEN** dropdown items show the same avatar + nickname shape
- **THEN** the selector may render one stable second line for actor address, actor id, or other route-local subtitle without each feature rebuilding the select shell
- **THEN** the selector supports both compact borderless toolbar rendering and detailed bordered field rendering without breaking the concentric inset treatment

#### Scenario: Terminal action facts reuse the shared structured viewer
- **WHEN** a terminal read or write fact renders in the `Actions` rail
- **THEN** the route uses the same structured tool invocation surface as Heartbeat
- **THEN** structured YAML or JSON values render through the shared structured viewer path instead of a terminal-only legacy custom element

#### Scenario: Terminal write and read share one composer law
- **WHEN** the operator switches between terminal write and terminal read in the bottom action area
- **THEN** both states render inside the stage pane body instead of reviving a detached footer surface
- **THEN** both states use the shared `InputGroup` layout contract for their primary composer surface
- **THEN** read-mode parameter fields live in the upper parameter panel so future read options can extend there without changing the bottom action row grammar
- **THEN** the actor selector renders as a compact single-line affordance inside the composer addon row
- **THEN** the submit action lives in that same addon row instead of drifting into a separate footer band
- **THEN** read submissions send the selected actor's terminal access token and `remark = true` so UI reads consume only that actor's read cursor

#### Scenario: Terminal action cards stay compact while reusing the shared structured viewer
- **WHEN** a structured terminal fact renders in the narrow `Actions` rail
- **THEN** the route still uses the shared structured viewer implementation
- **THEN** per-card viewer mode menus stay suppressed for this rail context
- **THEN** the structured preview remains readable without introducing a terminal-only renderer fork

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
