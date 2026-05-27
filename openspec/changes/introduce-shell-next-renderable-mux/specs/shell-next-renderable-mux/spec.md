## ADDED Requirements

### Requirement: Shell-next SHALL incubate a product-free renderable mux core

Shell-next SHALL create a local incubation implementation under `extensions/shell-next` whose generic mux core is free of Agenter product concepts. The mux core SHALL model pane identity, layout tree, focus state, resize allocation, and input routing without importing Avatar, MessageRoom, TerminalSystem, AttentionSystem, product launcher, or cli-shell tmux host modules.

#### Scenario: Generic mux core has no product imports
- **WHEN** reviewers inspect shell-next mux core modules
- **THEN** those modules expose pane/layout/focus/input abstractions only
- **AND** they do not import Avatar, MessageRoom, TerminalSystem, AttentionSystem, client-sdk bootstrap, product launcher descriptors, or tmux host/action modules

#### Scenario: Product wiring consumes the mux core
- **WHEN** shell-next starts from the `shell2` product entry
- **THEN** Agenter-specific bootstrap code creates or resolves product resources outside the generic mux core
- **AND** it passes abstract pane sources and action callbacks into the mux renderables

### Requirement: Shell-next SHALL normalize terminal panes through a protocol channel

Shell-next SHALL treat the existing terminal protocol channel as the canonical terminal pane boundary. Protocol channels SHALL carry terminal frame truth, input, resize, viewport, dirty/pull pacing, and lifecycle events. Bun PTY and CommandTask sources SHALL be adapters that produce the same channel rather than separate terminal truth models.

#### Scenario: Existing protocol channel is consumed directly
- **WHEN** a pane source is already available as a terminal protocol channel
- **THEN** shell-next attaches the pane to that channel without creating a PTY, CommandTask, or TerminalSystem instance
- **AND** `PaneRenderable` consumes frames and routes input/resize through the channel

#### Scenario: Bun PTY source adapts to protocol channel
- **WHEN** shell-next creates a pane from `Bun.Terminal`
- **THEN** the adapter starts the PTY, feeds output into the offscreen Termless/Ghostty VT backend, and exposes the result as a terminal protocol channel
- **AND** the rest of the mux sees the pane as the same protocol channel shape as any other terminal source

#### Scenario: CommandTask source lowers to Bun PTY source
- **WHEN** shell-next creates a pane from a CommandTask
- **THEN** the product adapter launches the command through the Bun PTY source path
- **AND** the pane becomes a terminal protocol channel before it reaches `PaneRenderable`

#### Scenario: OpenTUI renderable source stays non-terminal unless adapted
- **WHEN** shell-next hosts an OpenTUI renderable object such as a `createCliRenderer` based surface
- **THEN** it may be mounted in the layout tree as a renderable source
- **AND** it is not treated as VT terminal truth unless it explicitly adapts to the terminal protocol channel

### Requirement: Shell-next SHALL use OpenTUI low-level Renderable APIs for the native mux surface

Shell-next SHALL implement its native TTY surface through OpenTUI low-level `Renderable` and layout APIs. The primary output of the incubation shall be reusable Renderable APIs, including terminal pane renderables, layout renderables, and product chrome renderables, rather than a tmux command plan or a product-only screen function.

#### Scenario: Pane renderable is reusable
- **WHEN** shell-next defines the terminal pane projection atom
- **THEN** it exposes a `PaneRenderable`-style API that can be constructed with an abstract terminal protocol channel and input bridge
- **AND** it does not create product sessions, rooms, Avatars, daemon clients, Bun PTYs, or CommandTasks by itself

#### Scenario: Mux surface composes layout-owned child renderables
- **WHEN** shell-next renders multiple panes or OpenTUI surfaces
- **THEN** `RootLayout` owns the OpenTUI child renderable arrangement
- **AND** each child renderable receives a stable rectangle from `ChildLayoutNode` state
- **AND** the final visible surface is produced without launching external tmux or psmux

### Requirement: Shell-next SHALL separate layout ownership from PaneRenderable

Shell-next SHALL provide a layout system in which `RootLayout` acts as the root context and `ChildLayoutNode` stores split, focus, resize, and rectangle state. `PaneRenderable` SHALL consume an assigned rectangle and SHALL NOT own split/focus/resize layout behavior.

#### Scenario: Split creates stable sibling nodes
- **WHEN** a focused layout node is split left, right, above, or below
- **THEN** `RootLayout` mutates the layout tree and creates a sibling `ChildLayoutNode`
- **AND** both child nodes receive non-overlapping rectangles within the parent area
- **AND** minimum pane dimensions are preserved

#### Scenario: Minimum pane dimensions follow tmux source behavior
- **WHEN** shell-next enforces minimum pane dimensions for split or resize
- **THEN** the rule is derived from pinned tmux source behavior including `PANE_MINIMUM` and required separator/scrollbar/border costs
- **AND** the implementation records the tmux source revision used as the parity reference
- **AND** it does not introduce an unexplained project-local magic number

#### Scenario: Pane renderable receives assigned geometry
- **WHEN** `RootLayout` recomputes layout after a split, close, resize, or host resize
- **THEN** it assigns rectangles to child nodes
- **AND** `PaneRenderable` updates from the assigned rectangle instead of computing sibling geometry

#### Scenario: Host resize propagates through layout and source hooks
- **WHEN** the host terminal is resized
- **THEN** `RootLayout` recomputes all child rectangles from the layout tree
- **AND** terminal pane sources receive resize messages only after their assigned terminal geometry changes

#### Scenario: Adjacent focus uses layout geometry
- **WHEN** the user requests focus movement in a direction
- **THEN** shell-next selects the adjacent child node based on layout geometry
- **AND** it does not depend on renderable child order alone

#### Scenario: Hit testing resolves event owner
- **WHEN** mouse input targets a cell position inside the shell-next surface
- **THEN** shell-next resolves the owning child node from layout rectangles
- **AND** the event is routed only to that child node or to layout-level controls

### Requirement: Shell-next SHALL keep terminal truth backend-owned

Shell-next SHALL project terminal frames that are owned by a terminal backend or terminal source. The mux and pane renderables SHALL route input, resize, and viewport events to the owning source instead of reinterpreting terminal bytes or maintaining a second terminal buffer. Selection/copy SHALL NOT be required for MVP.

#### Scenario: Pane renderable consumes backend frame truth
- **WHEN** a pane source publishes terminal cells, cursor, viewport, or scrollback facts
- **THEN** `PaneRenderable` projects those facts into OpenTUI
- **AND** it does not parse ANSI bytes itself
- **AND** it does not create a second terminal state machine

#### Scenario: Pane input routes to the owning source
- **WHEN** the focused pane receives keyboard input
- **THEN** shell-next encodes or forwards the input through the pane source input bridge
- **AND** the visible result returns from the pane source's next terminal frame

#### Scenario: Pane resize routes to the owning source
- **WHEN** the mux layout changes a pane's cols or rows
- **THEN** shell-next calls the pane source resize hook
- **AND** it does not simulate resize by clipping rendered text only

#### Scenario: MVP does not expose selection or copy as required behavior
- **WHEN** shell-next MVP is reviewed for terminal interaction behavior
- **THEN** selection and copy are not required acceptance criteria
- **AND** any future selection/copy feature must route through backend-owned terminal interaction events rather than `PaneRenderable` local state

### Requirement: Shell-next SHALL mix terminal panes and OpenTUI product surfaces through layout

Shell-next SHALL allow its layout tree to host both terminal pane renderables and ordinary OpenTUI renderables. Help, statusbar, top-layer approval UI, and Room direct-rendering SHALL be modeled as OpenTUI surfaces rather than as tmux popups.

#### Scenario: Help and statusbar use OpenTUI surfaces
- **WHEN** shell-next renders Help or statusbar UI
- **THEN** those surfaces are mounted as OpenTUI renderables controlled by layout/product chrome
- **AND** they do not require tmux popup commands or fake terminal panes

#### Scenario: Source families are selected by source nature
- **WHEN** shell-next hosts an in-process OpenTUI product surface such as Room, Help, or statusbar
- **THEN** it may mount that surface directly as an OpenTUI renderable source in the layout tree
- **AND** when shell-next hosts a process-backed terminal source, it uses the terminal protocol family through protocol channel, Bun PTY, or CommandTask adapters
- **AND** these source families are independent paths rather than fallback levels

#### Scenario: Four-pane renderable mixing demo admits direct renderable sources
- **WHEN** shell-next evaluates OpenTUI renderable source mixing
- **THEN** it provides a demo that arranges four independent OpenTUI renderable surfaces under one root OpenTUI renderer in a four-pane layout
- **AND** the demo is used to verify click and selection behavior before direct OpenTUI renderable sources are accepted into MVP
- **AND** the user-verified `bun run agenter shell2 renderer-grid-demo` result admits direct renderable sources as a first-class MVP path
- **AND** it does not claim same-terminal nesting of multiple `createCliRenderer()` instances without a separate offscreen compositing experiment

### Requirement: Shell-next SHALL provide an OpenTUI-native Heartbeat-style statusbar in MVP

Shell-next SHALL include a statusbar built with OpenTUI native renderables. The statusbar SHALL show macro runtime and AI context information derived from Studio Heartbeat concepts, and SHALL NOT show AttentionItem content in MVP.

#### Scenario: Statusbar shows runtime and AttentionContext outline
- **WHEN** runtime status is idle and AttentionContext contains focused, background, and muted contexts
- **THEN** the statusbar renders a compact summary such as `Idle · 21 focused · 2 background · 2 muted`
- **AND** the counts are derived from AttentionContext focus states rather than from AttentionItem bodies

#### Scenario: Statusbar shows AI context progress
- **WHEN** model-call context usage is available
- **THEN** the statusbar renders a compact AI context progress summary such as `0.7%`
- **AND** the value is derived from context usage and max context tokens where available

#### Scenario: Statusbar omits AttentionItem content
- **WHEN** AttentionItems contain detailed task or message text
- **THEN** shell-next statusbar does not render those item bodies
- **AND** the statusbar remains a macro operational summary only

#### Scenario: Narrow statusbar preserves right-side actions
- **WHEN** terminal width is too narrow to show every statusbar segment
- **THEN** right-side actions such as Help and Chat remain visible first
- **AND** the left-side macro summary consumes the remaining width with truncation or ellipsis
- **AND** left-side summary segments are ordered by importance from left to right

### Requirement: Shell-next SHALL reuse cli-shell atoms only through orthogonal boundaries

Shell-next MAY reuse existing cli-shell code only when the reused module is orthogonal to the old tmux host. It SHALL NOT reuse tmux host planning, tmux status/action dispatch, tmux session option truth, or tmux popup/pane singleton logic as part of the new renderable mux core.

#### Scenario: Safe reuse stays product or projection scoped
- **WHEN** shell-next copies or imports code from `extensions/cli-shell`
- **THEN** the reused code is classified as product bootstrap, argument parsing, room/help/top-layer surface, settings, terminal input encoding, terminal frame projection, live mirror, or test harness support
- **AND** the reuse does not import `tmux-host`, `tmux-statusbar`, or tmux action dispatch into the generic mux core

#### Scenario: Tmux residue is rejected from renderable core
- **WHEN** a proposed shell-next core module requires tmux socket names, tmux user options, tmux pane ids, tmux status ranges, or `tmux-action`
- **THEN** that module is not accepted as part of the renderable mux core
- **AND** the behavior is redesigned as mux model state or product wiring

### Requirement: Shell-next SHALL remain unpublished until acceptance

Shell-next SHALL remain a local incubation product until it passes explicit acceptance. The stable `shell` command SHALL continue to use the existing cli-shell implementation during incubation.

#### Scenario: Shell-next has a temporary local entry
- **WHEN** a developer runs `bun agenter shell2`
- **THEN** the launcher starts shell-next from the local workspace package
- **AND** this does not publish or rename the stable shell package

#### Scenario: Stable shell remains available
- **WHEN** a user runs `bun agenter shell`
- **THEN** the launcher still starts the existing cli-shell package
- **AND** shell-next implementation state does not change that behavior
