## MODIFIED Requirements

### Requirement: Product extensions SHALL bind core-system resources without owning their truth

Product extension runtime SHALL let products bind TerminalSystem terminals, MessageSystem rooms, AvatarRuntime sessions, and AttentionSystem contexts through generic product-owned keys. The binding API SHALL return typed core-resource identities to the product, but it SHALL NOT imply the product owns terminal output truth, room transcript truth, prompt truth, authorization truth, or scheduler truth.

#### Scenario: Extension binds terminal through TerminalSystem authority
- **WHEN** cli-shell asks for its shell resource for `shell-7`
- **THEN** product-extension runtime resolves or creates a TerminalSystem terminal through generic resource binding
- **AND** the terminal remains listed, read, written, approved, bootstrapped, stopped, and deleted through TerminalSystem APIs
- **AND** product-extension runtime does not create cli-shell-specific terminal roles in core

#### Scenario: Extension binds room through MessageSystem authority
- **WHEN** cli-shell asks for its room resource for `shell-7`
- **THEN** product-extension runtime resolves or creates a MessageSystem room through generic resource binding
- **AND** the room transcript remains MessageSystem truth
- **AND** product-extension runtime does not make the product resource key the room id unless MessageSystem allocated that id

#### Scenario: Binding returns enough identity for product context
- **WHEN** product-extension runtime completes cli-shell bootstrap
- **THEN** its output includes the selected AvatarRuntime identity
- **AND** the bound terminal id when a terminal resource is bound
- **AND** the bound room id when a room resource is bound
- **AND** product-local resource key and metadata
- **AND** later product code does not need to rediscover the current resource by scanning global catalogs

### Requirement: Product extension runtime SHALL not encode product-host implementations

Product extension runtime SHALL remain independent of product host implementations such as tmux, OpenTUI layouts, Studio routes, or browser-specific shells. Host state MAY be carried as product metadata only when it is explicitly presentation provenance and not core-system truth.

#### Scenario: Runtime has no tmux branch
- **WHEN** reviewers inspect product-extension runtime
- **THEN** it does not branch on tmux, pane ids, tmux socket names, or cli-shell status bar state
- **AND** those details remain inside the cli-shell product package

#### Scenario: Host metadata does not replace terminal identity
- **WHEN** a product records local host metadata such as a tmux session or pane id
- **THEN** that metadata is labeled as presentation-local provenance
- **AND** TerminalSystem terminal id remains the operation target for shell input/output

### Requirement: Product extension runtime SHALL preserve prompt ownership while allowing product runtime facts

Product extension runtime MAY help products seed missing Avatar prompt or memory assets through generic APIs, but Core/AvatarRuntime remains the owner of prompt-source resolution and prompt change detection. `AGENTER.mdx` remains the single trusted prompt source. Product runtime facts for a selected Avatar SHALL be supplied without forcing prompt file rewrites or inventing a second prompt layer.

#### Scenario: Explicit Avatar receives product context without special type
- **WHEN** cli-shell starts with `--avatar=bangeel`
- **THEN** product-extension runtime can expose cli-shell binding facts for that AvatarRuntime
- **AND** it does not create a "test Avatar" type
- **AND** it does not overwrite an existing user-edited `AGENTER.mdx`

#### Scenario: Prompt seed stays seed-if-missing
- **GIVEN** an Avatar has an existing `AGENTER.mdx`
- **WHEN** a product initializes that Avatar
- **THEN** missing product defaults may be seeded only through seed-if-missing behavior
- **AND** existing prompt content remains user truth

#### Scenario: Product binding facts are not a prompt overlay
- **WHEN** product-extension runtime exposes current terminal/room binding for cli-shell
- **THEN** it publishes those values as runtime/session facts or equivalent typed product binding outputs
- **AND** it does not create a second prompt overlay, Slot overlay, or product-private prompt file for the same purpose
