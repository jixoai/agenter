## MODIFIED Requirements

### Requirement: Shell-assistant prompt guidance SHALL respect core-system ownership

Shell-assistant prompt guidance for cli-shell SHALL explain that cli-shell is a product TUI over core systems. It SHALL guide the Avatar to treat Shell as TerminalSystem truth, Room as MessageSystem truth, authorization as TerminalSystem truth, and prompt/memory as Avatar/Core truth. The prompt SHALL NOT tell the Avatar that tmux panes are the durable shell truth. `AGENTER.mdx` SHALL remain the single trusted prompt source.

#### Scenario: Prompt points terminal work at TerminalSystem binding
- **WHEN** the Avatar is in a cli-shell MessageRoom and the user asks it to operate the terminal
- **THEN** prompt/product context guides it to use the current bound TerminalSystem terminal
- **AND** it does not execute an equivalent command in `root_bash` and claim it happened in the visible shell
- **AND** it does not target stale TerminalSystem rows outside the current product binding

#### Scenario: Prompt treats root workspace as control surface only
- **WHEN** the Avatar needs runtime-local CLI commands
- **THEN** it may use `root_bash` as the control-plane entry for message, attention, terminal, and product SDK commands
- **AND** it keeps user-visible shell effects routed through the bound TerminalSystem terminal

#### Scenario: Current binding facts do not replace AGENTER.mdx
- **WHEN** cli-shell needs the Avatar to know the current terminal and room binding
- **THEN** that information is supplied as runtime/session facts or equivalent typed projections
- **AND** it does not replace, shadow, or fork `AGENTER.mdx`
- **AND** the Avatar still treats `AGENTER.mdx` as the single trusted prompt source

### Requirement: Explicit selected Avatars SHALL receive cli-shell product context

When cli-shell is launched with an explicit Avatar, that Avatar SHALL receive enough product context to understand the current terminal/room binding. This context SHALL be modeled as runtime/session facts rather than a second prompt source. It SHALL NOT require a system-level "test Avatar" concept and SHALL NOT force prompt-file rewrites.

#### Scenario: Non-default Avatar gets binding context
- **WHEN** a user runs `bun agenter shell --session=7 --avatar=bangeel --create-avatar --clear-avatar`
- **THEN** the selected AvatarRuntime receives cli-shell product context for `shell-7`
- **AND** that context identifies the bound TerminalSystem terminal and MessageSystem room
- **AND** the Avatar is not treated as a special test class

#### Scenario: Product context does not overwrite AGENTER.mdx
- **GIVEN** Avatar `bangeel` has an existing user-edited `AGENTER.mdx`
- **WHEN** cli-shell starts with `--avatar=bangeel`
- **THEN** product context is supplied through generic runtime/session-fact or attention mechanisms
- **AND** existing prompt text is not overwritten solely to inject cli-shell rules
