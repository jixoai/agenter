> Boundary note:
> The Avatar create/clear semantics in this delta spec remain valuable.
> But terminal identity must now follow `realign-cli-shell-with-core-system-boundaries`: cli-shell targets the current bound TerminalSystem terminal, and old `terminal-1/terminal-2` or browser-host wording is historical input only.

## MODIFIED Requirements

### Requirement: Cli-shell SHALL parse explicit Avatar flags separately from app terminal name

The `agenter-app-shell` app SHALL parse the selected Avatar, creation permission, clearing permission, and app terminal name as separate concerns. `--avatar` and positional `@avatar` select Avatar identity. `--session` selects only the app shell resource key. `--create-avatar` and `--clear-avatar` control missing-Avatar creation and runtime-session clearing without changing runtime identity topology.

#### Scenario: Avatar flag selects explicit Avatar

- **WHEN** a user runs `agenter shell --avatar=review-4 --session=4`
- **THEN** cli-shell resolves the Avatar nickname as `review-4`
- **AND** it resolves the app terminal name as `shell-4`
- **AND** it does not treat `4` as an AvatarRuntime session id

#### Scenario: Avatar flag and mention conflict is rejected

- **WHEN** a user runs `agenter shell @alpha --avatar=bravo`
- **THEN** cli-shell fails before backend mutation
- **AND** the error explains that the two Avatar selectors conflict

#### Scenario: Missing explicit Avatar requires create flag

- **GIVEN** no Avatar with nickname `review-4` exists
- **WHEN** a user runs `agenter shell --avatar=review-4`
- **THEN** cli-shell fails with an Avatar-not-found error
- **AND** it does not create terminals, rooms, or runtime sessions for that missing Avatar

#### Scenario: Create flag provisions selected Avatar

- **GIVEN** no Avatar with nickname `review-4` exists
- **WHEN** a user runs `agenter shell --avatar=review-4 --create-avatar`
- **THEN** cli-shell creates Avatar `review-4` through generic Avatar/app-extension APIs
- **AND** core launcher modules do not special-case that Avatar nickname

#### Scenario: Clear flag resets selected Avatar runtime session before attach

- **GIVEN** Avatar `review-4` has an existing runtime session for the current workspace
- **WHEN** a user runs `agenter shell --avatar=review-4 --clear-avatar`
- **THEN** cli-shell deletes or clears that runtime session before ensuring the replacement runtime
- **AND** later model calls for the replacement runtime do not inherit the deleted session's prompt-window or model-call history
- **AND** the Avatar principal, nickname alias, `AGENTER.mdx`, memory files, profile media, terminal resources, and room resources are not deleted by this flag

#### Scenario: Avatar contract does not introduce a special-purpose selector

- **WHEN** cli-shell documents or prints help for Avatar startup
- **THEN** `--avatar`, `--create-avatar`, and `--clear-avatar` are the public controls
- **AND** `--test-avatar` is rejected or absent because it would introduce a second Avatar selection concept

### Requirement: Cli-shell SHALL NOT create special Avatar prompt or memory state

Cli-shell SHALL treat every selected or created Avatar as an ordinary Avatar. It SHALL NOT create a special prompt, memory pack, classify value, hidden mode, or second prompt authority just because the Avatar was created or cleared through cli-shell startup flags.

#### Scenario: Created Avatar stays ordinary

- **GIVEN** cli-shell creates Avatar `review-4` because `--create-avatar` was provided
- **WHEN** cli-shell starts the runtime
- **THEN** the Avatar remains an ordinary global Avatar
- **AND** cli-shell does not add special prompt, memory, classify, or mode data

#### Scenario: Existing Avatar prompt remains user truth

- **GIVEN** Avatar `review-4` already has a canonical `AGENTER.mdx`
- **WHEN** a user runs `agenter shell --avatar=review-4 --create-avatar --clear-avatar`
- **THEN** cli-shell keeps the existing prompt content
- **AND** it does not restore or overwrite the prompt from app defaults

### Requirement: Cli-shell SHALL show guard approval requests for the current bound terminal

Cli-shell SHALL render permission requests for the TerminalSystem terminal currently bound to the active cli-shell app session and MessageRoom. Cli-shell SHALL NOT widen subscriptions to hidden/internal terminal roles as a workaround for wrong write targeting.

#### Scenario: Bound terminal is the only default Avatar target

- **GIVEN** cli-shell session `shell-4` is bound to terminal `T`
- **WHEN** cli-shell bootstraps or reuses app resources for the selected Avatar
- **THEN** the Avatar has terminal authority on `T`
- **AND** stale grants on unrelated terminals are not treated as current cli-shell truth

#### Scenario: Current terminal permission request appears in cli-shell

- **GIVEN** cli-shell session `shell-4` has bound terminal `T`
- **WHEN** Shell Assistant creates a guard approval request on terminal `T`
- **THEN** the native cli-shell surface shows the default approval TopLayer overlay
- **AND** the approve or deny action uses terminal `T` and the original request id
- **AND** no cli-shell managed/takeover state is changed by rendering or deciding the request

#### Scenario: Wrong terminal request is treated as routing bug

- **GIVEN** cli-shell session `shell-4` has bound terminal `T`
- **WHEN** a guard approval request is created on another terminal `U`
- **THEN** cli-shell does not subscribe to `U` merely to make the popup appear
- **AND** the implementation must fix the write target, focus, or runtime guidance so cli-shell terminal work targets `T`

#### Scenario: Equivalent pending requests do not stack overlays

- **WHEN** TerminalSystem refreshes an equivalent pending request for the bound terminal
- **THEN** cli-shell updates the existing visible approval surface
- **AND** it does not stack another popup for the same request id
