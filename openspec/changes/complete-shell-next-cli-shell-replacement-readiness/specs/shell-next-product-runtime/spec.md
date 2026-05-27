## ADDED Requirements

### Requirement: Shell-next SHALL own localized product atoms copied from cli-shell

Shell-next SHALL NOT import `agenter-ext-shell` or `extensions/cli-shell` at runtime. Shell-next MAY copy proven Room, product bootstrap, settings, heartbeat, approval, cleanup, and terminal projection behavior from cli-shell during incubation, but copied code SHALL live under `extensions/shell-next` and use shell-next/opencompose naming.

#### Scenario: Product Room uses the localized shell-next Room atom

- **WHEN** shell-next is product-attached and Chat is opened
- **THEN** the Chat pane mounts shell-next-owned OpenTUI Room code inside shell-next layout
- **AND** it preserves multiline composer, history, room hydration, send/refresh failure separation, and live repaint behavior
- **AND** it does not start a tmux popup or tmux pane

#### Scenario: Legacy shell package stays out of shell-next runtime

- **WHEN** shell-next runtime and mux source files are inspected
- **THEN** they do not import `agenter-ext-shell`
- **AND** they do not import `extensions/cli-shell`
- **AND** shell-next pane ids remain OpenTUI/opencompose layout ids, not tmux pane ids

### Requirement: Opencompose panes SHALL support renderer and custom content families

Shell-next SHALL incubate the reusable compositor as opencompose. A pane source SHALL be either an OpenTUI renderer/renderable surface or a custom terminal/content renderer surface. Shell-next SHALL use the custom terminal/content path to project PTY + termless + ghostty-native(vt)-backend output.

#### Scenario: Renderer pane mixes OpenTUI content

- **WHEN** shell-next opens Help, Chat, Room, or a renderer-grid demo pane
- **THEN** the pane is mounted as an OpenTUI renderable source
- **AND** it can be focused, resized, selected, and copied through the host renderer

#### Scenario: Terminal pane uses custom projection content

- **WHEN** shell-next opens a terminal protocol pane
- **THEN** opencompose mounts the custom terminal frame renderer
- **AND** shell-next connects that renderer to the PTY/protocol source rather than to cli-shell code

### Requirement: Terminal source policy SHALL keep product terminals and local BunPTY separate

Shell-next SHALL model terminal creation through a terminal source policy. A product-bound policy SHALL create the initial source from TerminalSystem truth and SHALL NOT expose a Local BunPTY split creator. A local policy MAY expose a BunPTY split creator. These policies are separate capabilities, not fallback levels.

#### Scenario: Product policy has no Local BunPTY split capability

- **WHEN** shell-next is attached to a daemon-backed product terminal
- **AND** the user requests a new shell split
- **THEN** shell-next does not create a Local BunPTY source
- **AND** it keeps the existing terminal truth intact
- **AND** it shows the product-bound policy's split-unavailable reason

#### Scenario: Local policy may create Local BunPTY splits

- **WHEN** shell-next is not attached to a daemon-backed product terminal
- **AND** the user requests a new shell split
- **THEN** the local terminal source policy may create a Local BunPTY-backed protocol source
- **AND** that source is not presented as product-bound TerminalSystem truth

### Requirement: Shell2 SHALL remain the acceptance entry

Shell-next SHALL remain behind `agenter shell2` until explicit user acceptance. The stable `agenter shell` command SHALL remain routed to the existing cli-shell package.

#### Scenario: Stable shell remains unchanged

- **WHEN** the product launcher resolves shell commands
- **THEN** `shell2` resolves to `agenter-ext-shell-next`
- **AND** `shell` resolves to `agenter-ext-shell`

### Requirement: Status view SHALL remain distinct from the approval top-layer

Shell-next SHALL treat the attach-time `status` view as a single-view projection of statusbar inline-start summary text. Approval overlays SHALL remain top-layer surfaces and SHALL NOT be implied by `--view=status`.

#### Scenario: Status view does not open the top-layer

- **WHEN** shell-next starts with `--view=status`
- **THEN** the root pane is an OpenTUI status surface that renders the left-side status summary
- **AND** the bottom mixed-host statusbar is not required
- **AND** the approval top-layer remains hidden unless explicitly requested by approval flow or user action

### Requirement: Mixed host statusbar SHALL remain macro-only

Shell-next mixed host mode SHALL not render Heartbeat preview detail in the bottom statusbar. The statusbar SHALL show macro attention/runtime facts and available AI context usage, and SHALL expose Help/Chat as interactive actions.

#### Scenario: Mixed host statusbar omits Heartbeat preview prose

- **WHEN** shell-next starts in default mixed host mode
- **THEN** the bottom statusbar shows `Idle · <focused> focused · <background> background · <muted> muted`
- **AND** it may show `Context <percent> used`
- **AND** it does not show AttentionItem preview strings or Heartbeat narrative text

#### Scenario: Product attach strips Heartbeat preview text

- **WHEN** product attach reads a non-idle Heartbeat preview and model call context facts
- **THEN** shell-next projects a macro runtime label such as `Active`
- **AND** it projects AI context usage from model-call token facts
- **AND** it does not pass Heartbeat preview prose into the statusbar

#### Scenario: Help and Chat are clickable statusbar actions

- **WHEN** the user clicks `Help` or `Chat` in the bottom statusbar
- **THEN** shell-next opens or toggles the corresponding product surface

### Requirement: Terminal panes SHALL surface source title and close confirmation

Terminal panes SHALL render a title bar derived from terminal source metadata and SHALL expose a close affordance that routes through top-layer confirmation.

#### Scenario: Pane title follows terminal source truth

- **WHEN** a terminal source exposes `currentTitle`, `configuredTitle`, or fallback identity
- **THEN** the pane header shows that title instead of a synthetic `Shell pane-*` label

#### Scenario: Pane close goes through top-layer confirmation

- **WHEN** the user activates the pane close affordance
- **THEN** shell-next opens a top-layer confirmation dialog
- **AND** `Run in background` closes the shell-next UI without killing the PTY
- **AND** `Terminate terminal` kills the PTY and closes the shell-next UI

### Requirement: Host shortcuts SHALL use Ctrl+B prefix

Shell-next host actions SHALL reserve `Ctrl+B` as the default prefix key. Bare terminal chords SHALL be forwarded to the focused terminal pane unless a top-layer or focused renderer pane consumes them.

#### Scenario: Prefix Help and Chat bindings

- **WHEN** the user presses `Ctrl+B` then `H`, `?`, or `C`
- **THEN** shell-next opens Help or Chat without forwarding those chords to the terminal pane

#### Scenario: Prefix layout bindings do not steal terminal chords

- **WHEN** the user presses `Ctrl+B` then `N`, `W`, `Tab`, or an arrow key
- **THEN** shell-next routes the corresponding split, close, or focus action through the host
- **AND** when the user presses the same keys without the prefix, shell-next forwards them to the focused terminal pane

### Requirement: Keyboard events SHALL route through a focusable event tree

Shell-next SHALL route keyboard events through a DOM-like focusable node tree with capture, target, and bubble phases. Top-layer and pane content SHALL be target nodes, while global host controls SHALL live on the root capture/bubble node. A scope that handles a key SHALL mark it handled so later phases cannot also consume it.

#### Scenario: Top-layer Esc does not leak to pane or global handlers

- **WHEN** a close-confirm top-layer dialog is visible over a Chat pane
- **AND** the user presses `Esc`
- **THEN** the top-layer closes
- **AND** the Chat pane remains mounted
- **AND** no global quit or pane-close action is triggered

#### Scenario: Focused pane Esc can be pane-scoped

- **WHEN** a focused Chat pane has a non-empty draft
- **AND** the user presses `Esc`
- **THEN** the Chat pane consumes the key and clears the draft
- **AND** global host controls do not close or retarget the pane

#### Scenario: Focus tree dispatch preserves phase ownership

- **WHEN** shell-next dispatches a key to a focused nested pane node
- **THEN** ancestor capture handlers run before the pane target
- **AND** ancestor bubble handlers run only if the target did not consume the key

### Requirement: Shell-next testing SHALL prefer embedded compositor tests

Shell-next default regression tests SHALL use OpenTUI test renderer, protocol source fakes, and focused terminal projection tests. Tmux MAY be used only as an optional parity harness and SHALL clean up every session it creates.

#### Scenario: Default tests do not require tmux

- **WHEN** shell-next focused tests run in CI or local development
- **THEN** they validate layout, pane chrome, focus routing, statusbar, renderer mixing, and terminal protocol projection without requiring a tmux binary

#### Scenario: Optional tmux parity harness cleans itself up

- **WHEN** a developer explicitly runs a tmux parity harness
- **THEN** the harness creates uniquely named tmux sessions
- **AND** it destroys those sessions before exiting, including failure paths
