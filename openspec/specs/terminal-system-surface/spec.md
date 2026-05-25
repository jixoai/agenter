# terminal-system-surface Specification

## Purpose
Define the durable WebUI contract for the standalone terminal-system route, including its shared split-detail shell, route-owned toolbar, actor-bearing tool composers, and live action-management surfaces.
## Requirements
### Requirement: Terminal-system SHALL present global terminals as a standalone product surface
The WebUI SHALL expose a dedicated terminal-system route that lists live global terminals, renders the selected live terminal transcript, and provides lifecycle-aware actions without reconstructing terminal identity from stale catalog fields. Dead terminals SHALL be managed through explicit history/archive surfaces instead of remaining selectable in the main live route.

#### Scenario: Global terminal navigation
- **WHEN** the operator opens the terminal-system route
- **THEN** they can browse and select live global terminals directly
- **AND** killed terminals do not remain in that default live navigation list

#### Scenario: Terminal detail layout
- **WHEN** a live terminal is selected on a width that can satisfy the split-detail minimums
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
- **WHEN** the operator opens a concrete live terminal route
- **THEN** the toolbar identity resolves from `configured title ?? terminal id`
- **AND** the toolbar second line prefers runtime observed current path instead of fixed launch cwd
- **AND** if no runtime path is available, the route falls back to terminal id or nothing rather than pretending launch cwd is current path

#### Scenario: Terminal users management lives behind a toolbar dialog
- **WHEN** the operator needs to inspect seats, approvals, or grants
- **THEN** the `Actions` toolbar affordance remains the stateful current-detail toggle for the right rail
- **THEN** the shared page-toolbar exposes a `Users` affordance that opens a dedicated management dialog
- **THEN** the right detail rail remains focused on `Actions` instead of repeating a second local tab strip or inline users pane

#### Scenario: Terminal workbench body stays neutral
- **WHEN** the selected live terminal route renders inside the workbench window
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

#### Scenario: Terminal window titlebar may follow observed PTY title independently
- **WHEN** the selected live terminal emits an observed PTY title different from its configured terminal instance name
- **THEN** tabs, toolbar, and dialog identity keep using the terminal instance name
- **AND** the inner terminal window titlebar may separately resolve `observed title ?? configured title ?? terminal id`

### Requirement: Terminal window projection SHALL resize the window shell, not only the terminal content

The terminal-system route SHALL treat `fit` and `cover` as window-shell projection modes. The selected terminal window SHALL change its own width and body height under those modes, while the titlebar remains an unscaled control surface with stable hit targets.

#### Scenario: Fit projection shrinks the terminal window shell
- **WHEN** the operator switches a terminal window to `fit`
- **THEN** the terminal window shell shrinks proportionally to fit inside the available stage viewport
- **AND** the terminal window body preserves a small cell-derived inner inset around the projected terminal content instead of using outer shell margin
- **AND** the titlebar height stays stable rather than being transform-scaled

#### Scenario: Cover projection enlarges the terminal window shell
- **WHEN** the operator switches a terminal window to `cover`
- **THEN** the terminal window shell grows proportionally beyond the available stage viewport
- **AND** the titlebar is promoted out of `terminal-window` and becomes sticky chrome at the top of the surrounding `window-container`
- **AND** the surrounding stage viewport owns the resulting scrollbars
- **AND** the same cell-derived inner inset remains between terminal content and terminal window body
- **AND** the underlying terminal frame geometry remains the same until an explicit live or durable resize changes cols or rows

#### Scenario: Fit-cover does not mutate terminal geometry by itself
- **WHEN** the operator toggles between `fit` and `cover`
- **THEN** the terminal snapshot `cols x rows` stay unchanged
- **AND** only explicit live drag resize or durable resize form submission may request PTY geometry changes

#### Scenario: Fit projection may resolve as inline-fit or block-fit
- **WHEN** the operator stays in `fit` mode and the terminal aspect ratio differs from the available safe area
- **THEN** projection may resolve as inline-fit or block-fit depending on which axis saturates first
- **AND** the titlebar stays at normal size in both cases because only terminal-content participates in scale

#### Scenario: Cover projection does not expose a frame resize affordance
- **WHEN** the terminal window is in `cover`
- **THEN** the route does not render the framed live resize handle
- **AND** only framed fit-mode windows may present the live resize affordance

#### Scenario: Live resize derives terminal geometry from the dragged window frame
- **WHEN** the operator drags the terminal window resize handle
- **THEN** the window frame may follow the pointer as a temporary projection while dragging
- **AND** the route derives discrete PTY `cols x rows` from the dragged frame size using the terminal cell metrics
- **AND** the live transport sends a resize sideband for those derived `cols x rows`
- **AND** on pointer release the temporary frame dimensions are discarded so the terminal window is again sized by terminal content geometry
- **AND** the titlebar and geometry label reflect the effective `cols x rows` rather than preserving arbitrary drag pixels

#### Scenario: Durable resize remains an explicit recorded tool path
- **WHEN** the operator submits the resize form in the action composer
- **THEN** the route applies the requested durable `cols x rows` through the terminal config mutation path
- **AND** the resize appears as a recorded terminal action fact
- **AND** this recorded path stays separate from unrecorded live transport resize sidebands

#### Scenario: Transport discovery remains distinct from live transport
- **WHEN** a stopped terminal detail route still has `transportUrl` for snapshot hydration and later reconnect
- **THEN** the route keeps transport discovery visible without implying that live websocket mirroring is currently active
- **AND** the viewport only enables live transport while the terminal lifecycle is actually `running`

#### Scenario: Toolbar status reflects lifecycle plus activity

- **WHEN** the selected terminal route renders
- **THEN** the toolbar status shows process lifecycle facts such as `Provisioned`, `Running`, or `Stopped`
- **AND** running terminals may additionally show `Busy` or `Idle`
- **AND** stopped terminals show stop-reason detail such as `Killed`, `Exited`, or `Failed`

#### Scenario: Actions reflect explicit lifecycle operations

- **WHEN** a terminal is `running`
- **THEN** the route exposes `Kill PTY` as the lifecycle action and keeps `Delete terminal` separate as the destructive catalog action

#### Scenario: Page-toolbar and titlebar project one lifecycle owner
- **WHEN** the selected terminal route renders lifecycle controls in both the page-toolbar and the terminal-window titlebar
- **THEN** both controls emit the same route-owned lifecycle action type
- **AND** busy state, lifecycle labels, and destructive confirmation rules stay aligned across both projections

#### Scenario: Kill PTY requires confirmation
- **WHEN** the operator requests `Kill PTY` from either lifecycle projection
- **THEN** the route opens one confirmation dialog before calling the stop mutation
- **AND** cancelling the dialog does not stop the PTY

#### Scenario: Bootstrap stays a lifecycle action
- **WHEN** the operator requests `Bootstrap PTY`
- **THEN** the route starts the PTY from the current durable terminal configuration
- **AND** the lifecycle control itself does not become an inline launch-parameter editor

#### Scenario: Stopped route stays open

- **WHEN** the operator stops a terminal PTY
- **THEN** the route stays on that terminal and disables read/write surfaces until bootstrap
- **AND** only deleting the terminal removes it from the route/catalog

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

### Requirement: Terminal window titlebar SHALL expose one local presentation config panel

The selected terminal window titlebar SHALL expose one icon-only presentation config control on its inline-end. Activating that control SHALL open one dialog with local draft state. The same titlebar payload SHALL appear in both fit and cover modes; in cover mode the titlebar stays sticky at the top of the surrounding `window-container`.

#### Scenario: Fit and cover share one titlebar payload
- **WHEN** the operator toggles between `fit` and `cover`
- **THEN** the titlebar keeps the same window title, lifecycle control, fit-cover control, geometry text, and config icon control
- **AND** cover mode only changes chrome ownership and stickiness, not titlebar content

#### Scenario: Titlebar controls stay minimal and stateful
- **WHEN** the terminal window titlebar renders
- **THEN** it exposes exactly two macOS-style circular control primitives
- **AND** one circle projects the current lifecycle state as blue `bootstrap` or red `kill`
- **AND** the other circle projects the current projection mode as yellow `fit` or green `cover`
- **AND** the circles do not render icons, inline labels, or a third destructive control category

#### Scenario: Titlebar inline-end shows size information only
- **WHEN** the terminal window titlebar renders
- **THEN** the inline-end metadata is limited to terminal size information
- **AND** the titlebar does not repeat transport, projection, or other multi-chip status labels there

#### Scenario: Config dialog stages presentation draft locally
- **WHEN** the operator opens the titlebar config dialog
- **THEN** the dialog lets them change terminal theme, renderer preference, font family, and font size
- **AND** browsing those draft values does not immediately mutate terminal-system durable truth

#### Scenario: Apply commits the staged presentation draft
- **WHEN** the operator confirms `Apply` from the titlebar config dialog
- **THEN** the staged presentation draft writes through the browser-authenticated terminal config mutation path for that terminal id
- **AND** `Cancel` leaves the durable presentation profile unchanged

#### Scenario: Running terminal reflects titlebar config changes without losing PTY identity
- **WHEN** the operator changes theme, font, or renderer preference from the titlebar panel on a running terminal
- **THEN** the visible terminal window updates in place or rebuilds only its local renderer stack
- **AND** the route keeps the same terminal id, PTY lifecycle state, and current fit-cover mode

#### Scenario: Applying state waits for renderer-settled ack
- **WHEN** the operator applies a presentation mutation that reaches terminal-system durable truth
- **THEN** the titlebar config dialog stays in its local applying state until `terminal-view-presentation-ready` confirms visible settlement
- **AND** the host does not infer renderer completion only from the server mutation response

### Requirement: Terminal window projection SHALL follow renderer-measured native content

The integrated terminal window SHALL size fit/cover projection from renderer-measured native terminal content once those measurements are available. Bootstrap cell-size formulas MAY be used only before the renderer reports native metrics.

#### Scenario: Fit mode follows measured native content
- **WHEN** a live renderer session reports native terminal content metrics
- **THEN** fit projection uses those metrics to compute shell width, shell height, and content box size
- **AND** the host does not continue using fallback formula metrics as final geometry truth

#### Scenario: Cover mode keeps native renderer content aligned with the window shell
- **WHEN** a live renderer session reports native terminal content metrics in cover mode
- **THEN** the terminal window body, scroll container, and terminal content remain aligned to the same native content box
- **AND** cover mode does not invent extra spacing between `terminal-content` and `terminal-window`

### Requirement: Terminal-system SHALL expose explicit history management separate from the live workbench
The WebUI terminal-system product SHALL separate live terminal work from dead terminal history management. Killed terminals SHALL leave the main live workbench and remain accessible only through explicit history or archive surfaces.

#### Scenario: Killed terminal leaves the live workbench list
- **WHEN** the selected live terminal is killed
- **THEN** it is removed from the default live terminal navigation list
- **AND** the operator must use explicit history management to inspect its retained evidence

#### Scenario: History surface lists dead terminal evidence
- **WHEN** the operator opens the terminal-system history surface
- **THEN** they can browse killed terminal instances and their retained evidence
- **AND** the history surface does not imply those instances are still live shells

### Requirement: Terminal-system SHALL present live terminals by default and history as an explicit index

The Studio terminal-system workbench SHALL treat `/terminals` and live terminal detail tabs as live projections only. Killed terminal instances SHALL NOT appear as ordinary live tabs or the default live redirect target. The explicit history/index route SHALL show live instances first, followed by killed non-archived instances sorted by killed time, so operators can discover both active and dead terminal instances without confusing dead records for live sessions.

#### Scenario: Default terminal route selects only live terminal

- **GIVEN** Studio has loaded one live terminal and one killed terminal
- **WHEN** the operator opens `/terminals`
- **THEN** the redirect target is the live terminal detail route
- **AND** the killed terminal is not selected as the default live terminal

#### Scenario: Live workbench tabs exclude killed terminals

- **GIVEN** Studio has loaded live and killed terminal projections
- **WHEN** the terminal workbench renders live terminal tabs
- **THEN** only live terminals appear as ordinary terminal tabs
- **AND** killed terminals are reachable through the History tab or index route

#### Scenario: History index shows active first then killed by killed time

- **GIVEN** Studio has loaded live terminals and killed non-archived terminals
- **WHEN** the operator opens `/terminals/history`
- **THEN** the route lists live terminals before killed terminals
- **AND** killed terminals are sorted by killed time descending
- **AND** each killed row still supports archive and delete actions

