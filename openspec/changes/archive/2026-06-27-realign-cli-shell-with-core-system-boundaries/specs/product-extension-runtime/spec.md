## MODIFIED Requirements

### Requirement: App extensions SHALL bind core-system resources without owning their truth

App extension runtime SHALL let products bind TerminalSystem terminals, MessageSystem rooms, AvatarRuntime sessions, and AttentionSystem contexts through generic app-owned keys. The binding API SHALL return typed core-resource identities to the app, but it SHALL NOT imply the app owns terminal output truth, room transcript truth, prompt truth, authorization truth, or scheduler truth.

#### Scenario: Extension binds terminal through TerminalSystem authority
- **WHEN** cli-shell asks for its shell resource for `shell-7`
- **THEN** app-extension runtime resolves or creates a TerminalSystem terminal through generic resource binding
- **AND** the terminal remains listed, read, written, approved, bootstrapped, stopped, and deleted through TerminalSystem APIs
- **AND** app-extension runtime does not create cli-shell-specific terminal roles in core

#### Scenario: Extension binds room through MessageSystem authority
- **WHEN** cli-shell asks for its room resource for `shell-7`
- **THEN** app-extension runtime resolves or creates a MessageSystem room through generic resource binding
- **AND** the room transcript remains MessageSystem truth
- **AND** app-extension runtime does not make the app resource key the room id unless MessageSystem allocated that id

#### Scenario: Binding returns enough identity for app context
- **WHEN** app-extension runtime completes cli-shell bootstrap
- **THEN** its output includes the selected AvatarRuntime identity
- **AND** the bound terminal id when a terminal resource is bound
- **AND** the bound room id when a room resource is bound
- **AND** app-local resource key and metadata
- **AND** later app code does not need to rediscover the current resource by scanning global catalogs

### Requirement: App extension runtime SHALL not encode app-host implementations

App extension runtime SHALL remain independent of app host implementations such as tmux, OpenTUI layouts, Studio routes, or browser-specific shells. Host state MAY be carried as app metadata only when it is explicitly presentation provenance and not core-system truth.

#### Scenario: Runtime has no tmux branch
- **WHEN** reviewers inspect app-extension runtime
- **THEN** it does not branch on tmux, pane ids, tmux socket names, or cli-shell status bar state
- **AND** those details remain inside the cli-shell app package

#### Scenario: Host metadata does not replace terminal identity
- **WHEN** a app records local host metadata such as a tmux session or pane id
- **THEN** that metadata is labeled as presentation-local provenance
- **AND** TerminalSystem terminal id remains the operation target for shell input/output

### Requirement: App extension runtime SHALL preserve prompt ownership while allowing app runtime facts

App extension runtime MAY help products seed missing Avatar prompt or memory assets through generic APIs, but Core/AvatarRuntime remains the owner of prompt-source resolution and prompt change detection. `AGENTER.mdx` remains the single trusted prompt source. App runtime facts for a selected Avatar SHALL be supplied without forcing prompt file rewrites or inventing a second prompt layer.

#### Scenario: Explicit Avatar receives app context without special type
- **WHEN** cli-shell starts with `--avatar=bangeel`
- **THEN** app-extension runtime can expose cli-shell binding facts for that AvatarRuntime
- **AND** it does not create a "test Avatar" type
- **AND** it does not overwrite an existing user-edited `AGENTER.mdx`

#### Scenario: Prompt seed stays seed-if-missing
- **GIVEN** an Avatar has an existing `AGENTER.mdx`
- **WHEN** a app initializes that Avatar
- **THEN** missing app defaults may be seeded only through seed-if-missing behavior
- **AND** existing prompt content remains user truth

#### Scenario: App binding facts are not a prompt overlay
- **WHEN** app-extension runtime exposes current terminal/room binding for cli-shell
- **THEN** it publishes those values as runtime/session facts or equivalent typed app binding outputs
- **AND** it does not create a second prompt overlay, Slot overlay, or app-private prompt file for the same purpose
