## ADDED Requirements

### Requirement: Shell-next SHALL keep shell2 as the incubation entry

Shell-next SHALL remain accessible through `agenter shell2` while it is under validation. The stable `agenter shell` command SHALL continue to start the existing cli-shell product until a later user-approved switch.

#### Scenario: Shell2 starts shell-next without switching shell

- **WHEN** a developer runs `agenter shell2`
- **THEN** the launcher starts `agenter-ext-shell-next`
- **AND** `agenter shell` still starts `agenter-ext-shell`

### Requirement: Shell-next SHALL attach through daemon-backed product bootstrap

Shell-next SHALL support cli-shell-compatible product attach arguments for host, port, auth-service endpoint, session, Avatar, Avatar creation, and Avatar clearing. Its default product attach path SHALL use daemon/client-sdk bootstrap to ensure the selected AvatarRuntime, TerminalSystem terminal binding, MessageSystem room binding, and managed state.

#### Scenario: Explicit shell2 attach binds core resources

- **WHEN** a user runs `agenter shell2 --session=7 --avatar=bangeel`
- **THEN** shell-next resolves product resource key `shell-7`
- **AND** it starts or selects Avatar `bangeel`
- **AND** it obtains a TerminalSystem terminal binding and a MessageSystem room binding through product runtime APIs
- **AND** it does not create tmux pane ids as durable shell truth

#### Scenario: Non-TTY attach requires explicit selection

- **WHEN** shell-next starts in a non-TTY context without explicit session or Avatar selection
- **THEN** it fails with a clear error requiring `--session` and `--avatar`

### Requirement: Shell-next SHALL use live TerminalSystem transport as the default terminal source

Shell-next SHALL render the attached terminal through a terminal protocol source created from the TerminalSystem terminal id, transport URL, and initial snapshot. Local BunPTY sources SHALL remain available only as explicit local/dev process-backed sources.

#### Scenario: Attached shell pane uses live terminal transport

- **WHEN** shell-next completes product bootstrap for a terminal with a transport URL
- **THEN** the initial shell pane uses that live transport as its terminal protocol source
- **AND** focused input and resize route to TerminalSystem through that protocol source

#### Scenario: Missing terminal transport fails attach

- **WHEN** product bootstrap returns an attached terminal without a transport URL
- **THEN** shell-next fails the attach with a clear missing-transport error
- **AND** it does not silently fall back to Local BunPTY

### Requirement: Shell-next SHALL render Room as an OpenTUI product surface

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

- **WHEN** shell-next is attached to a running product runtime
- **THEN** its statusbar renders runtime status, attention focus counts, and context usage where available
- **AND** it does not derive those facts solely from local pane counts

### Requirement: Shell-next SHALL own product compatibility without tmux actions

Shell-next SHALL provide product-compatible commands for attach, room/chat, top, help-panel, shell/terminal, heartbeat-status, and cleanup where those commands describe product runtime behavior. Shell-next SHALL reject tmux-only actions with an explicit migration error.

#### Scenario: Tmux-only action is rejected

- **WHEN** a user invokes a shell-next tmux-only action
- **THEN** shell-next returns a clear unsupported-tmux-action error
- **AND** it does not mutate shell-next Chat or terminal state

### Requirement: Shell-next SHALL remove legacy runtime dependency before replacement readiness

Shell-next MAY reuse safe cli-shell atoms during incubation, but it SHALL NOT claim replacement readiness while stable shell-next depends on legacy `agenter-ext-shell` as a runtime package for shared projection, live mirror, settings, or keybinding behavior.

#### Scenario: Replacement readiness has no legacy runtime dependency

- **WHEN** shell-next is marked ready to replace cli-shell
- **THEN** shared terminal projection/live mirror/settings/keybinding atoms have been extracted or relocated to a neutral shell-next-owned boundary
- **AND** shell-next does not require legacy tmux-backed cli-shell to run
