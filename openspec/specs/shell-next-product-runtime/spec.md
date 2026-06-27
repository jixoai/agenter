# shell-next-product-runtime Specification

## Purpose
TBD - created by archiving change refine-shell-next-interactions. Update Purpose after archive.
## Requirements
### Requirement: Shell-next interactive chrome SHALL use shared bracketed button affordances

Shell-next SHALL render pane-title actions and statusbar actions with a shared bracketed button affordance. Hover state SHALL apply bold styling to the whole bracketed label, and active state SHALL apply underline styling without replacing the action glyph or label.

#### Scenario: Chat layout actions use underline active state
- **WHEN** the Chat pane is docked left, docked right, or floating
- **THEN** its title actions remain `[←]`, `[→]`, and the floating icon action
- **AND** only the action matching the current Chat layout mode is underlined
- **AND** active state does not replace the label with a different glyph

#### Scenario: Hover styling is scoped to one button
- **WHEN** the pointer hovers over a pane-title or statusbar action
- **THEN** only that bracketed action is bolded
- **AND** sibling actions do not receive the hover style

#### Scenario: Statusbar actions use bracketed button labels
- **WHEN** mixed shell-next host mode renders the bottom statusbar
- **THEN** the Help and Chat actions render as `[Help] [Chat]`
- **AND** the active statusbar action is underlined when the corresponding surface is open

### Requirement: Resize handles SHALL support drag and click resize

Shell-next resize handles SHALL preserve drag resizing and SHALL also resize by one cell when the user clicks the visible horizontal or vertical handle without dragging.

#### Scenario: Horizontal resize handle click moves one cell
- **WHEN** two panes share a vertical border
- **AND** the user clicks the visible `◀▶` handle without dragging
- **THEN** the adjacent pane boundary moves by one column

#### Scenario: Vertical resize handle click moves one cell
- **WHEN** two panes share a horizontal border
- **AND** the user clicks the visible `▲▼` handle without dragging
- **THEN** the adjacent pane boundary moves by one row

#### Scenario: Drag resize remains available
- **WHEN** the user drags a resize handle by multiple cells
- **THEN** shell-next applies the dragged delta to the layout
- **AND** the handle visuals remain attached to the pane border junction

### Requirement: Terminal backend resize SHALL be debounced and coalesced

Shell-next terminal panes SHALL update visual frame geometry immediately during layout changes, but SHALL debounce terminal backend `resize` delivery and coalesce rapid size changes so only the newest pending terminal size is sent.

#### Scenario: Rapid terminal pane resize sends the final backend size
- **WHEN** a terminal pane receives several layout size changes inside the resize debounce window
- **THEN** shell-next sends at most one backend resize request after the window
- **AND** that request contains the newest terminal cols and rows

#### Scenario: Stable terminal pane resize is delivered
- **WHEN** a terminal pane receives a new size and no newer size replaces it before the debounce window expires
- **THEN** shell-next sends that size to the terminal source

### Requirement: Close-confirm top-layer hit regions SHALL align with visible actions

Shell-next close-confirm top-layer SHALL compute mouse hit regions from the same visible cells that render the border close action and action buttons.

#### Scenario: Visible close-confirm buttons trigger callbacks
- **WHEN** the close-confirm dialog is visible
- **AND** the user clicks inside the visible `[ Run in background ]` button
- **THEN** shell-next runs the background callback
- **AND** clicking the row above that visible button does not run the callback

#### Scenario: Visible terminate button triggers terminate
- **WHEN** the close-confirm dialog is visible
- **AND** the user clicks inside the visible `[ Terminate terminal ]` button
- **THEN** shell-next runs the terminate callback

#### Scenario: Border close action cancels only
- **WHEN** the close-confirm dialog is visible
- **AND** the user clicks the visible border `[x]` action
- **THEN** shell-next cancels the dialog
- **AND** it does not run background or terminate callbacks

### Requirement: Shell-next copy behavior SHALL be source-family aware

Shell-next SHALL route terminal-pane copy through the terminal protocol source and renderer-pane copy through the OpenTUI renderer selection. Completed renderer selections SHALL request OSC52 primary copy, and copy shortcuts SHALL request clipboard copy without stealing terminal input outside copy chords.

#### Scenario: ShellPane copy shortcut uses terminal selection truth
- **WHEN** a terminal-protocol pane is focused
- **AND** the user presses the host copy shortcut
- **THEN** shell-next calls the terminal source copy-selection API
- **AND** if the source returns selected text, shell-next writes it to OSC52 clipboard

#### Scenario: Renderer selection mirrors to primary
- **WHEN** a renderer pane selection finishes with selected text
- **THEN** shell-next requests OSC52 primary copy for that text

#### Scenario: Renderer copy shortcut copies to clipboard and primary
- **WHEN** a renderer pane has selected text
- **AND** the user presses the host copy shortcut
- **THEN** shell-next requests OSC52 clipboard copy
- **AND** shell-next also requests OSC52 primary copy

### Requirement: Background close SHALL preserve the attached terminal binding

When a user chooses `Run in Background`, shell-next SHALL close the current UI attachment without stopping the daemon-owned PTY or turning the attached terminal into dead history.

#### Scenario: Background close preserves the attached terminal
- **GIVEN** a app-bound terminal pane is open
- **WHEN** the user opens close confirmation and chooses `Run in Background`
- **THEN** shell-next exits the UI
- **AND** the attached terminal source is not terminated
- **AND** app-bound live sources may dispose their local mirror/transport so the shell-next process can exit
- **AND** the same terminal remains available on the next attach

#### Scenario: Background close does not perform terminate cleanup
- **GIVEN** a app-bound terminal pane is open
- **WHEN** the user chooses `Run in Background`
- **THEN** shell-next does not run the terminate path
- **AND** it does not kill the underlying PTY

### Requirement: App command foreground exit SHALL NOT stop daemon-owned resources

Shell-next app commands SHALL run against a managed daemon authority whose lifecycle is independent from the foreground shell-next process.

#### Scenario: Foreground shell-next process exits while daemon resources remain live
- **GIVEN** a app command launch needs daemon-backed shell-next resources
- **WHEN** the launcher ensures a managed daemon authority
- **AND** the foreground shell-next process exits after a background close
- **THEN** the launcher does not stop the daemon
- **AND** daemon-owned TerminalSystem entries remain live and selectable on the next attach

### Requirement: Terminal termination SHALL remain destructive

When a user chooses `Terminate terminal`, shell-next SHALL stop the attached terminal and close the UI.

#### Scenario: Terminate kills the attached terminal
- **GIVEN** a app-bound terminal pane is open
- **WHEN** the user opens close confirmation and chooses `Terminate terminal`
- **THEN** shell-next runs the terminal source terminate path
- **AND** the underlying PTY is killed
- **AND** the UI exits

### Requirement: Shell-next terminal input ownership SHALL stay below the app layer

Shell-next SHALL keep terminal-specific input semantics inside the terminal source/backend boundary. ShellNextApp and view code SHALL only perform app-global routing, focus orchestration, raw pointer/keyboard forwarding, and visual projection.

#### Scenario: Terminal semantic input does not live in ShellNextApp
- **WHEN** shell-next handles normal terminal key input, paste input, selection movement, or viewport-follow behavior
- **THEN** the durable behavior is owned by the terminal source/backend boundary
- **AND** ShellNextApp only routes the input to that boundary

#### Scenario: App-global shortcuts remain above the terminal boundary
- **WHEN** the user presses `Ctrl+B`, `Help`, `Chat`, or top-layer close keys
- **THEN** shell-next handles them as app-global actions
- **AND** it does not move those shortcuts into the terminal kernel boundary

### Requirement: Shell-next SHALL keep shell2 as the incubation entry

Shell-next SHALL remain accessible through `agenter shell2` while it is under validation. The stable `agenter shell` command SHALL continue to start the existing cli-shell app until a later user-approved switch.

#### Scenario: Shell2 starts shell-next without switching shell

- **WHEN** a developer runs `agenter shell2`
- **THEN** the launcher starts `agenter-app-shell-next`
- **AND** `agenter shell` still starts `agenter-app-shell`

### Requirement: Shell-next SHALL attach through daemon-backed app bootstrap

Shell-next SHALL support cli-shell-compatible app attach arguments for host, port, auth-service endpoint, session, Avatar, Avatar creation, and Avatar clearing. Its default app attach path SHALL use daemon/client-sdk bootstrap to ensure the selected AvatarRuntime, TerminalSystem terminal binding, MessageSystem room binding, and managed state.

#### Scenario: Explicit shell2 attach binds core resources

- **WHEN** a user runs `agenter shell2 --session=7 --avatar=bangeel`
- **THEN** shell-next resolves app resource key `shell-7`
- **AND** it starts or selects Avatar `bangeel`
- **AND** it obtains a TerminalSystem terminal binding and a MessageSystem room binding through app runtime APIs
- **AND** it does not create tmux pane ids as durable shell truth

#### Scenario: Non-TTY attach requires explicit selection

- **WHEN** shell-next starts in a non-TTY context without explicit session or Avatar selection
- **THEN** it fails with a clear error requiring `--session` and `--avatar`

### Requirement: Shell-next SHALL use live TerminalSystem transport as the default terminal source

Shell-next SHALL render the attached terminal through a terminal protocol source created from the TerminalSystem terminal id, transport URL, and initial snapshot. Local BunPTY sources SHALL remain available only as explicit local/dev process-backed sources.

#### Scenario: Attached shell pane uses live terminal transport

- **WHEN** shell-next completes app bootstrap for a terminal with a transport URL
- **THEN** the initial shell pane uses that live transport as its terminal protocol source
- **AND** focused input and resize route to TerminalSystem through that protocol source

#### Scenario: Missing terminal transport fails attach

- **WHEN** app bootstrap returns an attached terminal without a transport URL
- **THEN** shell-next fails the attach with a clear missing-transport error
- **AND** it does not silently fall back to Local BunPTY

### Requirement: Shell-next SHALL render Room as an OpenTUI app surface

Shell-next Chat SHALL render the bound MessageSystem Room as an OpenTUI surface in the mux layout. Chat SHALL hydrate room snapshots, send user drafts through room APIs, repaint on room updates, and keep terminal approval UI outside the Room transcript.

#### Scenario: Chat pane displays and sends room messages

- **WHEN** a user opens Chat in shell-next
- **THEN** shell-next mounts a Room-backed OpenTUI surface
- **AND** the user can send a draft to the bound room
- **AND** the sent message becomes visible without creating a terminal pane

### Requirement: Shell-next SHALL render terminal approvals through TerminalSystem APIs

Shell-next top layer SHALL display pending terminal write approvals for the attached terminal and SHALL approve or deny them through TerminalSystem approval APIs.

#### Scenario: Approval top layer resolves a pending terminal request

- **WHEN** a pending terminal write approval exists for the attached terminal
- **THEN** shell-next top layer displays the request
- **AND** approving or denying the request calls the corresponding TerminalSystem API

### Requirement: Shell-next SHALL show real macro runtime status

Shell-next statusbar SHALL show macro runtime, AttentionContext, and AI context summaries derived from real runtime/store facts. It SHALL NOT render AttentionItem bodies.

#### Scenario: Statusbar uses runtime facts

- **WHEN** shell-next is attached to a running app runtime
- **THEN** its statusbar renders runtime status, attention focus counts, and context usage where available
- **AND** it does not derive those facts solely from local pane counts

### Requirement: Shell-next SHALL own app compatibility without tmux actions

Shell-next SHALL provide app-compatible commands for attach, room/chat, top, help-panel, shell/terminal, heartbeat-status, and cleanup where those commands describe app runtime behavior. Shell-next SHALL reject tmux-only actions with an explicit migration error.

#### Scenario: Tmux-only action is rejected

- **WHEN** a user invokes a shell-next tmux-only action
- **THEN** shell-next returns a clear unsupported-tmux-action error
- **AND** it does not mutate shell-next Chat or terminal state

### Requirement: Shell-next SHALL remove legacy runtime dependency before replacement readiness

Shell-next MAY reuse safe cli-shell atoms during incubation, but it SHALL NOT claim replacement readiness while stable shell-next depends on legacy `agenter-app-shell` as a runtime package for shared projection, live mirror, settings, or keybinding behavior.

#### Scenario: Replacement readiness has no legacy runtime dependency

- **WHEN** shell-next is marked ready to replace cli-shell
- **THEN** shared terminal projection/live mirror/settings/keybinding atoms have been extracted or relocated to a neutral shell-next-owned boundary
- **AND** shell-next does not require legacy tmux-backed cli-shell to run
