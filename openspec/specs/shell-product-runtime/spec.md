# shell-product-runtime Specification

## Purpose

Define the promoted Shell app runtime law after shell-next becomes the stable `agenter shell` product.

## Requirements

### Requirement: Shell SHALL own localized app atoms copied from cli-shell

Shell SHALL NOT import `agenter-app-shell-old` or `apps/shell-old` at runtime. Shell MAY preserve proven Room, app bootstrap, settings, heartbeat, approval, cleanup, and terminal projection behavior copied from cli-shell, but copied code SHALL live under `apps/shell` and use shell/opencompose naming.

#### Scenario: App Room uses the localized shell Room atom

- **WHEN** shell is app-attached and Chat is opened
- **THEN** the Chat pane mounts shell-owned OpenTUI Room code inside shell layout
- **AND** it preserves multiline composer, history, room hydration, send/refresh failure separation, and live repaint behavior
- **AND** it does not start a tmux popup or tmux pane

#### Scenario: Legacy shell package stays out of shell runtime

- **WHEN** shell runtime and mux source files are inspected
- **THEN** they do not import `agenter-app-shell-old`
- **AND** they do not import `apps/shell-old`
- **AND** shell pane ids remain OpenTUI/opencompose layout ids, not tmux pane ids

### Requirement: Opencompose panes SHALL support renderer and custom content families

Shell SHALL incubate the reusable compositor as opencompose. A pane source SHALL be either an OpenTUI renderer/renderable surface or a custom terminal/content renderer surface. Shell SHALL use the custom terminal/content path to project PTY + termless + ghostty-native(vt)-backend output.

#### Scenario: Renderer pane mixes OpenTUI content

- **WHEN** shell opens Help, Chat, Room, or a renderer-grid demo pane
- **THEN** the pane is mounted as an OpenTUI renderable source
- **AND** it can be focused, resized, selected, and copied through the host renderer

#### Scenario: Terminal pane uses custom projection content

- **WHEN** shell opens a terminal protocol pane
- **THEN** opencompose mounts the custom terminal frame renderer
- **AND** shell connects that renderer to the PTY/protocol source rather than to cli-shell code

### Requirement: Terminal source policy SHALL keep app terminals and local BunPTY separate

Shell SHALL model terminal creation through a terminal source policy. A app-bound policy SHALL create the initial source from TerminalSystem truth and SHALL NOT expose a Local BunPTY split creator. A local policy MAY expose a BunPTY split creator. These policies are separate capabilities, not fallback levels.

#### Scenario: App policy has no Local BunPTY split capability

- **WHEN** shell is attached to a daemon-backed app terminal
- **AND** the user requests a new shell split
- **THEN** shell does not create a Local BunPTY source
- **AND** it keeps the existing terminal truth intact
- **AND** it shows the app-bound policy's split-unavailable reason

#### Scenario: Local policy may create Local BunPTY splits

- **WHEN** shell is not attached to a daemon-backed app terminal
- **AND** the user requests a new shell split
- **THEN** the local terminal source policy may create a Local BunPTY-backed protocol source
- **AND** that source is not presented as app-bound TerminalSystem truth

### Requirement: Shell SHALL own the stable launcher command

Shell SHALL own `agenter shell` as the stable launcher command. The previous incubation command `agenter shell2` SHALL be removed from the app command descriptor registry.

#### Scenario: Stable shell resolves to the promoted package

- **WHEN** the app launcher resolves shell commands
- **THEN** `shell` resolves to `agenter-app-shell`
- **AND** its bin is `agenter-shell`
- **AND** its in-process main export is `runShell`

#### Scenario: Shell2 is no longer a app command

- **WHEN** the app launcher resolves `shell2`
- **THEN** no app descriptor is returned

### Requirement: Status view SHALL remain distinct from the approval top-layer

Shell SHALL treat the attach-time `status` view as a single-view projection of statusbar inline-start summary text. Approval overlays SHALL remain top-layer surfaces and SHALL NOT be implied by `--view=status`.

#### Scenario: Status view does not open the top-layer

- **WHEN** shell starts with `--view=status`
- **THEN** the root pane is an OpenTUI status surface that renders the left-side status summary
- **AND** the bottom mixed-host statusbar is not required
- **AND** the approval top-layer remains hidden unless explicitly requested by approval flow or user action

### Requirement: Mixed host statusbar SHALL remain macro-only

Shell mixed host mode SHALL not render Heartbeat preview detail in the bottom statusbar. The statusbar SHALL show macro attention/runtime facts and available AI context usage, and SHALL expose Help/Chat as interactive actions.

#### Scenario: Mixed host statusbar omits Heartbeat preview prose

- **WHEN** shell starts in default mixed host mode
- **THEN** the bottom statusbar shows `Idle · <focused> focused · <background> background · <muted> muted`
- **AND** it may show `Context <percent> used`
- **AND** it does not show AttentionItem preview strings or Heartbeat narrative text

#### Scenario: App attach strips Heartbeat preview text

- **WHEN** app attach reads a non-idle Heartbeat preview and model call context facts
- **THEN** shell projects a macro runtime label such as `Active`
- **AND** it projects AI context usage from model-call token facts
- **AND** it does not pass Heartbeat preview prose into the statusbar

#### Scenario: Help and Chat are clickable statusbar actions

- **WHEN** the user clicks `Help` or `Chat` in the bottom statusbar
- **THEN** shell opens or toggles the corresponding app surface

### Requirement: Terminal panes SHALL surface source title and close confirmation

Terminal panes SHALL render a title bar derived from terminal source metadata and SHALL expose a close affordance that routes through top-layer confirmation.

#### Scenario: Pane title follows terminal source truth

- **WHEN** a terminal source exposes `currentTitle`, `configuredTitle`, or fallback identity
- **THEN** the pane header shows that title instead of a synthetic `Shell pane-*` label

#### Scenario: Pane close goes through top-layer confirmation

- **WHEN** the user activates the pane close affordance
- **THEN** shell opens a top-layer confirmation dialog
- **AND** `Run in background` closes the shell UI without killing the PTY
- **AND** `Terminate terminal` kills the PTY and closes the shell UI

### Requirement: Host shortcuts SHALL use Ctrl+B prefix

Shell host actions SHALL reserve `Ctrl+B` as the default prefix key. Bare terminal chords SHALL be forwarded to the focused terminal pane unless a top-layer or focused renderer pane consumes them.

#### Scenario: Prefix Help and Chat bindings

- **WHEN** the user presses `Ctrl+B` then `H`, `?`, or `C`
- **THEN** shell opens Help or Chat without forwarding those chords to the terminal pane

#### Scenario: Prefix layout bindings do not steal terminal chords

- **WHEN** the user presses `Ctrl+B` then `N`, `W`, `Tab`, or an arrow key
- **THEN** shell routes the corresponding split, close, or focus action through the host
- **AND** when the user presses the same keys without the prefix, shell forwards them to the focused terminal pane

### Requirement: Keyboard events SHALL route through a focusable event tree

Shell SHALL route keyboard events through a DOM-like focusable node tree with capture, target, and bubble phases. Top-layer and pane content SHALL be target nodes, while global host controls SHALL live on the root capture/bubble node. A scope that handles a key SHALL mark it handled so later phases cannot also consume it.

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

- **WHEN** shell dispatches a key to a focused nested pane node
- **THEN** ancestor capture handlers run before the pane target
- **AND** ancestor bubble handlers run only if the target did not consume the key

### Requirement: Shell testing SHALL prefer embedded compositor tests

Shell default regression tests SHALL use OpenTUI test renderer, protocol source fakes, and focused terminal projection tests. Tmux MAY be used only as an optional parity harness and SHALL clean up every session it creates.

#### Scenario: Default tests do not require tmux

- **WHEN** shell focused tests run in CI or local development
- **THEN** they validate layout, pane chrome, focus routing, statusbar, renderer mixing, and terminal protocol projection without requiring a tmux binary

#### Scenario: Optional tmux parity harness cleans itself up

- **WHEN** a developer explicitly runs a tmux parity harness
- **THEN** the harness creates uniquely named tmux sessions
- **AND** it destroys those sessions before exiting, including failure paths
