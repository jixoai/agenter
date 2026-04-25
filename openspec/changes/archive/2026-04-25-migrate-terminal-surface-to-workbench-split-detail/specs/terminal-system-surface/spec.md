## MODIFIED Requirements

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

#### Scenario: Terminal action cards stay compact while reusing the shared structured viewer

- **WHEN** a structured terminal fact renders in the narrow `Actions` rail
- **THEN** the route still uses the shared structured viewer implementation
- **THEN** per-card viewer mode menus stay suppressed for this rail context
- **THEN** the structured preview remains readable without introducing a terminal-only renderer fork
